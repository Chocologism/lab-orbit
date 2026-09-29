import { Hono } from 'hono';
import { Env, UserRow } from '../types';
import { authMiddleware } from '../middleware/auth';
import { ensureUserZoteroColumns, decodeHtmlEntities } from '../utils/papers';

const app = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

app.use('*', authMiddleware);

const ZOTERO_API_VERSION = '3';
const ZOTERO_USER_AGENT = 'LabOrbit/1.0 (https://lab-orbit.pages.dev)';

interface ZoteroUserConfig {
  zotero_user_id: string;
  zotero_api_key: string;
  zotero_default_collection: string;
}

async function getUserZoteroConfig(db: D1Database, userId: number): Promise<ZoteroUserConfig | null> {
  await ensureUserZoteroColumns(db);
  const row = await db.prepare(
    'SELECT zotero_user_id, zotero_api_key, zotero_default_collection FROM users WHERE id = ?'
  ).bind(userId).first<ZoteroUserConfig>();
  return row || null;
}

// 获取当前用户的 Zotero 绑定状态与配置
app.get('/config', async (c) => {
  const user = c.get('user');
  const cfg = await getUserZoteroConfig(c.env.DB, user.id);
  const hasKey = Boolean(cfg?.zotero_api_key && cfg.zotero_api_key.trim());
  const hasUserId = Boolean(cfg?.zotero_user_id && cfg.zotero_user_id.trim());

  return c.json({
    configured: hasKey && hasUserId,
    user_id: cfg?.zotero_user_id || '',
    default_collection: cfg?.zotero_default_collection || '',
    has_api_key: hasKey
  });
});

// 保存或测试当前用户的 Zotero 凭据
app.put('/config', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const userId = (body.user_id || '').trim();
  const apiKey = (body.api_key || '').trim();
  const defaultCollection = (body.default_collection || '').trim();

  if (!userId) {
    return c.json({ detail: '请提供 Zotero User ID（在 zotero.org/settings/keys 中查看）' }, 400);
  }
  if (!apiKey) {
    return c.json({ detail: '请提供有效的 Zotero API Key' }, 400);
  }

  // 向 Zotero 官方 API 验证密钥合法性
  try {
    const testUrl = `https://api.zotero.org/users/${encodeURIComponent(userId)}/collections?limit=1`;
    const resp = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Zotero-API-Key': apiKey,
        'Zotero-API-Version': ZOTERO_API_VERSION,
        'User-Agent': ZOTERO_USER_AGENT
      }
    });

    if (resp.status === 403 || resp.status === 401) {
      return c.json({ detail: 'Zotero 身份验证失败，请检查 User ID 与 API Key 是否正确（需勾选 Allow library access）' }, 400);
    }
    if (resp.status === 404) {
      return c.json({ detail: '未找到该 Zotero User ID，请核对您的用户数字编号' }, 400);
    }
    if (!resp.ok) {
      return c.json({ detail: `Zotero API 校验未通过 (HTTP ${resp.status})` }, 400);
    }
  } catch (err: any) {
    return c.json({ detail: `连接 Zotero 官方服务超时或失败：${err.message || '请检查网络连接'}` }, 502);
  }

  await ensureUserZoteroColumns(c.env.DB);
  await c.env.DB.prepare(
    'UPDATE users SET zotero_user_id = ?, zotero_api_key = ?, zotero_default_collection = ? WHERE id = ?'
  ).bind(userId, apiKey, defaultCollection, user.id).run();

  return c.json({
    ok: true,
    message: 'Zotero 凭据校验通过并已成功保存绑定'
  });
});

// 解除当前用户的 Zotero 绑定
app.delete('/config', async (c) => {
  const user = c.get('user');
  await ensureUserZoteroColumns(c.env.DB);
  await c.env.DB.prepare(
    "UPDATE users SET zotero_user_id = '', zotero_api_key = '', zotero_default_collection = '' WHERE id = ?"
  ).bind(user.id).run();

  return c.json({ ok: true, message: '已成功解除 Zotero 绑定' });
});

// 拉取当前用户在 Zotero 的全量收藏夹列表与层级树
app.get('/collections', async (c) => {
  const user = c.get('user');
  const cfg = await getUserZoteroConfig(c.env.DB, user.id);
  if (!cfg?.zotero_user_id || !cfg.zotero_api_key) {
    return c.json({ detail: '尚未绑定 Zotero，请先配置 User ID 与 API Key' }, 400);
  }

  try {
    const url = `https://api.zotero.org/users/${encodeURIComponent(cfg.zotero_user_id)}/collections?limit=100`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Zotero-API-Key': cfg.zotero_api_key,
        'Zotero-API-Version': ZOTERO_API_VERSION,
        'User-Agent': ZOTERO_USER_AGENT
      }
    });

    if (!resp.ok) {
      return c.json({ detail: `获取 Zotero 收藏夹失败 (HTTP ${resp.status})` }, 502);
    }

    const rawList = await resp.json() as any[];
    const byKey = new Map<string, { key: string; name: string; parentCollection: string | null }>();
    for (const item of (rawList || [])) {
      byKey.set(item.key, {
        key: item.key,
        name: item.data?.name || item.key,
        parentCollection: item.data?.parentCollection || null
      });
    }

    const getPath = (key: string): string => {
      const curr = byKey.get(key);
      if (!curr) return '';
      if (curr.parentCollection) {
        const p = getPath(curr.parentCollection);
        return p ? `${p}/${curr.name}` : curr.name;
      }
      return curr.name;
    };

    const collections = Array.from(byKey.values()).map(col => ({
      key: col.key,
      name: col.name,
      parentCollection: col.parentCollection,
      path: getPath(col.key)
    })).sort((a, b) => a.path.localeCompare(b.path));

    return c.json(collections);
  } catch (err: any) {
    return c.json({ detail: `连接 Zotero 获取收藏夹失败：${err.message || '网络超时'}` }, 502);
  }
});

// 将文献推送到当前用户的 Zotero 库
app.post('/push', async (c) => {
  const user = c.get('user');
  const cfg = await getUserZoteroConfig(c.env.DB, user.id);
  if (!cfg?.zotero_user_id || !cfg.zotero_api_key) {
    return c.json({ detail: '尚未绑定个人 Zotero 账号，请先在个人中心或弹窗中完成配置' }, 400);
  }

  const body = await c.req.json().catch(() => ({}));
  const rawArxiv = String(body.arxiv_id || '').trim();
  const cleanId = rawArxiv.replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim();
  const title = decodeHtmlEntities(String(body.title || cleanId).trim());
  const abstract = decodeHtmlEntities(String(body.abstract || '').trim());
  const publishedDate = String(body.published_date || body.published || '').trim();
  const journal = String(body.journal || '').trim();
  const rawDoi = String(body.doi || '').trim();
  const cleanDoi = rawDoi.replace(/^https?:\/\/doi\.org\//i, '').trim();
  const collectionKey = String(body.collection_key || cfg.zotero_default_collection || '').trim();
  const setAsDefault = Boolean(body.set_as_default_collection);

  if (!title) {
    return c.json({ detail: '文献标题不能为空' }, 400);
  }

  // 若用户指定将此收藏夹设为默认，更新数据库
  if (setAsDefault && collectionKey) {
    await c.env.DB.prepare(
      'UPDATE users SET zotero_default_collection = ? WHERE id = ?'
    ).bind(collectionKey, user.id).run();
  }

  // 1. 拆分作者列表
  let rawAuthors = body.authors;
  if (typeof rawAuthors === 'string') {
    rawAuthors = rawAuthors.split(',').map((s: string) => s.trim()).filter(Boolean);
  } else if (!Array.isArray(rawAuthors)) {
    rawAuthors = [];
  }

  const creators = (rawAuthors as string[]).map((authorName: string) => {
    const trimmed = authorName.trim();
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const lastName = parts.pop() || '';
      const firstName = parts.join(' ');
      return { creatorType: 'author', firstName, lastName };
    }
    return { creatorType: 'author', firstName: '', lastName: trimmed };
  });

  // 2. 组装 Zotero 主文献条目 (preprint 类型)
  const itemPayload: any = {
    itemType: 'preprint',
    title,
    creators,
    genre: 'Preprint',
    repository: 'arXiv',
    archiveID: cleanId ? `arXiv:${cleanId}` : '',
    date: publishedDate,
    url: cleanId ? `https://arxiv.org/abs/${cleanId}` : (body.source_url || ''),
    abstractNote: abstract,
    extra: [
      cleanId ? `arXiv: ${cleanId}` : '',
      journal ? `Publication: ${journal}` : '',
      cleanDoi ? `DOI: ${cleanDoi}` : '',
      'Source: LabOrbit'
    ].filter(Boolean).join('\n'),
    collections: collectionKey ? [collectionKey] : [],
    tags: [
      { tag: 'LabOrbit' },
      cleanId ? { tag: 'arXiv' } : null,
      ...(Array.isArray(body.tags)
        ? body.tags.map((t: any) => String(t || '').trim()).filter(Boolean).map((t: string) => ({ tag: t }))
        : (typeof body.tags === 'string' && body.tags.trim()
            ? body.tags.split(/[,，\n]/).map((s: string) => s.trim()).filter(Boolean).map((t: string) => ({ tag: t }))
            : []))
    ].filter(Boolean)
  };

  if (cleanDoi) {
    itemPayload.DOI = cleanDoi;
  }

  const headers = {
    'Zotero-API-Key': cfg.zotero_api_key,
    'Zotero-API-Version': ZOTERO_API_VERSION,
    'Content-Type': 'application/json',
    'User-Agent': ZOTERO_USER_AGENT
  };

  let parentItemKey = '';
  try {
    const itemUrl = `https://api.zotero.org/users/${encodeURIComponent(cfg.zotero_user_id)}/items`;
    const itemResp = await fetch(itemUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify([itemPayload])
    });

    if (!itemResp.ok) {
      const errText = await itemResp.text().catch(() => '');
      return c.json({ detail: `创建 Zotero 文献条目失败 (HTTP ${itemResp.status})：${errText}` }, 502);
    }

    const itemResult = await itemResp.json() as any;
    const successful = itemResult.successful || {};
    const successList = Object.values(successful) as any[];
    if (!successList.length) {
      const failed = itemResult.failed || {};
      return c.json({ detail: `Zotero 条目保存未被接受：${JSON.stringify(failed)}` }, 400);
    }
    parentItemKey = successList[0].key;
  } catch (err: any) {
    return c.json({ detail: `向 Zotero 提交条目失败：${err.message || '网络连接超时'}` }, 502);
  }

  // 3. 附加 PDF 链接附件 (仅当显式要求 include_pdf === true 时才附加；默认不附加，避免阻碍 Zotero 本地自动抓取真正的 PDF 全文)
  const shouldIncludePdf = Boolean(body.include_pdf === true || body.include_pdf_attachment === true);

  if (shouldIncludePdf && cleanId && parentItemKey) {
    try {
      const pdfAttachment = {
        itemType: 'attachment',
        parentItem: parentItemKey,
        linkMode: 'linked_url',
        title: `arXiv:${cleanId} PDF`,
        url: `https://arxiv.org/pdf/${cleanId}.pdf`,
        contentType: 'application/pdf'
      };
      await fetch(`https://api.zotero.org/users/${encodeURIComponent(cfg.zotero_user_id)}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify([pdfAttachment])
      });
    } catch (e) {
      console.warn('Attach PDF link failed non-fatally:', e);
    }
  }

  // 4. 附加富文本笔记 (包含学术中文翻译、推荐理由与用户研读笔记)
  const titleZh = String(body.title_zh || body.translation?.title || '').trim();
  const abstractZh = String(body.abstract_zh || body.translation?.abstract || '').trim();
  const shouldIncludeTrans = body.include_translation !== undefined ? Boolean(body.include_translation) : true;
  const hasZh = Boolean(shouldIncludeTrans && (titleZh || abstractZh));

  const shouldIncludeComment = body.include_comment !== undefined
    ? Boolean(body.include_comment)
    : (body.include_recommend_comment !== undefined ? Boolean(body.include_recommend_comment) : true);
  const recComment = String(body.recommend_comment || '').trim();
  const hasRec = Boolean(shouldIncludeComment && recComment);
  const customNote = String(body.custom_note || '').trim();
  const hasCustomNote = Boolean(customNote);

  if ((hasZh || hasRec || hasCustomNote) && parentItemKey) {
    try {
      const noteParts: string[] = ['<p><strong>[LabOrbit 文献协同归档记录]</strong></p>'];

      if (hasCustomNote) {
        noteParts.push('<p><strong>研读笔记 (Note)：</strong></p>');
        noteParts.push(`<blockquote><p>${decodeHtmlEntities(customNote).replace(/\n/g, '<br/>')}</p></blockquote>`);
      }

      if (hasRec) {
        const recommender = body.recommender_name ? ` (${body.recommender_name})` : '';
        noteParts.push(`<p><strong>课题组推荐语${recommender}：</strong></p>`);
        noteParts.push(`<blockquote><p>${decodeHtmlEntities(recComment).replace(/\n/g, '<br/>')}</p></blockquote>`);
      }

      if (hasZh) {
        noteParts.push('<p><strong>全篇学术中文译本：</strong></p>');
        if (titleZh) {
          noteParts.push(`<p><strong>【中文标题】</strong>${decodeHtmlEntities(titleZh)}</p>`);
        }
        if (abstractZh) {
          noteParts.push(`<p><strong>【中文摘要】</strong><br/>${decodeHtmlEntities(abstractZh).replace(/\n/g, '<br/>')}</p>`);
        }
      }

      const notePayload = {
        itemType: 'note',
        parentItem: parentItemKey,
        note: noteParts.join(''),
        tags: [{ tag: 'LabOrbit' }, { tag: 'AI-Translation' }]
      };

      await fetch(`https://api.zotero.org/users/${encodeURIComponent(cfg.zotero_user_id)}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify([notePayload])
      });
    } catch (e) {
      console.warn('Attach Zotero note failed non-fatally:', e);
    }
  }


  return c.json({
    ok: true,
    item_key: parentItemKey,
    message: '文献及附件已成功推送到您的 Zotero 库！'
  });
});

export default app;
