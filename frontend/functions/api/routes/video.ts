import { Hono } from 'hono';
import { Env } from '../types';

const app = new Hono<{ Bindings: Env }>();

const TOTAL_SIZE = 105165866;
const CHUNKS = [
  { index: 0, path: '/assets/forecast/raw/earth-orbit-part-00.bin', start: 0, end: 20971519, size: 20971520 },
  { index: 1, path: '/assets/forecast/raw/earth-orbit-part-01.bin', start: 20971520, end: 41943039, size: 20971520 },
  { index: 2, path: '/assets/forecast/raw/earth-orbit-part-02.bin', start: 41943040, end: 62914559, size: 20971520 },
  { index: 3, path: '/assets/forecast/raw/earth-orbit-part-03.bin', start: 62914560, end: 83886079, size: 20971520 },
  { index: 4, path: '/assets/forecast/raw/earth-orbit-part-04.bin', start: 83886080, end: 104857599, size: 20971520 },
  { index: 5, path: '/assets/forecast/raw/earth-orbit-part-05.bin', start: 104857600, end: 105165865, size: 308266 }
];

app.get('/earth-orbit', async (c) => {
  const rangeHeader = c.req.header('range');
  let start = 0;
  let end = TOTAL_SIZE - 1;

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (match) {
      if (match[1]) start = parseInt(match[1], 10);
      if (match[2]) end = parseInt(match[2], 10);
      else end = Math.min(start + 5 * 1024 * 1024 - 1, TOTAL_SIZE - 1);
    }
  } else {
    end = Math.min(2 * 1024 * 1024 - 1, TOTAL_SIZE - 1);
  }

  if (start >= TOTAL_SIZE || end >= TOTAL_SIZE || start > end) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': 'bytes */' + TOTAL_SIZE }
    });
  }

  const chunksToFetch = CHUNKS.filter(chunk => chunk.end >= start && chunk.start <= end);
  const slices: Uint8Array[] = [];

  for (const chunk of chunksToFetch) {
    const chunkRelStart = Math.max(0, start - chunk.start);
    const chunkRelEnd = Math.min(chunk.size - 1, end - chunk.start);
    const chunkUrl = new URL(chunk.path, c.req.url).toString();

    let chunkRes: Response;
    if (c.env.ASSETS) {
      chunkRes = await c.env.ASSETS.fetch(new Request(chunkUrl, {
        headers: { 'Range': 'bytes=' + chunkRelStart + '-' + chunkRelEnd }
      }));
    } else {
      chunkRes = await fetch(chunkUrl, {
        headers: { 'Range': 'bytes=' + chunkRelStart + '-' + chunkRelEnd }
      });
    }

    if (chunkRes.ok || chunkRes.status === 206) {
      const buf = await chunkRes.arrayBuffer();
      if (chunkRes.status === 206) {
        slices.push(new Uint8Array(buf));
      } else {
        const fullArr = new Uint8Array(buf);
        const actualSlice = fullArr.subarray(chunkRelStart, chunkRelEnd + 1);
        slices.push(actualSlice);
      }
    }
  }

  const totalLen = slices.reduce((acc, s) => acc + s.byteLength, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const slice of slices) {
    combined.set(slice, offset);
    offset += slice.byteLength;
  }

  const status = rangeHeader ? 206 : 200;
  return new Response(combined, {
    status,
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(totalLen),
      'Content-Range': 'bytes ' + start + '-' + (start + totalLen - 1) + '/' + TOTAL_SIZE,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  });
});

export default app;
