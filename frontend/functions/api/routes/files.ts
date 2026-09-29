import { Hono } from 'hono';
import { Env, UserRow } from '../types';
import { authMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);

async function computeSha256(buffer: ArrayBuffer | Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Automatically repairs truncated or damaged PDFs (e.g. from scanner software crashes
 * that stopped before writing xref / trailer / %%EOF).
 */
export function repairPdfIfTruncated(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 50) return bytes;
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  if (header !== '%PDF-') return bytes;

  // Check if it already has %%EOF within the last 1024 bytes
  const tailSlice = bytes.subarray(Math.max(0, bytes.length - 1024));
  let tailStr = '';
  for (let i = 0; i < tailSlice.length; i++) tailStr += String.fromCharCode(tailSlice[i]);
  if (tailStr.includes('%%EOF')) {
    return bytes;
  }

  // Convert bytes to string for object scanning
  let fullStr = '';
  const chunkSize = 32768;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    fullStr += String.fromCharCode(...bytes.subarray(i, end));
  }

  const objRegex = /(\d+)\s+(\d+)\s+obj/g;
  let match: RegExpExecArray | null;
  const objOffsets: Array<{ id: number; offset: number }> = [];
  let rootId = 1;
  let maxObjId = 0;

  while ((match = objRegex.exec(fullStr)) !== null) {
    const id = parseInt(match[1], 10);
    const offset = match.index;
    objOffsets.push({ id, offset });
    if (id > maxObjId) maxObjId = id;

    const objSnippet = fullStr.substring(offset, offset + 300);
    if (objSnippet.includes('/Type /Catalog') || objSnippet.includes('/Type/Catalog')) {
      rootId = id;
    }
  }

  if (objOffsets.length === 0) return bytes;

  const endObjIdx = fullStr.lastIndexOf('endobj');
  let lastEndObjOffset = endObjIdx !== -1 ? endObjIdx + 6 : bytes.length;
  while (lastEndObjOffset < bytes.length && (bytes[lastEndObjOffset] === 10 || bytes[lastEndObjOffset] === 13 || bytes[lastEndObjOffset] === 32)) {
    lastEndObjOffset++;
  }

  const cleanBody = bytes.subarray(0, lastEndObjOffset);
  const xrefOffset = cleanBody.length;

  const offsetMap = new Map<number, number>();
  for (const item of objOffsets) {
    offsetMap.set(item.id, item.offset);
  }

  const totalCount = maxObjId + 1;
  let xrefStr = `\nxref\n0 ${totalCount}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObjId; i++) {
    const off = offsetMap.get(i);
    if (off !== undefined && off < xrefOffset) {
      xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`;
    } else {
      xrefStr += '0000000000 00000 f \n';
    }
  }

  const trailerStr = `trailer\n<<\n  /Size ${totalCount}\n  /Root ${rootId} 0 R\n>>\nstartxref\n${xrefOffset + 1}\n%%EOF\n`;
  const tailBytes = new TextEncoder().encode(xrefStr + trailerStr);

  const repaired = new Uint8Array(cleanBody.length + tailBytes.length);
  repaired.set(cleanBody, 0);
  repaired.set(tailBytes, cleanBody.length);
  return repaired;
}

app.post('', authMiddleware, async (c) => {
  const formData = await c.req.formData().catch(() => null);
  if (!formData) {
    return c.json({ detail: '无效的表单数据' }, 400);
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return c.json({ detail: '未找到上传的文件' }, 400);
  }

  if (file.size > MAX_BYTES) {
    return c.json({ detail: '附件大小不得超过 15 MB' }, 400);
  }

  // Determine mime type
  let contentType = file.type;
  if (!contentType || contentType === 'application/octet-stream') {
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    contentType = mimeMap[ext] || 'application/octet-stream';
  }

  if (!contentType) {
    contentType = 'application/octet-stream';
  }

  const buffer = await file.arrayBuffer();
  const hash = await computeSha256(buffer);

  // 确保 sha256 字段存在，并校验去重
  await c.env.DB.prepare('ALTER TABLE uploaded_files ADD COLUMN sha256 TEXT').run().catch(() => {});
  const existing = await c.env.DB.prepare(
    'SELECT id, filename FROM uploaded_files WHERE sha256 = ? AND size = ? LIMIT 1'
  )
    .bind(hash, file.size)
    .first<{ id: string; filename: string }>()
    .catch(() => null);

  if (existing) {
    return c.json({ url: `/api/files/${existing.id}`, filename: existing.filename || file.name });
  }

  const fileId = crypto.randomUUID();

  // If R2 bucket is bound, try R2 first
  let savedToR2 = false;
  if (c.env.FILES_BUCKET) {
    try {
      await c.env.FILES_BUCKET.put(fileId, buffer, {
        httpMetadata: {
          contentType,
          contentDisposition: `inline; filename="${encodeURIComponent(file.name)}"`
        }
      });
      savedToR2 = true;
    } catch (e) {
      console.warn('R2 upload failed, falling back to D1:', e);
    }
  }

  // If R2 not used or failed, store in D1 as BLOB
  if (savedToR2) {
    try {
      await c.env.DB.prepare(
        `INSERT INTO uploaded_files (id, filename, content_type, size, sha256, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(fileId, file.name.replace(/[\r\n]/g, ''), contentType, file.size, hash)
        .run();
    } catch {
      await c.env.DB.prepare(
        `INSERT INTO uploaded_files (id, filename, content_type, size, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      )
        .bind(fileId, file.name.replace(/[\r\n]/g, ''), contentType, file.size)
        .run();
    }
  } else {
    const uint8 = new Uint8Array(buffer);
    try {
      await c.env.DB.prepare(
        `INSERT INTO uploaded_files (id, filename, content_type, size, content, sha256, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(fileId, file.name.replace(/[\r\n]/g, ''), contentType, file.size, uint8, hash)
        .run();
    } catch {
      await c.env.DB.prepare(
        `INSERT INTO uploaded_files (id, filename, content_type, size, content, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      )
        .bind(fileId, file.name.replace(/[\r\n]/g, ''), contentType, file.size, uint8)
        .run();
    }
  }

  const url = `/api/files/${fileId}`;
  return c.json({ url, filename: file.name });
});

app.get('/:id', async (c) => {
  const fileId = c.req.param('id');

  const meta = await c.env.DB.prepare('SELECT * FROM uploaded_files WHERE id = ?')
    .bind(fileId)
    .first<{ id: string; filename: string; content_type: string; size: number; content?: any }>();

  if (!meta) {
    return c.json({ detail: '附件不存在' }, 404);
  }

  let body: any = null;
  if (c.env.FILES_BUCKET) {
    try {
      const object = await c.env.FILES_BUCKET.get(fileId);
      if (object) body = object.body;
    } catch {}
  }

  if (!body && meta.content) {
    body = meta.content;
  }

  if (!body) {
    return c.json({ detail: '文件内容未在存储中找到' }, 404);
  }

  let responseBody: any = body;
  if (Array.isArray(body)) {
    responseBody = new Uint8Array(body);
  } else if (body instanceof ArrayBuffer) {
    responseBody = new Uint8Array(body);
  }

  const contentType = meta.content_type || 'application/octet-stream';
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';

  if (isPdf && responseBody instanceof Uint8Array) {
    responseBody = repairPdfIfTruncated(responseBody);
  }

  const forceDownload = c.req.query('download') === '1' || c.req.query('download') === 'true';
  const disposition = (forceDownload || (!isImage && !isPdf)) ? 'attachment' : 'inline';

  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(meta.filename)}`);
  headers.set('X-Content-Type-Options', 'nosniff');

  if (isImage) {
    headers.set('Cache-Control', 'public, max-age=86400');
  } else if (isPdf) {
    headers.set('Cache-Control', 'private, max-age=3600');
  } else {
    headers.set('Cache-Control', 'private, max-age=3600');
    if (contentType === 'text/html' || contentType === 'image/svg+xml') {
      headers.set('Content-Security-Policy', "default-src 'none'; sandbox");
    }
  }

  return new Response(responseBody, {
    status: 200,
    headers
  });
});

export default app;
