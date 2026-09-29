import { Hono } from 'hono';
import { Env, UserRow } from '../types';
import { authMiddleware } from '../middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: { user: UserRow } }>();

app.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.includes('/proxy-markdown') || path.includes('/proxy-pdf')) {
    return next();
  }
  return authMiddleware(c, next);
});

import { extractArxivId, extractAllArxivIds, extractDoi, fetchArxivMetadata, fetchDoiMetadata, ensureArxivSeminarIdColumn, ensureArxivTranslationColumns, ensureArxivFeedViewsTable, decodeHtmlEntities } from '../utils/papers';

function getBeijingDateStr(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

function getBeijingDateFromTimestamp(timestampStr: string): string {
  if (!timestampStr) return '';
  let str = String(timestampStr).trim();
  if (str && !str.endsWith('Z') && !str.includes('+')) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return '';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(d);
}

app.post('/preview', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const input = (body.url_or_id || '').trim();

  // 1. 若输入中包含多篇 arXiv 编号或链接，批量抓取并返回
  const allArxivIds = extractAllArxivIds(input);
  if (allArxivIds.length > 1) {
    try {
      const results = await Promise.allSettled(
        allArxivIds.map(async (id) => {
          return await fetchArxivMetadata(id);
        })
      );
      const papers: any[] = [];
      for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === 'fulfilled' && res.value) {
          papers.push(res.value);
        } else {
          papers.push({
            arxiv_id: allArxivIds[i],
            title: `arXiv:${allArxivIds[i]}`,
            authors: [],
            abstract: '',
            published_date: '',
            primary_category: 'astro-ph',
            pdf_url: `https://arxiv.org/pdf/${allArxivIds[i]}.pdf`,
            source_url: `https://arxiv.org/abs/${allArxivIds[i]}`,
            journal: ''
          });
        }
      }
      return c.json({
        is_batch: true,
        count: papers.length,
        papers,
        ...papers[0]
      });
    } catch (e: any) {
      return c.json({ detail: `批量抓取 arXiv 文献失败: ${e.message}` }, 400);
    }
  }

  const doi = extractDoi(input);
  if (doi && !input.includes('arxiv.org')) {
    try {
      const data = await fetchDoiMetadata(doi);
      return c.json(data);
    } catch (e: any) {
      // Fallback if Crossref fails
    }
  }

  const arxivId = allArxivIds[0] || extractArxivId(input);
  if (arxivId) {
    try {
      const data = await fetchArxivMetadata(arxivId);
      return c.json(data);
    } catch (e: any) {
      return c.json({ detail: `抓取 arXiv 文献失败: ${e.message}` }, 400);
    }
  }

  if (doi) {
    try {
      const data = await fetchDoiMetadata(doi);
      return c.json(data);
    } catch (e: any) {
      return c.json({ detail: `抓取 DOI 元数据失败: ${e.message}` }, 400);
    }
  }

  return c.json({ detail: '未能识别有效的 arXiv ID 或 DOI 链接' }, 400);
});

async function canUserViewPaper(db: any, paperId: number, paperOwnerId: number, userId: number): Promise<boolean> {
  const audience = await db.prepare('SELECT paper_id FROM recommendation_audiences WHERE paper_id = ?').bind(paperId).first();
  if (!audience) return true;
  if (paperOwnerId === userId) return true;
  const recipient = await db.prepare('SELECT user_id FROM recommendation_recipients WHERE paper_id = ? AND user_id = ?').bind(paperId, userId).first();
  return Boolean(recipient);
}

async function syncLibraryRecommendationAccess(db: any, libraryId: number) {
  const sources = await db.prepare('SELECT is_public, user_ids FROM library_recommendation_sources WHERE library_id = ?').bind(libraryId).all<{ is_public: number; user_ids: string }>();
  const rows = sources.results || [];
  const hasPublic = rows.some((r: any) => r.is_public === 1);
  if (hasPublic) {
    await db.prepare('UPDATE library_papers SET from_recommendation = 1 WHERE id = ?').bind(libraryId).run();
  } else {
    await db.prepare('UPDATE library_papers SET from_recommendation = 0 WHERE id = ?').bind(libraryId).run();
  }

  const accessUserIds = new Set<number>();
  for (const r of rows) {
    if (r.is_public === 0 && r.user_ids) {
      try {
        const uids: number[] = JSON.parse(r.user_ids);
        if (Array.isArray(uids)) {
          uids.forEach(uid => accessUserIds.add(uid));
        }
      } catch {}
    }
  }

  await db.prepare('DELETE FROM library_access WHERE paper_id = ?').bind(libraryId).run();
  for (const uid of accessUserIds) {
    await db.prepare('INSERT OR IGNORE INTO library_access (paper_id, user_id) VALUES (?, ?)').bind(libraryId, uid).run();
  }
}

async function formatPaperOut(db: any, p: any, currentUserId: number) {
  let authorsList: string[] = [];
  try {
    authorsList = typeof p.authors === 'string' ? JSON.parse(p.authors) : (p.authors || []);
  } catch {
    authorsList = [String(p.authors || '')];
  }

  // Check if private audience
  const audience = await db.prepare('SELECT paper_id FROM recommendation_audiences WHERE paper_id = ?').bind(p.id).first();
  const isDirect = Boolean(audience);

  let recipients: any[] = [];
  if (isDirect) {
    const { results } = await db.prepare(
      `SELECT u.id, u.name, u.real_name, u.role, u.identity 
       FROM recommendation_recipients rr
       JOIN users u ON u.id = rr.user_id
       WHERE rr.paper_id = ?`
    ).bind(p.id).all();
    recipients = results || [];
  }

  // is_read_by_me (privacy: do not expose aggregate read counts)
  const isReadRow = await db.prepare(
    'SELECT 1 FROM paper_read_marks WHERE paper_id = ? AND user_id = ?'
  ).bind(p.id, currentUserId).first();
  const isReadByMe = Boolean(isReadRow);
  const readCount = 0;

  // Like count & is_liked_by_me
  const likeCountRow = await db.prepare(
    'SELECT count(*) as cnt FROM paper_likes WHERE paper_id = ?'
  ).bind(p.id).first<{ cnt: number }>();
  const likeCount = likeCountRow?.cnt || 0;

  const isLikedRow = await db.prepare(
    'SELECT 1 FROM paper_likes WHERE paper_id = ? AND user_id = ?'
  ).bind(p.id, currentUserId).first();
  const isLikedByMe = Boolean(isLikedRow);

  const recommender = {
    id: p.recommended_by_id,
    name: p.recommender_name || '',
    real_name: p.recommender_real_name || '',
    role: p.recommender_role || 'student',
    identity: p.recommender_identity || 'student',
    avatar: p.recommender_avatar || null,
  };

  // Self-heal/fallback category if missing
  let primaryCategory = (p.primary_category || '').trim();
  let journalName = (p.journal || '').trim();
  if (!primaryCategory && !journalName && p.arxiv_id) {
    const libRow = await db.prepare("SELECT primary_category, journal FROM library_papers WHERE arxiv_id = ? AND primary_category IS NOT NULL AND primary_category != '' LIMIT 1")
      .bind(p.arxiv_id)
      .first<{ primary_category: string; journal: string }>();
    if (libRow?.primary_category) {
      primaryCategory = libRow.primary_category;
      if (!journalName && libRow.journal) journalName = libRow.journal;
    }
  }

  let targetSeminarId = p.effective_seminar_id !== undefined ? p.effective_seminar_id : (p.seminar_id || null);
  let targetSeminarDate = p.seminar_date || null;
  if (!targetSeminarId && p.arxiv_id) {
    const cleanId = String(p.arxiv_id).replace(/^arXiv:/i, '').replace(/v\d+$/, '');
    const sp = await db.prepare(
      `SELECT seminar_id FROM seminar_presentations 
       WHERE (arxiv_id = ? OR arxiv_id = ? OR arxiv_id = ?) AND arxiv_id != '' 
       ORDER BY id DESC LIMIT 1`
    ).bind(p.arxiv_id, cleanId, `arXiv:${cleanId}`).first<{ seminar_id: number }>();
    if (sp?.seminar_id) {
      targetSeminarId = sp.seminar_id;
    }
  }
  if (targetSeminarId && !targetSeminarDate) {
    const sem = await db.prepare('SELECT date FROM seminar_schedules WHERE id = ?').bind(targetSeminarId).first<{ date: string }>();
    if (sem?.date) {
      targetSeminarDate = sem.date;
    }
  }
  const todayStr = getBeijingDateStr();
  const isSeminarToday = Boolean(targetSeminarId && targetSeminarDate && targetSeminarDate === todayStr);
  const paperRecommendDate = getBeijingDateFromTimestamp(p.created_at);
  const isRecommendedToday = Boolean(paperRecommendDate && paperRecommendDate === todayStr);
  const isTeacherPinned = Boolean(p.is_pinned && recommender.identity === 'teacher' && isRecommendedToday);
  const effectiveIsPinned = isTeacherPinned || isSeminarToday;

  return {
    id: p.id,
    arxiv_id: p.arxiv_id,
    title: decodeHtmlEntities(p.title || ''),
    journal: journalName,
    source_url: p.source_url || '',
    authors: authorsList,
    abstract: decodeHtmlEntities(p.abstract || ''),
    primary_category: primaryCategory,
    published_date: p.published_date || '',
    pdf_url: p.pdf_url || '',
    recommend_comment: decodeHtmlEntities(p.recommend_comment || ''),
    is_pinned: effectiveIsPinned,
    is_teacher_pinned: isTeacherPinned,
    is_seminar_today: isSeminarToday,
    seminar_id: targetSeminarId ? Number(targetSeminarId) : null,
    seminar_date: targetSeminarDate,
    created_at: p.created_at || '',
    recommend_date: paperRecommendDate,
    is_recommended_today: isRecommendedToday,
    visibility: isDirect ? 'direct' : 'public',
    recommender,
    recipients,
    read_count: readCount,
    is_read_by_me: isReadByMe,
    is_read: isReadByMe,
    like_count: likeCount,
    is_liked_by_me: isLikedByMe,
    is_liked: isLikedByMe,
    title_zh: decodeHtmlEntities(p.title_zh || ''),
    abstract_zh: decodeHtmlEntities(p.abstract_zh || ''),
    translated_by_id: p.translated_by_id || null,
    translated_at: p.translated_at || '',
  };
}

app.post('/recommend', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));

  const arxiv_id = (body.arxiv_id || '').trim();
  const title = (body.title || '').trim();
  const authors = Array.isArray(body.authors) ? JSON.stringify(body.authors) : (body.authors || '[]');
  const abstract = body.abstract || '';
  let primary_category = (body.primary_category || '').trim();
  const published_date = body.published_date || '';
  const pdf_url = body.pdf_url || '';
  const recommend_comment = body.recommend_comment || '';
  let journal = (body.journal || '').trim();
  const source_url = body.source_url || '';

  // 严格按学术身份：只有导师推荐才标记为导师重点，学生管理员推送仍为普通推荐
  const is_teacher = user.identity === 'teacher';
  const is_pinned = is_teacher ? 1 : 0;

  const visibility = body.visibility || (body.is_public === false ? 'direct' : 'public');
  const is_direct = visibility === 'direct';
  const recipient_ids: number[] = Array.isArray(body.recipient_ids) ? body.recipient_ids : [];

  if (!arxiv_id || !title) {
    return c.json({ detail: '论文标识与标题不能为空' }, 400);
  }

  // 若分类与期刊为空且存在 arXiv 编号，自动抓取补全分类
  if (!primary_category && !journal && arxiv_id) {
    const cleanArxiv = extractArxivId(arxiv_id);
    if (cleanArxiv) {
      try {
        const meta = await fetchArxivMetadata(cleanArxiv);
        if (meta.primary_category) primary_category = meta.primary_category;
        if (!journal && meta.journal) journal = meta.journal;
      } catch {}
    }
  }

  // Insert into arxiv_papers
  const res = await c.env.DB.prepare(
    `INSERT INTO arxiv_papers 
     (arxiv_id, title, authors, abstract, primary_category, published_date, pdf_url, recommended_by_id, recommend_comment, is_pinned, journal, source_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).bind(arxiv_id, title, authors, abstract, primary_category, published_date, pdf_url, user.id, recommend_comment, is_pinned, journal, source_url).run();

  const paperId = res.meta.last_row_id;

  // Handle visibility audience
  if (is_direct) {
    await c.env.DB.prepare('INSERT INTO recommendation_audiences (paper_id) VALUES (?)').bind(paperId).run();
    for (const rId of recipient_ids) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO recommendation_recipients (paper_id, user_id) VALUES (?, ?)').bind(paperId, rId).run();
    }
  }

  // Archive into library_papers if not exists
  let libPaper = await c.env.DB.prepare('SELECT id FROM library_papers WHERE arxiv_id = ?').bind(arxiv_id).first<{ id: number }>();
  if (!libPaper) {
    const libRes = await c.env.DB.prepare(
      `INSERT INTO library_papers 
       (arxiv_id, title, authors, abstract, primary_category, published_date, pdf_url, metadata_status, from_recommendation, journal, source_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, datetime('now'))`
    ).bind(arxiv_id, title, authors, abstract, primary_category, published_date, pdf_url, is_direct ? 0 : 1, journal, source_url).run();
    libPaper = { id: libRes.meta.last_row_id as number };
  } else {
    if (!is_direct) {
      await c.env.DB.prepare('UPDATE library_papers SET from_recommendation = 1 WHERE id = ?').bind(libPaper.id).run();
    }
  }

  // Record recommendation source for library
  const userIdsForSource = is_direct ? Array.from(new Set([user.id, ...recipient_ids])) : [];
  await c.env.DB.prepare(
    `INSERT INTO library_recommendation_sources (library_id, recommendation_id, is_public, user_ids)
     VALUES (?, ?, ?, ?)`
  ).bind(libPaper.id, paperId, is_direct ? 0 : 1, JSON.stringify(userIdsForSource)).run();

  if (is_direct) {
    for (const uid of userIdsForSource) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO library_access (paper_id, user_id) VALUES (?, ?)').bind(libPaper.id, uid).run();
    }
  }
  await syncLibraryRecommendationAccess(c.env.DB, libPaper.id);

  await ensureArxivFeedViewsTable(c.env.DB);
  await c.env.DB.prepare(`
    INSERT INTO arxiv_feed_views (user_id, last_paper_id, last_viewed_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      last_paper_id = MAX(COALESCE(arxiv_feed_views.last_paper_id, 0), excluded.last_paper_id),
      last_viewed_at = datetime('now')
  `).bind(user.id, paperId).run().catch(() => {});

  const rawPaper = await c.env.DB.prepare(
    `SELECT p.*, u.name as recommender_name, u.real_name as recommender_real_name, u.role as recommender_role, u.identity as recommender_identity, u.avatar as recommender_avatar
     FROM arxiv_papers p
     JOIN users u ON u.id = p.recommended_by_id
     WHERE p.id = ?`
  ).bind(paperId).first();

  const formatted = await formatPaperOut(c.env.DB, rawPaper, user.id);
  return c.json(formatted);
});

app.get('/feed', async (c) => {
  const user = c.get('user');
  const scope = c.req.query('scope') || 'all';

  await ensureArxivSeminarIdColumn(c.env.DB);
  await ensureArxivTranslationColumns(c.env.DB);
  const todayStr = getBeijingDateStr();

  // 批量并发查询：将原先 O(N) 的 200+ 次串行网络往返缩减为 1 次并行查询
  const [papersRes, audRes, recipRes, readsRes, likesRes, commentsRes] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.*, 
              COALESCE(
                p.seminar_id,
                (SELECT sp.seminar_id FROM seminar_presentations sp WHERE (sp.arxiv_id = p.arxiv_id OR sp.arxiv_id = REPLACE(p.arxiv_id, 'arXiv:', '')) AND sp.arxiv_id != '' ORDER BY sp.id DESC LIMIT 1),
                (SELECT ss.id FROM seminar_schedules ss WHERE ss.paper_id = p.id ORDER BY ss.id DESC LIMIT 1)
              ) AS effective_seminar_id,
              s.date AS seminar_date,
              u.name as recommender_name, 
              u.real_name as recommender_real_name, 
              u.role as recommender_role, 
              u.identity as recommender_identity, 
              u.avatar as recommender_avatar
       FROM arxiv_papers p
       LEFT JOIN users u ON u.id = p.recommended_by_id
       LEFT JOIN seminar_schedules s ON s.id = COALESCE(
         p.seminar_id,
         (SELECT sp2.seminar_id FROM seminar_presentations sp2 WHERE (sp2.arxiv_id = p.arxiv_id OR sp2.arxiv_id = REPLACE(p.arxiv_id, 'arXiv:', '')) AND sp2.arxiv_id != '' ORDER BY sp2.id DESC LIMIT 1),
         (SELECT ss2.id FROM seminar_schedules ss2 WHERE ss2.paper_id = p.id ORDER BY ss2.id DESC LIMIT 1)
       )
       ORDER BY p.id DESC`
    ).all(),
    c.env.DB.prepare('SELECT paper_id FROM recommendation_audiences').all(),
    c.env.DB.prepare(
      `SELECT rr.paper_id, u.id, u.name, u.real_name, u.role, u.identity 
       FROM recommendation_recipients rr
       JOIN users u ON u.id = rr.user_id`
    ).all(),
    c.env.DB.prepare(
      `SELECT paper_id FROM paper_read_marks WHERE user_id = ?`
    ).bind(user.id).all(),
    c.env.DB.prepare(
      `SELECT paper_id, 
              COUNT(*) as cnt, 
              MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) as liked_by_me 
       FROM paper_likes 
       GROUP BY paper_id`
    ).bind(user.id).all(),
    c.env.DB.prepare(
      `SELECT c.id, c.paper_id, c.user_id, c.content, c.created_at,
              u.name as user_name, u.real_name as user_real_name, u.nickname as user_nickname,
              u.avatar as user_avatar, u.role as user_role, u.identity as user_identity
       FROM paper_comments c
       JOIN users u ON u.id = c.user_id
       ORDER BY c.id ASC`
    ).all(),
  ]);

  const rawPapers = (papersRes.results || []) as any[];
  const directAudienceSet = new Set(((audRes.results || []) as any[]).map(r => r.paper_id));

  const recipientsMap = new Map<number, any[]>();
  for (const r of ((recipRes.results || []) as any[])) {
    if (!recipientsMap.has(r.paper_id)) recipientsMap.set(r.paper_id, []);
    recipientsMap.get(r.paper_id)!.push({
      id: r.id,
      name: r.name,
      real_name: r.real_name,
      role: r.role,
      identity: r.identity,
    });
  }

  const myReadPaperIds = new Set(((readsRes.results || []) as any[]).map(r => r.paper_id));

  const likesMap = new Map<number, { count: number; isLiked: boolean }>();
  for (const l of ((likesRes.results || []) as any[])) {
    likesMap.set(l.paper_id, { count: l.cnt, isLiked: Boolean(l.liked_by_me) });
  }

  const commentsMap = new Map<number, any[]>();
  for (const c of ((commentsRes.results || []) as any[])) {
    if (!commentsMap.has(c.paper_id)) commentsMap.set(c.paper_id, []);
    let createdIso = String(c.created_at || '').trim();
    if (createdIso && !createdIso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(createdIso)) {
      createdIso = createdIso.replace(' ', 'T') + 'Z';
    }
    commentsMap.get(c.paper_id)!.push({
      id: c.id,
      paper_id: c.paper_id,
      user_id: c.user_id,
      content: c.content,
      created_at: createdIso,
      user: {
        id: c.user_id,
        name: c.user_name,
        real_name: c.user_real_name,
        nickname: c.user_nickname,
        avatar: c.user_avatar,
        role: c.user_role,
        identity: c.user_identity,
      }
    });
  }

  const formattedList = [];
  for (const p of rawPapers) {
    let authorsList: string[] = [];
    try {
      authorsList = typeof p.authors === 'string' ? JSON.parse(p.authors) : (p.authors || []);
    } catch {
      authorsList = [String(p.authors || '')];
    }

    const isDirect = directAudienceSet.has(p.id);
    const recipients = isDirect ? (recipientsMap.get(p.id) || []) : [];
    const isReadByMe = myReadPaperIds.has(p.id);
    const likeInfo = likesMap.get(p.id) || { count: 0, isLiked: false };

    const recommender = {
      id: p.recommended_by_id,
      name: p.recommender_name || '',
      real_name: p.recommender_real_name || '',
      role: p.recommender_role || 'student',
      identity: p.recommender_identity || 'student',
      avatar: p.recommender_avatar || null,
    };

    const targetSeminarId = p.effective_seminar_id ? Number(p.effective_seminar_id) : (p.seminar_id ? Number(p.seminar_id) : null);
    const targetSeminarDate = p.seminar_date ? String(p.seminar_date).trim() : null;
    const isSeminarToday = Boolean(targetSeminarId && targetSeminarDate && targetSeminarDate === todayStr);
    const paperRecommendDate = getBeijingDateFromTimestamp(p.created_at);
    const isRecommendedToday = Boolean(paperRecommendDate && paperRecommendDate === todayStr);
    const isTeacherPinned = Boolean(p.is_pinned && recommender.identity === 'teacher' && isRecommendedToday);
    const effectiveIsPinned = isTeacherPinned || isSeminarToday;

    const item = {
      id: p.id,
      arxiv_id: p.arxiv_id,
      title: decodeHtmlEntities(p.title || ''),
      journal: (p.journal || '').trim(),
      source_url: p.source_url || '',
      authors: authorsList,
      abstract: decodeHtmlEntities(p.abstract || ''),
      primary_category: (p.primary_category || '').trim(),
      published_date: p.published_date || '',
      pdf_url: p.pdf_url || '',
      recommend_comment: decodeHtmlEntities(p.recommend_comment || ''),
      is_pinned: effectiveIsPinned,
      is_teacher_pinned: isTeacherPinned,
      is_seminar_today: isSeminarToday,
      seminar_id: targetSeminarId,
      seminar_date: targetSeminarDate,
      created_at: p.created_at || '',
      recommend_date: paperRecommendDate,
      is_recommended_today: isRecommendedToday,
      visibility: isDirect ? 'direct' : 'public',
      recommender,
      recipients,
      read_count: 0,
      is_read_by_me: isReadByMe,
      is_read: isReadByMe,
      like_count: likeInfo.count,
      is_liked_by_me: likeInfo.isLiked,
      is_liked: likeInfo.isLiked,
      title_zh: decodeHtmlEntities(p.title_zh || ''),
      abstract_zh: decodeHtmlEntities(p.abstract_zh || ''),
      translated_by_id: p.translated_by_id || null,
      translated_at: p.translated_at || '',
      comments: commentsMap.get(p.id) || [],
    };

    // Visibility permission check
    if (item.visibility === 'direct') {
      const isRecommender = item.recommender.id === user.id;
      const isRecipient = item.recipients.some((r: any) => r.id === user.id);
      if (!isRecommender && !isRecipient) {
        continue;
      }
    }

    // Filter by scope
    if (scope === 'public' && item.visibility !== 'public') {
      continue;
    }
    if (scope === 'received') {
      if (item.visibility !== 'direct' || !item.recipients.some((r: any) => r.id === user.id) || item.recommender.id === user.id) {
        continue;
      }
    }
    if (scope === 'sent' || scope === 'mine') {
      if (item.recommender.id !== user.id) {
        continue;
      }
    }
    if (scope === 'teacher') {
      if (item.recommender.identity !== 'teacher') {
        continue;
      }
    }
    if (scope === 'unread') {
      if (item.is_read_by_me) {
        continue;
      }
    }

    formattedList.push(item);
  }

  // 排序规则：置顶文献（导师重点或今日组会）排在最前；同等置顶状态下按 ID 降序（最新推荐在前）
  formattedList.sort((a, b) => {
    const pinA = a.is_pinned ? 1 : 0;
    const pinB = b.is_pinned ? 1 : 0;
    if (pinA !== pinB) {
      return pinB - pinA;
    }
    return b.id - a.id;
  });

  return c.json(formattedList);
});

app.get('/unread-summary', async (c) => {
  const user = c.get('user');
  try {
    await ensureArxivFeedViewsTable(c.env.DB);

    const viewRecord = await c.env.DB.prepare(
      'SELECT last_paper_id, last_viewed_at FROM arxiv_feed_views WHERE user_id = ?'
    ).bind(user.id).first<{ last_paper_id: number; last_viewed_at: string }>();

    let list: any[] = [];
    if (viewRecord && viewRecord.last_paper_id !== null && viewRecord.last_paper_id !== undefined) {
      // 用户已有查看记录：统计自上次查看后新出现的文献推荐
      const { results } = await c.env.DB.prepare(
        `SELECT 
           p.id,
           CASE WHEN ra.paper_id IS NOT NULL THEN 1 ELSE 0 END AS is_direct
         FROM arxiv_papers p
         LEFT JOIN recommendation_audiences ra ON ra.paper_id = p.id
         LEFT JOIN recommendation_recipients rr ON rr.paper_id = p.id AND rr.user_id = ?
         WHERE p.recommended_by_id != ?
           AND p.id > ?
           AND (ra.paper_id IS NULL OR rr.user_id IS NOT NULL)`
      ).bind(user.id, user.id, viewRecord.last_paper_id).all();
      list = (results || []) as any[];
    } else {
      // 尚未有查看记录的新用户：首次统计未读文献
      const { results } = await c.env.DB.prepare(
        `SELECT 
           p.id,
           CASE WHEN ra.paper_id IS NOT NULL THEN 1 ELSE 0 END AS is_direct
         FROM arxiv_papers p
         LEFT JOIN paper_read_marks rm ON rm.paper_id = p.id AND rm.user_id = ?
         LEFT JOIN recommendation_audiences ra ON ra.paper_id = p.id
         LEFT JOIN recommendation_recipients rr ON rr.paper_id = p.id AND rr.user_id = ?
         WHERE p.recommended_by_id != ?
           AND rm.id IS NULL
           AND (ra.paper_id IS NULL OR rr.user_id IS NOT NULL)`
      ).bind(user.id, user.id, user.id).all();
      list = (results || []) as any[];
    }

    const unreadCount = list.length;
    const hasDirect = list.some(r => Number(r.is_direct) === 1);

    return c.json({
      unread_count: unreadCount,
      has_direct: hasDirect,
      last_paper_id: viewRecord?.last_paper_id ?? null
    });
  } catch (err: any) {
    console.error('Error getting unread summary:', err);
    return c.json({ unread_count: 0, has_direct: false });
  }
});

app.post('/mark-viewed', async (c) => {
  const user = c.get('user');
  try {
    await ensureArxivFeedViewsTable(c.env.DB);
    const maxPaper = await c.env.DB.prepare('SELECT MAX(id) as max_id FROM arxiv_papers').first<{ max_id: number }>();
    const maxId = maxPaper?.max_id || 0;

    await c.env.DB.prepare(`
      INSERT INTO arxiv_feed_views (user_id, last_paper_id, last_viewed_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        last_paper_id = excluded.last_paper_id,
        last_viewed_at = datetime('now')
    `).bind(user.id, maxId).run();

    return c.json({ success: true, last_paper_id: maxId });
  } catch (err: any) {
    console.error('Error marking feed as viewed:', err);
    return c.json({ success: false, detail: err.message }, 500);
  }
});

app.post('/mark-all-read', async (c) => {
  const user = c.get('user');
  try {
    await c.env.DB.prepare(`
      INSERT OR IGNORE INTO paper_read_marks (paper_id, user_id, created_at)
      SELECT p.id, ?, datetime('now')
      FROM arxiv_papers p
      LEFT JOIN recommendation_audiences ra ON ra.paper_id = p.id
      LEFT JOIN recommendation_recipients rr ON rr.paper_id = p.id AND rr.user_id = ?
      WHERE p.recommended_by_id != ?
        AND (ra.paper_id IS NULL OR rr.user_id IS NOT NULL)
    `).bind(user.id, user.id, user.id).run();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Error marking all as read:', err);
    return c.json({ success: false, detail: err.message }, 500);
  }
});

app.put('/:id/visibility', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));

  const paper = await c.env.DB.prepare('SELECT * FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) return c.json({ detail: '未找到该文献' }, 404);
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  if (paper.recommended_by_id !== user.id) {
    return c.json({ detail: '只有推荐人本人可以编辑可见范围' }, 403);
  }

  // Update recommend_comment if provided in payload
  if (body.recommend_comment !== undefined) {
    const commentVal = String(body.recommend_comment || '').trim();
    await c.env.DB.prepare('UPDATE arxiv_papers SET recommend_comment = ? WHERE id = ?')
      .bind(commentVal, paperId)
      .run();
  }

  const visibility = body.visibility || 'public';
  const recipient_ids: number[] = Array.isArray(body.recipient_ids) ? body.recipient_ids : [];

  if (visibility === 'direct') {
    await c.env.DB.prepare('INSERT OR IGNORE INTO recommendation_audiences (paper_id) VALUES (?)').bind(paperId).run();
    await c.env.DB.prepare('DELETE FROM recommendation_recipients WHERE paper_id = ?').bind(paperId).run();
    for (const rId of recipient_ids) {
      await c.env.DB.prepare('INSERT OR IGNORE INTO recommendation_recipients (paper_id, user_id) VALUES (?, ?)').bind(paperId, rId).run();
    }
  } else {
    await c.env.DB.prepare('DELETE FROM recommendation_recipients WHERE paper_id = ?').bind(paperId).run();
    await c.env.DB.prepare('DELETE FROM recommendation_audiences WHERE paper_id = ?').bind(paperId).run();
  }

  // Synchronize library archiving provenance
  const libSource = await c.env.DB.prepare('SELECT library_id FROM library_recommendation_sources WHERE recommendation_id = ?').bind(paperId).first<{ library_id: number }>();
  if (libSource) {
    const userIdsForSource = visibility === 'direct' ? Array.from(new Set([paper.recommended_by_id, ...recipient_ids])) : [];
    await c.env.DB.prepare(
      'UPDATE library_recommendation_sources SET is_public = ?, user_ids = ? WHERE recommendation_id = ?'
    ).bind(visibility === 'direct' ? 0 : 1, JSON.stringify(userIdsForSource), paperId).run();
    await syncLibraryRecommendationAccess(c.env.DB, libSource.library_id);
  }

  const rawPaper = await c.env.DB.prepare(
    `SELECT p.*, u.name as recommender_name, u.real_name as recommender_real_name, u.role as recommender_role, u.identity as recommender_identity, u.avatar as recommender_avatar
     FROM arxiv_papers p
     JOIN users u ON u.id = p.recommended_by_id
     WHERE p.id = ?`
  ).bind(paperId).first();

  const formatted = await formatPaperOut(c.env.DB, rawPaper, user.id);
  return c.json(formatted);
});

app.put('/:id', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));

  const paper = await c.env.DB.prepare('SELECT * FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) return c.json({ detail: '未找到该文献' }, 404);
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  if (paper.recommended_by_id !== user.id && user.role !== 'admin') {
    return c.json({ detail: '只有文献上传者本人或管理员可以编辑文献' }, 403);
  }

  const updates: string[] = [];
  const binds: any[] = [];

  if (body.recommend_comment !== undefined) {
    updates.push('recommend_comment = ?');
    binds.push(String(body.recommend_comment || '').trim());
  }
  if (body.title !== undefined && String(body.title).trim()) {
    updates.push('title = ?');
    binds.push(String(body.title).trim());
  }
  if (body.journal !== undefined) {
    updates.push('journal = ?');
    binds.push(String(body.journal || '').trim());
  }
  if (body.abstract !== undefined) {
    updates.push('abstract = ?');
    binds.push(String(body.abstract || '').trim());
  }

  if (updates.length > 0) {
    binds.push(paperId);
    await c.env.DB.prepare(`UPDATE arxiv_papers SET ${updates.join(', ')} WHERE id = ?`).bind(...binds).run();
  }

  const rawPaper = await c.env.DB.prepare(
    `SELECT p.*, u.name as recommender_name, u.real_name as recommender_real_name, u.role as recommender_role, u.identity as recommender_identity, u.avatar as recommender_avatar
     FROM arxiv_papers p
     JOIN users u ON u.id = p.recommended_by_id
     WHERE p.id = ?`
  ).bind(paperId).first();

  const formatted = await formatPaperOut(c.env.DB, rawPaper, user.id);
  return c.json(formatted);
});

app.post('/:id/like', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);

  const paper = await c.env.DB.prepare('SELECT id, recommended_by_id FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM paper_likes WHERE paper_id = ? AND user_id = ?'
  ).bind(paperId, user.id).first();

  if (existing) {
    await c.env.DB.prepare('DELETE FROM paper_likes WHERE paper_id = ? AND user_id = ?').bind(paperId, user.id).run();
  } else {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO paper_likes (paper_id, user_id, created_at) VALUES (?, ?, datetime(\'now\'))'
    ).bind(paperId, user.id).run();
  }

  const cntRow = await c.env.DB.prepare(
    'SELECT count(*) as cnt FROM paper_likes WHERE paper_id = ?'
  ).bind(paperId).first<{ cnt: number }>();

  return c.json({
    is_liked: !existing,
    like_count: cntRow?.cnt || 0,
  });
});

app.post('/:id/read-toggle', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);

  const paper = await c.env.DB.prepare('SELECT id, recommended_by_id FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM paper_read_marks WHERE paper_id = ? AND user_id = ?'
  ).bind(paperId, user.id).first();

  if (existing) {
    await c.env.DB.prepare('DELETE FROM paper_read_marks WHERE paper_id = ? AND user_id = ?').bind(paperId, user.id).run();
    return c.json({ is_read: false });
  } else {
    await c.env.DB.prepare(
      'INSERT INTO paper_read_marks (paper_id, user_id, created_at) VALUES (?, ?, datetime(\'now\'))'
    ).bind(paperId, user.id).run();
    return c.json({ is_read: true });
  }
});

app.post('/:id/translate', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const title_zh = (body.title_zh || '').trim();
  const abstract_zh = (body.abstract_zh || '').trim();

  if (!title_zh && !abstract_zh) {
    return c.json({ detail: '翻译标题或摘要不能为空' }, 400);
  }

  await ensureArxivTranslationColumns(c.env.DB);

  const paper = await c.env.DB.prepare('SELECT id, arxiv_id, recommended_by_id, title_zh, abstract_zh FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  const hasExistingTranslation = Boolean((paper.title_zh || '').trim() && (paper.abstract_zh || '').trim());
  if (hasExistingTranslation && user.role !== 'admin') {
    return c.json({ detail: '该文献已有团队共享译本，仅管理员可重新翻译' }, 403);
  }

  const arxivId = (paper.arxiv_id || '').trim();
  if (arxivId) {
    await c.env.DB.prepare(
      `UPDATE arxiv_papers 
       SET title_zh = ?, abstract_zh = ?, translated_by_id = ?, translated_at = datetime('now')
       WHERE id = ? OR arxiv_id = ?`
    ).bind(title_zh, abstract_zh, user.id, paperId, arxivId).run();
  } else {
    await c.env.DB.prepare(
      `UPDATE arxiv_papers 
       SET title_zh = ?, abstract_zh = ?, translated_by_id = ?, translated_at = datetime('now')
       WHERE id = ?`
    ).bind(title_zh, abstract_zh, user.id, paperId).run();
  }

  return c.json({
    success: true,
    paper_id: paperId,
    title_zh,
    abstract_zh,
    translated_by_id: user.id,
    translated_at: new Date().toISOString()
  });
});

app.get('/:id/comments', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);
  const sinceId = parseInt(c.req.query('since_id') || '0', 10);

  const paper = await c.env.DB.prepare('SELECT id, recommended_by_id FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  let query = `
    SELECT c.id, c.paper_id, c.user_id, c.content, c.created_at,
           u.name as user_name, u.real_name as user_real_name, u.nickname as user_nickname,
           u.avatar as user_avatar, u.role as user_role, u.identity as user_identity
    FROM paper_comments c
    JOIN users u ON u.id = c.user_id
    WHERE c.paper_id = ?
  `;
  const binds: any[] = [paperId];

  if (sinceId > 0) {
    query += ` AND c.id > ?`;
    binds.push(sinceId);
  }

  query += ` ORDER BY c.id ASC`;

  const res = await c.env.DB.prepare(query).bind(...binds).all<any>();
  const comments = (res.results || []).map(c => {
    let createdIso = String(c.created_at || '').trim();
    if (createdIso && !createdIso.endsWith('Z') && !/[+-]\d{2}:?\d{2}$/.test(createdIso)) {
      createdIso = createdIso.replace(' ', 'T') + 'Z';
    }
    return {
      id: c.id,
      paper_id: c.paper_id,
      user_id: c.user_id,
      content: c.content,
      created_at: createdIso,
      user: {
        id: c.user_id,
        name: c.user_name,
        real_name: c.user_real_name,
        nickname: c.user_nickname,
        avatar: c.user_avatar,
        role: c.user_role,
        identity: c.user_identity,
      }
    };
  });

  return c.json(comments);
});

app.post('/:id/comments', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);
  const body = await c.req.json().catch(() => ({}));
  const content = (body.content || '').trim();

  if (!content) {
    return c.json({ detail: '讨论内容不能为空' }, 400);
  }
  if (content.length > 500) {
    return c.json({ detail: '讨论内容过长，请精简在 500 字以内' }, 400);
  }

  const paper = await c.env.DB.prepare('SELECT id, recommended_by_id FROM arxiv_papers WHERE id = ?').bind(paperId).first<any>();
  if (!paper) {
    return c.json({ detail: '未找到该文献' }, 404);
  }
  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '未找到该文献' }, 404);
  }

  const res = await c.env.DB.prepare(
    'INSERT INTO paper_comments (paper_id, user_id, content, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).bind(paperId, user.id, content).run();

  const newId = res.meta.last_row_id;
  return c.json({
    id: newId,
    paper_id: paperId,
    user_id: user.id,
    content,
    created_at: new Date().toISOString(),
    user: {
      id: user.id,
      name: user.name,
      real_name: user.real_name,
      nickname: user.nickname,
      avatar: user.avatar,
      role: user.role,
      identity: user.identity,
    }
  });
});

app.delete('/comments/:commentId', async (c) => {
  const user = c.get('user');
  const commentId = parseInt(c.req.param('commentId'), 10);

  const comment = await c.env.DB.prepare('SELECT * FROM paper_comments WHERE id = ?').bind(commentId).first<any>();
  if (!comment) {
    return c.json({ detail: '未找到该讨论留言' }, 404);
  }

  const paper = await c.env.DB.prepare('SELECT id, recommended_by_id FROM arxiv_papers WHERE id = ?').bind(comment.paper_id).first<any>();
  if (paper) {
    const canView = await canUserViewPaper(c.env.DB, paper.id, paper.recommended_by_id, user.id);
    if (!canView) {
      return c.json({ detail: '未找到该讨论留言' }, 404);
    }
  }

  if (comment.user_id !== user.id && user.role !== 'admin') {
    return c.json({ detail: '无权删除他人的讨论留言' }, 403);
  }

  await c.env.DB.prepare('DELETE FROM paper_comments WHERE id = ?').bind(commentId).run();
  return c.json({ message: '讨论留言已删除' });
});

app.delete('/:id', async (c) => {
  const user = c.get('user');
  const paperId = parseInt(c.req.param('id'), 10);

  const paper = await c.env.DB.prepare('SELECT * FROM arxiv_papers WHERE id = ?').bind(paperId).first<{ id: number; recommended_by_id: number }>();
  if (!paper) return c.json({ detail: '文献不存在' }, 404);

  const canView = await canUserViewPaper(c.env.DB, paperId, paper.recommended_by_id, user.id);
  if (!canView) {
    return c.json({ detail: '文献不存在' }, 404);
  }

  const directAudience = await c.env.DB.prepare('SELECT paper_id FROM recommendation_audiences WHERE paper_id = ?').bind(paperId).first();
  if (directAudience) {
    if (paper.recommended_by_id !== user.id) {
      return c.json({ detail: '仅推荐人本人可以删除定向推荐' }, 403);
    }
  } else {
    if (paper.recommended_by_id !== user.id && user.role !== 'admin') {
      return c.json({ detail: '仅推荐人或管理员可以删除推荐' }, 403);
    }
  }

  const libSource = await c.env.DB.prepare('SELECT library_id FROM library_recommendation_sources WHERE recommendation_id = ?').bind(paperId).first<{ library_id: number }>();
  await c.env.DB.prepare('DELETE FROM paper_comments WHERE paper_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM paper_likes WHERE paper_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM paper_read_marks WHERE paper_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM recommendation_recipients WHERE paper_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM recommendation_audiences WHERE paper_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM library_recommendation_sources WHERE recommendation_id = ?').bind(paperId).run();
  await c.env.DB.prepare('DELETE FROM arxiv_papers WHERE id = ?').bind(paperId).run();

  if (libSource) {
    await syncLibraryRecommendationAccess(c.env.DB, libSource.library_id);
  }

  return c.json({ message: '推荐文献已成功删除' });
});

app.get('/proxy-markdown/:id', async (c) => {
  const rawId = c.req.param('id');
  const cleanId = extractArxivId(rawId) || rawId.trim();
  try {
    const res = await fetch(`https://www.alphaxiv.org/abs/${cleanId}.md`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LabHub/1.0)' }
    });
    if (res.ok) {
      const text = await res.text();
      return c.text(text, 200, {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
    }
    return c.json({ error: `alphaXiv returned ${res.status}` }, res.status as any);
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to fetch markdown' }, 502);
  }
});

app.get('/proxy-pdf/:id', async (c) => {
  const rawId = c.req.param('id');
  const cleanId = extractArxivId(rawId) || rawId.trim();
  try {
    const res = await fetch(`https://arxiv.org/pdf/${cleanId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LabHub/1.0)' }
    });
    if (res.ok) {
      const buf = await res.arrayBuffer();
      return c.body(buf, 200, {
        'Content-Type': 'application/pdf',
        'Access-Control-Allow-Origin': '*'
      });
    }
    return c.json({ error: `arXiv returned ${res.status}` }, res.status as any);
  } catch (e: any) {
    return c.json({ error: e.message || 'Failed to fetch PDF' }, 502);
  }
});

export default app;
