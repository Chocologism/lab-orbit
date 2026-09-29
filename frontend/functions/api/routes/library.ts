import { Hono } from 'hono';
import { Env, UserRow } from '../types';
import { authMiddleware, adminOnlyMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

app.use('*', authMiddleware);

app.get('', async (c) => {
  const user = c.get('user');
  const q = (c.req.query('q') || '').trim().toLowerCase();
  const source = c.req.query('source') || 'all';

  // 确保 library_papers 包含 seminar_id 字段
  await c.env.DB.prepare('ALTER TABLE library_papers ADD COLUMN seminar_id INTEGER').run().catch(() => {});

  // 查询当前用户有权访问的定向收录文献集合
  const directAccess = await c.env.DB.prepare(
    'SELECT paper_id FROM library_access WHERE user_id = ?'
  ).bind(user.id).all<{ paper_id: number }>();
  const directSet = new Set((directAccess.results || []).map(r => r.paper_id));

  let query = `
    SELECT lp.*,
      COALESCE(
        lp.seminar_id,
        (SELECT sp.seminar_id FROM seminar_presentations sp WHERE (sp.arxiv_id = lp.arxiv_id OR sp.arxiv_id LIKE '%' || lp.arxiv_id || '%') AND sp.seminar_id IS NOT NULL ORDER BY sp.id ASC LIMIT 1),
        (SELECT ss.id FROM seminar_schedules ss JOIN arxiv_papers ap ON ss.paper_id = ap.id WHERE (ap.arxiv_id = lp.arxiv_id OR ap.arxiv_id LIKE '%' || lp.arxiv_id || '%') ORDER BY ss.id ASC LIMIT 1)
      ) AS seminar_id
    FROM library_papers lp
    WHERE 1=1
  `;
  const params: any[] = [];

  if (source === 'recommendation') {
    query += ' AND (lp.from_recommendation = 1 OR lp.id IN (SELECT paper_id FROM library_access WHERE user_id = ?))';
    params.push(user.id);
  } else if (source === 'direct') {
    query += ' AND lp.id IN (SELECT paper_id FROM library_access WHERE user_id = ?)';
    params.push(user.id);
  } else if (source === 'seminar') {
    query += ' AND lp.from_seminar = 1';
  } else {
    query += ' AND (lp.from_recommendation = 1 OR lp.from_seminar = 1 OR lp.id IN (SELECT paper_id FROM library_access WHERE user_id = ?))';
    params.push(user.id);
  }

  if (q) {
    query += ' AND (LOWER(lp.title) LIKE ? OR LOWER(lp.arxiv_id) LIKE ? OR LOWER(lp.authors) LIKE ? OR LOWER(lp.abstract) LIKE ?)';
    const pattern = `%${q}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  query += ' ORDER BY lp.id DESC';

  const stmt = c.env.DB.prepare(query);
  const { results: papers } = await (params.length ? stmt.bind(...params) : stmt).all();

  // 查询用户有权查看的所有推荐信息，用于关联文献库中的推荐人和讨论
  const { results: recResults } = await c.env.DB.prepare(
    `SELECT 
       ap.id AS recommendation_id,
       ap.arxiv_id,
       ap.recommend_comment,
       ap.created_at AS recommend_created_at,
       COALESCE(u.real_name, u.name) AS recommender_name,
       u.identity AS recommender_identity,
       u.avatar AS recommender_avatar,
       lrs.library_id,
       (SELECT COUNT(*) FROM paper_comments pc WHERE pc.paper_id = ap.id) AS comment_count
     FROM arxiv_papers ap
     JOIN users u ON u.id = ap.recommended_by_id
     LEFT JOIN library_recommendation_sources lrs ON lrs.recommendation_id = ap.id
     LEFT JOIN recommendation_audiences ra ON ra.paper_id = ap.id
     LEFT JOIN recommendation_recipients rr ON rr.paper_id = ap.id AND rr.user_id = ?
     WHERE (ra.paper_id IS NULL OR ap.recommended_by_id = ? OR rr.user_id IS NOT NULL)
     ORDER BY ap.id DESC`
  ).bind(user.id, user.id).all();

  const byLibraryId = new Map<number, any>();
  const byArxivId = new Map<string, any>();
  for (const r of (recResults || []) as any[]) {
    if (r.library_id && !byLibraryId.has(Number(r.library_id))) {
      byLibraryId.set(Number(r.library_id), r);
    }
    const cleanId = String(r.arxiv_id || '').replace(/^arxiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase();
    if (cleanId && !byArxivId.has(cleanId)) {
      byArxivId.set(cleanId, r);
    }
  }

  const formatted = (papers || []).map(p => {
    let authorsList: string[] = [];
    try {
      authorsList = JSON.parse(p.authors as string);
    } catch {
      authorsList = [(p.authors as string) || ''];
    }
    const hasDirect = directSet.has(p.id as number);
    const cleanLibArxiv = String(p.arxiv_id || '').replace(/^arxiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase();
    const rec = byLibraryId.get(p.id as number) || (cleanLibArxiv ? byArxivId.get(cleanLibArxiv) : null);

    return {
      ...p,
      from_direct: hasDirect,
      from_recommendation: Boolean(p.from_recommendation || hasDirect || rec),
      from_seminar: Boolean(p.from_seminar),
      seminar_id: p.seminar_id ? Number(p.seminar_id) : null,
      recommendation_id: rec ? Number(rec.recommendation_id) : null,
      recommender_name: rec?.recommender_name || null,
      recommender_identity: rec?.recommender_identity || null,
      recommender_avatar: rec?.recommender_avatar || null,
      recommend_comment: rec?.recommend_comment || '',
      comment_count: rec ? Number(rec.comment_count || 0) : 0,
      authors: authorsList,
    };
  });

  return c.json(formatted);
});

app.delete('/:id', adminOnlyMiddleware, async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  await c.env.DB.prepare('DELETE FROM library_recommendation_sources WHERE library_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM library_aliases WHERE library_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM library_access WHERE paper_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM library_papers WHERE id = ?').bind(id).run();

  return c.json({ message: '文献库条目已成功删除' });
});

export default app;
