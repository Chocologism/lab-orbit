from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..database import get_db
from ..models import ObservatoryTalk, User
from ..schemas import TalkInput
from ..services.email_service import parse_mail
from .files import MAX_BYTES, store_file

router = APIRouter(prefix='/api/talks', tags=['Talks'])


@router.post('/parse-email')
async def preview_email(file: UploadFile = File(None), text: str = Form(''),
                        user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if file:
        if not (file.filename or '').lower().endswith(('.eml', '.txt', '.html', '.htm')):
            raise HTTPException(400, '邮件支持 .eml、.txt 或 .html；也可直接粘贴正文')
        content, filename = await file.read(MAX_BYTES + 1), file.filename
    else:
        content, filename = text.encode(), 'mail.txt'
    if not content or len(content) > MAX_BYTES:
        raise HTTPException(400, '邮件不能为空且不得超过 15 MB')
    try:
        data, attachments = parse_mail(content, filename)
    except (ValueError, LookupError) as exc:
        raise HTTPException(400, str(exc))
    cid_urls = {}
    uploaded = []
    for attachment in attachments:
        url = store_file(db, attachment['filename'], attachment['content_type'], attachment['content'])
        cid_urls['cid:' + attachment['cid']] = url
        uploaded.append(url)
    candidates = [cid_urls.get(url, url) for url in data['poster_candidates'] if not url.startswith('cid:') or url in cid_urls]
    data['poster_candidates'] = list(dict.fromkeys(candidates + uploaded))
    data['poster_url'] = data['poster_candidates'][0] if data['poster_candidates'] else ''
    if len(data['poster_candidates']) > 1:
        data['warnings'].append('发现多张图片或 PDF，请选择正确的报告海报。')
    db.commit()
    return data


def normalize_title(t: str) -> str:
    import re
    t = re.sub(r'^[【\[](?:学术报告|通知|讲座|报告|天体物理中心)[\]】]\s*', '', t or '', flags=re.I)
    return re.sub(r'[《》""\'\'“”‘’\s，。、：:；;！!？?·•\-—_]', '', t).lower()


def normalize_speaker(s: str) -> str:
    import re
    return re.sub(r'[\s·•（）()\[\]]', '', s or '').lower()


_columns_ensured = False

def ensure_talks_columns(db: Session):
    global _columns_ensured
    if _columns_ensured:
        return
    try:
        from sqlalchemy import text
        cols = [
            ("end_date", "VARCHAR(10) DEFAULT ''"),
            ("event_type", "VARCHAR(20) DEFAULT 'talk'"),
            ("city", "VARCHAR(100) DEFAULT ''"),
            ("organizer", "VARCHAR(200) DEFAULT ''"),
            ("sub_type", "VARCHAR(50) DEFAULT ''"),
            ("abstract_start_date", "VARCHAR(10) DEFAULT ''"),
            ("abstract_deadline", "VARCHAR(10) DEFAULT ''"),
            ("early_bird_deadline", "VARCHAR(10) DEFAULT ''"),
            ("registration_deadline", "VARCHAR(10) DEFAULT ''"),
            ("website_url", "TEXT DEFAULT ''"),
            ("registration_url", "TEXT DEFAULT ''"),
            ("handbook_url", "TEXT DEFAULT ''"),
            ("source", "VARCHAR(200) DEFAULT ''"),
            ("updated_at", "DATETIME DEFAULT CURRENT_TIMESTAMP"),
        ]
        for col_name, col_type in cols:
            try:
                db.execute(text(f"ALTER TABLE observatory_talks ADD COLUMN {col_name} {col_type}"))
                db.commit()
            except Exception:
                db.rollback()
    except Exception:
        pass
    _columns_ensured = True


@router.get('')
def get_talks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_talks_columns(db)
    talks = db.query(ObservatoryTalk).order_by(ObservatoryTalk.date, ObservatoryTalk.time, ObservatoryTalk.id).all()
    merged_list = []
    to_delete = []

    for item in talks:
        norm_title = normalize_title(item.title)
        norm_speaker = normalize_speaker(item.speaker)

        dup = None
        for m in merged_list:
            if m.date != item.date:
                continue
            if (getattr(m, 'event_type', 'talk') or 'talk') != (getattr(item, 'event_type', 'talk') or 'talk'):
                continue
            m_title = normalize_title(m.title)
            m_speaker = normalize_speaker(m.speaker)
            if norm_title and m_title and (norm_title == m_title or norm_title in m_title or m_title in norm_title):
                dup = m
                break
            if norm_speaker and m_speaker and (norm_speaker == m_speaker or (len(norm_speaker) >= 2 and (norm_speaker in m_speaker or m_speaker in norm_speaker))):
                dup = m
                break

        if dup:
            to_delete.append(item)
            if len(item.title or '') > len(dup.title or ''):
                dup.title = item.title
            if len(item.speaker or '') > len(dup.speaker or ''):
                dup.speaker = item.speaker
            if len(item.location or '') > len(dup.location or ''):
                dup.location = item.location
            if not dup.poster_url and item.poster_url:
                dup.poster_url = item.poster_url
            if not getattr(dup, 'end_date', None) and getattr(item, 'end_date', None):
                dup.end_date = item.end_date
            new_notes = (item.notes or '').strip()
            if new_notes and new_notes[:30] not in (dup.notes or ''):
                dup.notes = f"{dup.notes}\n\n[补充/更新信息]\n{new_notes}" if dup.notes else new_notes
        else:
            merged_list.append(item)

    if to_delete:
        for item in to_delete:
            db.delete(item)
        db.commit()

    return merged_list


@router.post('')
def create_talk(req: TalkInput, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_talks_columns(db)
    data = req.model_dump()
    date_val = (data.get('date') or '').strip()
    title_val = (data.get('title') or '').strip()
    speaker_val = (data.get('speaker') or '').strip()
    location_val = (data.get('location') or '').strip()
    poster_val = (data.get('poster_url') or '').strip()
    notes_val = (data.get('notes') or '').strip()
    time_val = (data.get('time') or '').strip()
    end_date_val = (data.get('end_date') or '').strip()
    event_type_val = (data.get('event_type') or 'talk').strip()

    if event_type_val == 'conference':
        if not end_date_val:
            end_date_val = date_val
            data['end_date'] = date_val
        if not time_val:
            time_val = '全天'
            data['time'] = '全天'
    else:
        if not time_val:
            time_val = '14:30'
            data['time'] = '14:30'

    # 查询同日期的历史报告/同名会议
    if event_type_val == 'conference':
        candidates = db.query(ObservatoryTalk).filter(
            ObservatoryTalk.event_type == 'conference',
            (ObservatoryTalk.date == date_val) | (ObservatoryTalk.title == title_val)
        ).all()
    else:
        candidates = db.query(ObservatoryTalk).filter(
            ObservatoryTalk.date == date_val,
            (ObservatoryTalk.event_type == 'talk') | (ObservatoryTalk.event_type == None)
        ).all()

    norm_new_title = normalize_title(title_val)
    norm_new_speaker = normalize_speaker(speaker_val)

    matched: ObservatoryTalk | None = None
    for item in candidates:
        norm_item_title = normalize_title(item.title)
        norm_item_speaker = normalize_speaker(item.speaker)
        if norm_new_title and norm_item_title and (norm_new_title == norm_item_title or norm_new_title in norm_item_title or norm_item_title in norm_new_title):
            matched = item
            break
        if norm_new_speaker and norm_item_speaker and (norm_new_speaker == norm_item_speaker or (len(norm_new_speaker) >= 2 and (norm_new_speaker in norm_item_speaker or norm_item_speaker in norm_new_speaker))):
            matched = item
            break

    # 如果同日期未匹配到，且标题特征显著（>= 6 字符），尝试检测是否为延期/改期推送
    if not matched and event_type_val != 'conference' and norm_new_title and len(norm_new_title) >= 6:
        other_candidates = db.query(ObservatoryTalk).filter(
            (ObservatoryTalk.event_type == 'talk') | (ObservatoryTalk.event_type == None)
        ).all()
        for item in other_candidates:
            norm_item_title = normalize_title(item.title)
            if norm_item_title and (norm_new_title == norm_item_title or norm_new_title in norm_item_title or norm_item_title in norm_new_title):
                matched = item
                break

    if matched:
        old_title = (matched.title or '').strip()
        old_date = (matched.date or '').strip()
        old_end_date = (matched.end_date or '').strip()
        old_time = (matched.time or '').strip()
        old_speaker = (matched.speaker or '').strip()
        old_location = (matched.location or '').strip()
        old_notes = (matched.notes or '').strip()
        old_poster = (matched.poster_url or '').strip()
        old_event_type = (matched.event_type or 'talk').strip()

        # 检查内容是否与最新推送不一致
        is_changed = (
            (bool(title_val) and title_val != old_title) or
            (bool(date_val) and date_val != old_date) or
            (bool(time_val) and time_val != old_time) or
            (speaker_val != old_speaker) or
            (location_val != old_location) or
            (bool(notes_val) and notes_val != old_notes) or
            (bool(poster_val) and poster_val != old_poster) or
            (bool(end_date_val) and end_date_val != old_end_date) or
            (event_type_val != old_event_type)
        )

        if is_changed:
            if title_val: matched.title = title_val
            if date_val: matched.date = date_val
            if end_date_val: matched.end_date = end_date_val
            if time_val: matched.time = time_val
            matched.speaker = speaker_val
            matched.location = location_val
            if poster_val: matched.poster_url = poster_val
            if notes_val: matched.notes = notes_val
            matched.event_type = event_type_val
            db.commit()
            db.refresh(matched)

        res_dict = {c.name: getattr(matched, c.name) for c in matched.__table__.columns}
        res_dict['merged'] = True
        res_dict['replaced'] = is_changed
        res_dict['updated'] = is_changed
        res_dict['message'] = '检测到重复日程，已用最新推送更新替换！' if is_changed else '检测到相同日程，已确认无变更'
        return res_dict

    ensure_talks_columns(db)
    talk = ObservatoryTalk(**data, created_by_id=user.id)
    db.add(talk); db.commit(); db.refresh(talk)
    res_dict = {c.name: getattr(talk, c.name) for c in talk.__table__.columns}
    res_dict['merged'] = False
    res_dict['replaced'] = False
    return res_dict


@router.put('/{talk_id}')
def update_talk(talk_id: int, req: TalkInput, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ensure_talks_columns(db)
    talk = db.get(ObservatoryTalk, talk_id)
    if not talk: raise HTTPException(404, '报告不存在')
    data = req.model_dump()
    is_admin_or_creator = (user.role == 'admin' or user.id == talk.created_by_id)

    if not is_admin_or_creator:
        protected_fields = [
            'title', 'speaker', 'location', 'poster_url', 'notes', 'event_type',
            'city', 'organizer', 'sub_type', 'abstract_start_date', 'abstract_deadline', 'early_bird_deadline',
            'registration_deadline', 'website_url', 'registration_url', 'handbook_url', 'source'
        ]
        for field in protected_fields:
            if field in data and data[field] is not None:
                current_val = getattr(talk, field, None) or ''
                new_val = data[field] or ''
                if current_val != new_val:
                    raise HTTPException(403, '普通用户仅可调整日程时间，无权修改报告基本信息')

        if 'date' in data and data['date']: talk.date = data['date']
        if 'time' in data and data['time']: talk.time = data['time']
        if 'end_date' in data: talk.end_date = data['end_date']
        db.commit()
        db.refresh(talk)
        return talk

    for key, value in data.items(): setattr(talk, key, value)
    db.commit(); db.refresh(talk)
    return talk


@router.delete('/{talk_id}')
def delete_talk(talk_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    talk = db.get(ObservatoryTalk, talk_id)
    if not talk: raise HTTPException(404, '报告不存在')
    if user.id != talk.created_by_id and user.role != 'admin': raise HTTPException(403, '仅上传者或管理员可删除报告')
    db.delete(talk); db.commit()
    return {'message': '报告已删除'}


from pydantic import BaseModel
import html as html_lib
import json
import re
from urllib.parse import urljoin, urlparse, parse_qs, urlencode, urlunparse

class ScrapeUrlRequest(BaseModel):
    url: str

def clean_html_to_text(html_content: str) -> str:
    if not html_content:
        return ''
    t = re.sub(r'<(script|style|svg|noscript|iframe)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>', ' ', html_content, flags=re.I)
    t = re.sub(r'<!--[\s\S]*?-->', ' ', t)
    # 剔除下拉选择框与选项（防止带入全世界几百个时区或语言列表）
    t = re.sub(r'<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>', ' ', t, flags=re.I)
    t = re.sub(r'<option\b[^<]*(?:(?!<\/option>)<[^<]*)*<\/option>', ' ', t, flags=re.I)
    # 剔除导航与页眉页脚
    t = re.sub(r'<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>', ' ', t, flags=re.I)
    t = re.sub(r'<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>', ' ', t, flags=re.I)
    t = re.sub(r'<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>', ' ', t, flags=re.I)
    t = re.sub(r'<dialog\b[^<]*(?:(?!<\/dialog>)<[^<]*)*<\/dialog>', ' ', t, flags=re.I)
    # 剔除特定噪音容器（时区选择器、语言切换栏、通知弹窗、跳过链接、工具栏等）
    t = re.sub(r'<(?:div|section|aside)\b[^>]*\b(?:class|id)=["\'][^"\']*(?:timezone|language|toolbar|flashed|announcement|bypass|modal|dropdown|event-service-toolbar)[^"\']*["\'][^>]*>[\s\S]*?<\/(?:div|section|aside)>', ' ', t, flags=re.I)

    t = re.sub(r'<\/(?:p|div|h[1-6]|li|tr|section|article|header|footer|aside|blockquote|table)>', '\n', t, flags=re.I)
    t = re.sub(r'<(?:br|hr)\s*\/?>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html_lib.unescape(t)

    timezone_pattern = re.compile(r'^[A-Za-z]+(?:\/[A-Za-z_]+)+$')
    timezone_ui_pattern = re.compile(r'^(?:Choose timezone|Your profile timezone:|Use timezone based on:|Select a custom timezone|Custom|Event\/category)\b', re.I)
    lang_pattern = re.compile(r'^(?:Deutsch|English|Español|Français|Italiano|Magyar|Polski|Português|Suomi|Svenska|Türkçe|Čeština|Монгол|Українська|中文|日本語)\s*(?:\([^)]+\))?$', re.I)
    timetable_view_pattern = re.compile(r'^(?:Indico style(?:\s*-\s*.*)?|Indico Weeks View)$', re.I)
    site_chrome_pattern = re.compile(r'^(?:Skip to main content|Go to the Indico Home Page|Powered by Indico|Oldest event|Older event|Newer event|Newest event)$', re.I)

    lines = [re.sub(r'[ \t\f\v]+', ' ', line).strip() for line in t.splitlines()]
    filtered_lines = []
    for line in lines:
        if not line:
            continue
        if timezone_pattern.match(line):
            continue
        if timezone_ui_pattern.match(line):
            continue
        if lang_pattern.match(line):
            continue
        if timetable_view_pattern.match(line):
            continue
        if site_chrome_pattern.match(line):
            continue
        filtered_lines.append(line)

    dedup = []
    prev = ''
    for line in filtered_lines:
        if line != prev:
            dedup.append(line)
            prev = line
    return '\n'.join(dedup)

def extract_main_content(html_content: str) -> str:
    if not html_content:
        return ''
    content_container_regexes = [
        r'<div\b[^>]*\bclass=["\'][^"\']*(?:conference-page|page-content|conferenceDetails)[^"\']*["\'][^>]*>([\s\S]*?)<\/div>\s*<\/div>',
        r'<div\b[^>]*\bclass=["\'][^"\']*mainContent[^"\']*["\'][^>]*>([\s\S]*?)<\/div>\s*<\/div>',
        r'<main\b[^>]*>([\s\S]*?)<\/main>',
        r'<article\b[^>]*>([\s\S]*?)<\/article>',
        r'<div\b[^>]*\bid=["\']main-content["\'][^>]*>([\s\S]*?)<\/div>'
    ]
    for pattern in content_container_regexes:
        m = re.search(pattern, html_content, re.I)
        if m and m.group(1):
            extracted = clean_html_to_text(m.group(1))
            if len(extracted.strip()) > 60:
                return extracted
    return clean_html_to_text(html_content)

def extract_json_ld_event(html_content: str):
    if not html_content:
        return None
    for m in re.finditer(r'<script\b[^>]*type=["\']application\/ld\+json["\'][^>]*>([\s\S]*?)<\/script>', html_content, re.I):
        try:
            data = json.loads(m.group(1))
            event_obj = None
            if isinstance(data, list):
                for item in data:
                    if isinstance(item, dict) and (item.get('@type') == 'Event' or item.get('type') == 'Event'):
                        event_obj = item
                        break
            elif isinstance(data, dict):
                if data.get('@type') == 'Event' or data.get('type') == 'Event':
                    event_obj = data
            if event_obj:
                loc = event_obj.get('location')
                location_str = ''
                if isinstance(loc, dict):
                    loc_name = loc.get('name', '')
                    addr = loc.get('address', '')
                    loc_addr = addr if isinstance(addr, str) else (addr.get('streetAddress', '') if isinstance(addr, dict) else '')
                    location_str = f"{loc_name} ({loc_addr})" if (loc_name and loc_addr) else (loc_name or loc_addr)
                elif isinstance(loc, str):
                    location_str = loc
                return {
                    'title': event_obj.get('name', ''),
                    'startDate': event_obj.get('startDate', ''),
                    'endDate': event_obj.get('endDate', ''),
                    'location': location_str,
                    'description': event_obj.get('description', ''),
                    'url': event_obj.get('url', '')
                }
        except Exception:
            continue
    return None

def normalize_url(raw_url: str) -> str:
    try:
        p = urlparse(raw_url)
        qs = parse_qs(p.query, keep_blank_values=True)
        for k in ['view', 'lang', 'locale']:
            qs.pop(k, None)
        new_query = urlencode(qs, doseq=True)
        clean_path = p.path.rstrip('/')
        return urlunparse((p.scheme, p.netloc, clean_path, '', new_query, ''))
    except Exception:
        return raw_url.rstrip('/')

@router.post('/scrape-url')
async def scrape_url(req: ScrapeUrlRequest, user: User = Depends(get_current_user)):
    target_url = (req.url or '').strip()
    if not target_url.startswith(('http://', 'https://')):
        raise HTTPException(400, '仅支持 HTTP 或 HTTPS 链接')

    import aiohttp
    import asyncio

    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
    }

    pages_scraped = []
    text_sections = []
    images_scored = {}
    registration_url = ''
    main_title = ''

    timeout = aiohttp.ClientTimeout(total=8)
    conn = aiohttp.TCPConnector(ssl=False)

    try:
        async with aiohttp.ClientSession(timeout=timeout, connector=conn, headers=headers) as session:
            try:
                async with session.get(target_url) as resp:
                    if resp.status >= 400:
                        raise HTTPException(400, f'目标网页返回错误状态码: {resp.status}')
                    main_html = await resp.text(errors='ignore')
            except Exception as e:
                raise HTTPException(400, f'抓取目标网页失败: {str(e)}')

            # 提取主页标题
            m_og_title = re.search(r'<meta\s+[^>]*property=["\']og:title["\'][^>]*content=["\']([^"\']+)["\']', main_html, re.I) \
                         or re.search(r'<meta\s+[^>]*content=["\']([^"\']+)["\'][^>]*property=["\']og:title["\']', main_html, re.I)
            if m_og_title:
                main_title = html_lib.unescape(m_og_title.group(1).strip())
            else:
                m_title = re.search(r'<title[^>]*>([\s\S]*?)<\/title>', main_html, re.I)
                if m_title:
                    main_title = html_lib.unescape(re.sub(r'<[^>]+>', '', m_title.group(1)).strip())

            pages_scraped.append({'url': target_url, 'title': main_title or '活动主页', 'type': 'main', 'status': 'success'})

            # 提取主页图片
            for m_og_img in re.finditer(r'<meta\s+[^>]*property=["\']og:image["\'][^>]*content=["\']([^"\']+)["\']', main_html, re.I):
                abs_img = urljoin(target_url, m_og_img.group(1).strip())
                images_scored[abs_img] = images_scored.get(abs_img, 0) + 15

            poster_regex = re.compile(r'poster|banner|flyer|haibao|fengmian|cover|kv|headline|main', re.I)
            ignore_regex = re.compile(r'favicon|\.ico$|\.svg$|avatar|headshot|arrow|badge|button|tracker|spacer|pixel|qrcode', re.I)

            for m_img in re.finditer(r'<img\b([^>]+)>', main_html, re.I):
                attrs = m_img.group(1)
                m_src = re.search(r'\bsrc=["\']([^"\']+)["\']', attrs, re.I)
                if not m_src:
                    continue
                raw_src = m_src.group(1).strip()
                if raw_src.startswith('data:'):
                    continue
                abs_img = urljoin(target_url, raw_src)
                if ignore_regex.search(abs_img):
                    continue
                score = 10 if poster_regex.search(attrs + ' ' + abs_img) else 2
                images_scored[abs_img] = max(images_scored.get(abs_img, 0), score)

            # 提取报名与子页面链接
            parsed_main = urlparse(target_url)
            target_path = parsed_main.path.rstrip('/')
            candidate_links_dict = {}
            subpage_regex = re.compile(r'program|schedule|agenda|timetable|calendar|registration|register|signup|submission|abstract|cfp|venue|hotel|accommodation|location|travel|speakers|keynote|committee|organization|dates|key-dates|important-dates|visa|fees|poster|flyer|invitation|announcement|日程|议程|注册|报名|投稿|征文|摘要|地点|会场|交通|住宿|酒店|签证|海报|组委会|组织机构|报告人|嘉宾|重要日期|关键日期|截止日期|截稿日期|大会日程', re.I)
            external_reg_regex = re.compile(r'wjx\.cn|wj\.qq\.com|huodongxing\.com|forms\.gle|docs\.google\.com\/forms|jinshuju\.net', re.I)

            # 1. 优先提取专属活动侧边栏/导航菜单中的所有栏目链接（如 Indico 的 conf_leftMenu / Event menu）
            menu_block_m = re.search(
                r'<(?:div|nav)\b[^>]*\b(?:class|id)=["\'][^"\']*(?:conf_leftMenu|event-menu|side-menu|conference-menu)[^"\']*["\'][^>]*>([\s\S]*?)<\/(?:div|nav)>',
                main_html,
                re.I
            ) or re.search(
                r'<h2\b[^>]*\bclass=["\'][^"\']*event-menu-heading[^"\']*["\'][^>]*>[\s\S]*?<ul\b[^>]*>([\s\S]*?)<\/ul>',
                main_html,
                re.I
            )

            base_clean = normalize_url(target_url)

            if menu_block_m:
                menu_html = menu_block_m.group(1)
                for m_menu_a in re.finditer(r'<a\b([^>]*)\bhref=["\']([^"\'#]+)["\']([^>]*)>([\s\S]*?)<\/a>', menu_html, re.I):
                    raw_href = m_menu_a.group(2).strip()
                    link_text = html_lib.unescape(re.sub(r'<[^>]+>', '', m_menu_a.group(4)).strip())
                    abs_href = urljoin(target_url, raw_href)
                    if not abs_href or abs_href.startswith(('javascript:', 'mailto:', 'tel:')):
                        continue
                    clean_key = normalize_url(abs_href)
                    if clean_key == base_clean or clean_key == f"{base_clean}/overview":
                        continue

                    menu_score = 30
                    ctx = f"{clean_key} {link_text}"
                    if re.search(r'key-dates|dates|日期|截止', ctx, re.I):
                        menu_score += 10
                    if re.search(r'abstract|submission|摘要|征集|投稿', ctx, re.I):
                        menu_score += 8
                    if re.search(r'registration|register|报名|注册', ctx, re.I):
                        menu_score += 8
                    if re.search(r'venue|hotel|location|会场|地点|酒店', ctx, re.I):
                        menu_score += 6
                    if re.search(r'visa|签证', ctx, re.I):
                        menu_score += 6

                    candidate_links_dict[clean_key] = {'url': abs_href, 'text': link_text, 'score': menu_score}

            # 2. 遍历页面所有 a 标签进行补充探测
            for m_a in re.finditer(r'<a\b([^>]*)\bhref=["\']([^"\'#]+)["\']([^>]*)>([\s\S]*?)<\/a>', main_html, re.I):
                raw_href = m_a.group(2).strip()
                link_text = html_lib.unescape(re.sub(r'<[^>]+>', '', m_a.group(4)).strip())
                abs_href = urljoin(target_url, raw_href)
                if not abs_href or abs_href.startswith(('javascript:', 'mailto:', 'tel:')):
                    continue
                combined_ctx = f"{raw_href} {link_text}"

                if external_reg_regex.search(abs_href):
                    if not registration_url:
                        registration_url = abs_href
                elif not registration_url and re.search(r'register|registration|signup|baoming', combined_ctx, re.I) and not re.search(r'login|signin', combined_ctx, re.I):
                    registration_url = abs_href

                if re.search(r'login|signin|logout|register_account|change-language|getindico\.io|learn\.getindico', abs_href, re.I):
                    continue
                if re.search(r'[?&]view=(?:standard|standard_inline_minutes|standard_numbered|standard_numbered_inline_minutes|indico_weeks_view)', abs_href, re.I):
                    continue

                clean_key = normalize_url(abs_href)
                if clean_key == base_clean or clean_key == f"{base_clean}/overview":
                    continue

                parsed_link = urlparse(abs_href)
                if parsed_main.netloc and parsed_link.netloc == parsed_main.netloc:
                    if re.search(r'\.(zip|rar|tar|gz|exe|dmg|mp4|avi|mp3|ics|xml)$', abs_href, re.I):
                        continue
                    is_sub_path = bool(target_path and parsed_link.path.rstrip('/').startswith(target_path))
                    matches_keyword = bool(subpage_regex.search(combined_ctx))

                    if matches_keyword or is_sub_path:
                        score = 6
                        if re.search(r'key-dates|dates|important-dates|重要日期|关键日期|截止日期|截稿日期', combined_ctx, re.I):
                            score += 12
                        if re.search(r'submission|abstract|cfp|call for abstracts|投稿|征文|摘要', combined_ctx, re.I):
                            score += 10
                        if re.search(r'registration|register|signup|registration info|注册|报名', combined_ctx, re.I):
                            score += 10
                        if re.search(r'venue|hotel|accommodation|location|travel|地点|会场|交通|住宿|酒店', combined_ctx, re.I):
                            score += 9
                        if re.search(r'visa|visa-information|签证', combined_ctx, re.I):
                            score += 9
                        if re.search(r'program|schedule|agenda|timetable|calendar|日程|议程', combined_ctx, re.I):
                            score += 8
                        if re.search(r'speakers|keynote|报告人|嘉宾', combined_ctx, re.I):
                            score += 7
                        if re.search(r'committee|organization|组委会|组织机构', combined_ctx, re.I):
                            score += 5
                        if is_sub_path:
                            score += 5

                        if clean_key not in candidate_links_dict or candidate_links_dict[clean_key]['score'] < score:
                            candidate_links_dict[clean_key] = {'url': abs_href, 'text': link_text, 'score': score}

            candidate_links = sorted(candidate_links_dict.values(), key=lambda x: x['score'], reverse=True)

            # 若存在 JSON-LD 结构化活动元数据，优先置顶录入
            json_ld_event = extract_json_ld_event(main_html)
            if json_ld_event:
                meta_lines = ['【活动官网结构化元数据】']
                if json_ld_event.get('title'):
                    meta_lines.append(f"活动名称：{json_ld_event['title']}")
                if json_ld_event.get('startDate'):
                    meta_lines.append(f"开始日期：{json_ld_event['startDate']}")
                if json_ld_event.get('endDate'):
                    meta_lines.append(f"结束日期：{json_ld_event['endDate']}")
                if json_ld_event.get('location'):
                    meta_lines.append(f"活动地点：{json_ld_event['location']}")
                if json_ld_event.get('description'):
                    meta_lines.append(f"活动简述：{json_ld_event['description']}")
                text_sections.append('\n'.join(meta_lines))

            cleaned_main = extract_main_content(main_html)[:7000]
            text_sections.append(f"【活动官网主页】{target_url}\n页面标题：{main_title}\n页面正文：\n{cleaned_main}")

            # 并发抓取子页面 (最多 8 个核心子栏目)
            sub_targets = candidate_links[:8]
            if sub_targets:
                async def fetch_sub(link):
                    try:
                        async with session.get(link['url'], timeout=aiohttp.ClientTimeout(total=5)) as s_resp:
                            if s_resp.status == 200:
                                s_html = await s_resp.text(errors='ignore')
                                s_text = extract_main_content(s_html)[:3500]
                                for m_img in re.finditer(r'<img\b([^>]+)>', s_html, re.I):
                                    attrs = m_img.group(1)
                                    m_src = re.search(r'\bsrc=["\']([^"\']+)["\']', attrs, re.I)
                                    if m_src:
                                        abs_img = urljoin(link['url'], m_src.group(1).strip())
                                        if not ignore_regex.search(abs_img) and not abs_img.startswith('data:'):
                                            score = 8 if poster_regex.search(attrs + ' ' + abs_img) else 2
                                            images_scored[abs_img] = max(images_scored.get(abs_img, 0), score)
                                pages_scraped.append({'url': link['url'], 'title': link['text'] or '相关栏目', 'type': 'subpage', 'status': 'success'})
                                return f"\n【相关栏目：{link['text']}】{link['url']}\n{s_text}"
                    except Exception:
                        pass
                    pages_scraped.append({'url': link['url'], 'title': link['text'] or '相关栏目', 'type': 'subpage', 'status': 'failed'})
                    return ''

                sub_results = await asyncio.gather(*(fetch_sub(l) for l in sub_targets))
                for s_res in sub_results:
                    if s_res:
                        text_sections.append(s_res)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f'抓取服务异常: {str(e)}')

    sorted_imgs = [img for img, _ in sorted(images_scored.items(), key=lambda x: x[1], reverse=True)]
    best_poster = sorted_imgs[0] if sorted_imgs else ''
    combined_text = '\n\n'.join(text_sections)[:18000]

    return {
        'success': True,
        'url': target_url,
        'title': main_title,
        'combined_text': combined_text,
        'pages_scraped': pages_scraped,
        'poster_candidates': sorted_imgs[:8],
        'best_poster_url': best_poster,
        'registration_url': registration_url
    }

