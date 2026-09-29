/**
 * 识别与解析学术报告通知邮件工具库
 */

/**
 * 识别是否为学术报告、论坛、讲座通知邮件
 * @param {Object} email 邮件对象
 * @returns {boolean}
 */
export function isTalkEmail(email) {
  if (!email) return false
  const title = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').toLowerCase()
  const body = (email.body_text || '').toLowerCase()
  const combined = `${title} \n ${snippet} \n ${body}`

  // 1. 邮件标题明确包含学术报告/讲座/论坛/研讨会等关键词
  if (/报告|讲座|seminar|colloquium|talk|沙龙|组会|研讨会|学术论坛|青年论坛|前沿论坛|专题论坛|学术交流|交流会/i.test(title)) return true

  // 2. 标题包含“第X期/届”且含论坛/交流/报告等字样
  if (/第\s*\d+\s*[期届].*?(?:论坛|报告|讲座|交流)/i.test(title)) return true

  // 3. 语义多特征综合判断
  const hasSpeaker = /报告人|主讲人|主讲嘉宾|特邀嘉宾|speaker|presenter|邀请(?:到了|到|了)?(?:[^,，。；\n\r]*?的)?\s*[A-Za-z\u4e00-\u9fa5·]{2,6}\s*(?:博士|教授|研究员|特聘研究员|副教授|院士|老师)/i.test(combined)
  const hasTopic = /做题为|题为|报告题目|报告主题|题目为|题目是|[《“][^》”\n\r]{4,100}[》”]\s*(?:的)?(?:学术)?(?:报告|讲座)/i.test(combined)
  const hasTimeOrPlace = /时间|日期|地点|会议室|报告厅|大厦|教室|腾讯会议|zoom|venue|location|date|time/i.test(combined)
  const hasTalkContext = /报告|讲座|seminar|colloquium|talk|沙龙|组会|研讨会|论坛|交流/i.test(combined)

  if (hasSpeaker && hasTimeOrPlace) return true
  if (hasTopic && (hasTimeOrPlace || hasSpeaker)) return true
  if (hasTalkContext && hasTimeOrPlace && (hasSpeaker || hasTopic)) return true

  return false
}

/**
 * 识别是否为机构/学院/研究生部/教务处公文通知或管理邮件
 * @param {Object} email 邮件对象
 * @returns {boolean}
 */
export function isNoticeEmail(email) {
  if (!email) return false
  const title = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').toLowerCase()
  const body = (email.body_text || '').toLowerCase()
  const sender = `${email.sender_name || ''} ${email.sender_email || ''}`.toLowerCase()
  const combined = `${title} \n ${snippet} \n ${body}`

  const isDeptSender = /研究生部|研究生院|教务处|科研处|科技处|人事处|人教处|院务|院办|党政办|综合办|行政办|学生工作|学工处|资产处|财务处|科发处|管理部|培养处|学位办|招生办|pmo\.ac\.cn|nju\.edu\.cn|cas\.cn|ustc\.edu\.cn/i.test(sender)

  if (/通知|意见征集|征求意见|征集意见|实施细则|管理办法|暂行办法|方案|工作安排|工作通知|日程安排|申报通知|评审通知|公示|关于.*?的函|关于.*?的通知|关于.*?的决定|答辩|学位|奖学金|助学金|选拔|推免|考务|考试|放假|值班|安全检查|notice|announcement|circular|bulletin/i.test(title)) {
    return true
  }

  if (isDeptSender && /通知|征集|细则|办法|规定|申报|评审|公示|安排|办理|名单|导师|研究生|学生|学院|关于/i.test(combined)) {
    return true
  }

  const hasNoticeKeyword = /通知|意见征集|征求意见|实施细则|管理办法|工作方案|公示/i.test(combined)
  const hasInstitutionalContext = /各单位|各位老师|各位同学|各位导师|各部门|各课题组|全体研究生|全体导师|根据.*?要求|经研究决定|印发|特此通知/i.test(combined)
  if (hasNoticeKeyword && hasInstitutionalContext) {
    return true
  }

  return false
}

/**
 * 将邮件正文分割为多场学术报告片段（如报告一/报告二、Talk 1/Talk 2、多个题目/主讲人锚点）
 * @param {string} text 邮件正文
 * @returns {{ header: string, segments: string[] }}
 */
export function splitTalkSegments(text = '') {
  if (!text || typeof text !== 'string') return { header: '', segments: [] }
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // 1. 显式报告序号分段（如：报告一 / 报告1 / 报告 1 / 【报告1】 / 讲座一 / Talk 1 / Session 1 / 第一场报告 / 上午报告）
  const explicitPattern = /(?:^|\n)[ \t]*(?:【|\[|（|\()?[ \t]*(?:第[一二三四五六七八九十1-9]场(?:报告|讲座)?|(?:报告|讲座|Talk|Session|分会场)\s*(?:[一二三四五六七八九十1-9①-⑨]|I{1,3}|IV|V)\b|(?:上午|下午)\s*报告)[ \t]*(?:】|\]|）|\)|[:：、.\s]|\b)/gi
  const explicitMatches = [...normalized.matchAll(explicitPattern)]
  if (explicitMatches.length >= 2) {
    const segments = []
    const header = normalized.slice(0, explicitMatches[0].index).trim()
    for (let i = 0; i < explicitMatches.length; i++) {
      const start = explicitMatches[i].index
      const end = i + 1 < explicitMatches.length ? explicitMatches[i + 1].index : normalized.length
      segments.push(normalized.slice(start, end).trim())
    }
    return { header, segments }
  }

  // 2. 编号条目分段（如：1. 题目 / 1、报告题目 / 1. 《...》 等）
  const numberedPattern = /(?:^|\n)[ \t]*(?:[1-9][.、]|[(（【][1-9][)）】])[ \t]*(?=(?:[^\n]{0,25}(?:报告|讲座|题目|报告人|主讲人|Title|Speaker|《)))/gi
  const numberedMatches = [...normalized.matchAll(numberedPattern)]
  if (numberedMatches.length >= 2) {
    const segments = []
    const header = normalized.slice(0, numberedMatches[0].index).trim()
    for (let i = 0; i < numberedMatches.length; i++) {
      const start = numberedMatches[i].index
      const end = i + 1 < numberedMatches.length ? numberedMatches[i + 1].index : normalized.length
      segments.push(normalized.slice(start, end).trim())
    }
    return { header, segments }
  }

  // 3. 重复“报告题目/题目/Title”锚点
  const titlePattern = /(?:^|\n)[ \t]*(?:报告(?:题目|标题|主题|名称)|题目|Title|Topic)[ \t]*[:：]/gi
  const titleMatches = [...normalized.matchAll(titlePattern)]
  if (titleMatches.length >= 2) {
    const segments = []
    const header = normalized.slice(0, titleMatches[0].index).trim()
    for (let i = 0; i < titleMatches.length; i++) {
      const start = titleMatches[i].index
      const end = i + 1 < titleMatches.length ? titleMatches[i + 1].index : normalized.length
      segments.push(normalized.slice(start, end).trim())
    }
    return { header, segments }
  }

  // 4. 重复“报告人/主讲人/Speaker”锚点
  const speakerPattern = /(?:^|\n)[ \t]*(?:报告人|主讲人|主讲嘉宾|报告嘉宾|Speaker|Presenter)[ \t]*[:：]/gi
  const speakerMatches = [...normalized.matchAll(speakerPattern)]
  if (speakerMatches.length >= 2) {
    const segments = []
    const header = normalized.slice(0, speakerMatches[0].index).trim()
    for (let i = 0; i < speakerMatches.length; i++) {
      const start = speakerMatches[i].index
      const end = i + 1 < speakerMatches.length ? speakerMatches[i + 1].index : normalized.length
      segments.push(normalized.slice(start, end).trim())
    }
    return { header, segments }
  }

  return { header: '', segments: [normalized] }
}

/**
 * 若文本同时包含中文与英文，优先提取中文部分；若仅有英文或仅有中文，则原样保留
 */
export function pickChinesePartIfDual(str = '') {
  if (!str || typeof str !== 'string') return ''
  const trimmed = str.trim()
  const hasChinese = /[\u4e00-\u9fa5]/.test(trimmed)
  const hasLatin = /[a-zA-Z]/.test(trimmed)
  if (!hasChinese || !hasLatin) return trimmed

  // 1. 中文 (English) 或 中文（English）
  const mCnEnParen = trimmed.match(/^(.+?)\s*[（(]([A-Za-z0-9\s,.:;'"\-–—/&#]+)[)）]$/)
  if (mCnEnParen) {
    const candidate = mCnEnParen[1].trim()
    const inner = mCnEnParen[2].trim()
    if (/[\u4e00-\u9fa5]/.test(candidate) && !/[\u4e00-\u9fa5]/.test(inner)) {
      return candidate
    }
  }

  // 2. English (中文) 或 English（中文）
  const mEnCnParen = trimmed.match(/^(.+?)\s*[（(]([^\r\n()（）]+)[)）]$/)
  if (mEnCnParen) {
    const candidate = mEnCnParen[1].trim()
    const inner = mEnCnParen[2].trim()
    if (/[\u4e00-\u9fa5]/.test(inner) && !/[\u4e00-\u9fa5]/.test(candidate)) {
      return inner
    }
  }

  // 3. 中文 / English 或 English / 中文
  if (trimmed.includes('/') || trimmed.includes('／')) {
    const parts = trimmed.split(/[/／]/).map(p => p.trim()).filter(Boolean)
    const cnPart = parts.find(p => /[\u4e00-\u9fa5]/.test(p) && !/[a-zA-Z]{4,}/.test(p))
    if (cnPart && cnPart.length >= 2) return cnPart
  }

  // 4. 中文 —— English 或 English —— 中文
  if (trimmed.includes('——') || trimmed.includes('—') || trimmed.includes(' - ')) {
    const sep = trimmed.includes('——') ? '——' : (trimmed.includes('—') ? '—' : ' - ')
    const parts = trimmed.split(sep).map(p => p.trim()).filter(Boolean)
    const cnPart = parts.find(p => /[\u4e00-\u9fa5]/.test(p) && !/[a-zA-Z]{4,}/.test(p))
    if (cnPart && cnPart.length >= 2) return cnPart
  }

  return trimmed
}

/**
 * 根据邮件及地点上下文判断所属单位并规范化地点前缀：
 * - 南大报告：最前面填入“南大 ”（包含空格，如“南大 天文楼302会议室”）
 * - 紫台报告：最前面填入“紫台”（如“紫台仙林 5-516 会议室”或“紫台5-516 会议室”）
 */
export function applyInstitutionLocationPrefix(location = '', context = '') {
  let loc = (location || '').trim()
  loc = pickChinesePartIfDual(loc)

  const combined = `${context} ${loc}`
  const isNju = /南京大学|南大|nju\.edu\.cn|\bnju\b|天文与空间科学学院|左涤江|天文楼/i.test(combined)
  const isPmo = /紫金山天文台|紫台|pmo\.ac.cn|\bpmo\b|仙林园区|5-516|大平房|青促会/i.test(combined)

  if (isNju && !isPmo) {
    if (/^南大\s*/.test(loc)) {
      return loc.replace(/^南大\s*/, '南大 ')
    }
    if (/^南京大学\s*/.test(loc)) {
      return loc.replace(/^南京大学\s*/, '南大 ')
    }
    return loc ? `南大 ${loc}` : '南大 '
  }

  if (isPmo && !isNju) {
    if (/^紫台\s*/.test(loc)) {
      return loc
    }
    if (/^紫金山天文台\s*/.test(loc)) {
      return loc.replace(/^紫金山天文台\s*/, '紫台')
    }
    return loc ? `紫台${loc}` : '紫台'
  }

  if (isNju && isPmo) {
    if (/紫台|紫金山|5-516|仙林园区|大平房/i.test(loc)) {
      if (/^紫台\s*/.test(loc)) return loc
      if (/^紫金山天文台\s*/.test(loc)) return loc.replace(/^紫金山天文台\s*/, '紫台')
      return loc ? `紫台${loc}` : '紫台'
    } else {
      if (/^南大\s*/.test(loc)) return loc.replace(/^南大\s*/, '南大 ')
      if (/^南京大学\s*/.test(loc)) return loc.replace(/^南京大学\s*/, '南大 ')
      return loc ? `南大 ${loc}` : '南大 '
    }
  }

  return loc
}

/**
 * 提取单段文本中的报告元数据
 */
export function extractSingleTalkFields(text = '', fallback = {}) {
  const result = {
    title: '',
    date: fallback.date || '',
    time: fallback.time || '10:00',
    speaker: fallback.speaker || '',
    location: fallback.location || '',
    notes: text.trim()
  }

  // 1. 标题提取
  const mTitle = text.match(/(?:做题为|题为|题目为|题目是|报告题目|报告主题|报告名称)\s*[：:\s]*[《“]([^》”\n\r]+)[》”]/)
    || text.match(/(?:报告(?:题目|标题|主题|名称)|题目|页面标题|网页标题|Title|Topic)[：:\s]+([^\n\r]+)/i)
    || text.match(/[《“]([^》”\n\r]{4,100})[》”]\s*(?:的)?(?:学术)?(?:报告|讲座|分享)/)

  if (mTitle) {
    result.title = mTitle[1].replace(/^[【\[](?:学术报告|通知|讲座)[\]】]/, '').trim()
  } else {
    // 检查是否在段落首行带有标题（如：报告一：超新星射电辐射 / 1. FAST脉冲星观测）
    const mHeaderInline = text.match(/^(?:【|\[|（|\()?[ \t]*(?:第\s*[一二三四五六七八九十1-9]\s*场(?:报告|讲座)?|(?:报告|讲座|Talk|Session|分会场)\s*(?:[一二三四五六七八九十1-9①-⑨]|I{1,3}|IV|V)|[1-9][.、]|[(（【][1-9][)）】])[ \t]*(?:】|\]|）|\)|[:：、.\s])[ \t]*([^\n\r]{3,80})/i)
    if (mHeaderInline && !/^(?:时间|地点|报告人|主讲人|报告地点|Location|Venue|Speaker|Date|Time)/i.test(mHeaderInline[1].trim())) {
      result.title = mHeaderInline[1].replace(/^[【\[](?:学术报告|通知|讲座)[\]】]/, '').trim()
    } else if (fallback.subject) {
      let cleanSub = fallback.subject.replace(/^(?:提醒|通知|Fw|Fwd|转|转发)[:：\s]*/gi, '').trim()
      cleanSub = cleanSub.replace(/\s*(?:时间|地点|日期|Location|Venue|Time|Date)\s*[:：]?\s*.*$/gi, '').trim()
      result.title = cleanSub || fallback.subject
    }
  }

  // 2. 日期提取 (YYYY-MM-DD 或 YYYY年MM月DD日)
  const currentYear = new Date().getFullYear()
  const fullDateMatch = text.match(/(?:^|[^\d])(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/)
  if (fullDateMatch) {
    let y = parseInt(fullDateMatch[1], 10)
    if (y < currentYear) {
      y = currentYear
    }
    const m = fullDateMatch[2].padStart(2, '0')
    const d = fullDateMatch[3].padStart(2, '0')
    result.date = `${y}-${m}-${d}`
  } else {
    const mdMatch = text.match(/(?:^|[^\d])(\d{1,2})月(\d{1,2})日?/)
    if (mdMatch) {
      const y = currentYear
      const m = mdMatch[1].padStart(2, '0')
      const d = mdMatch[2].padStart(2, '0')
      result.date = `${y}-${m}-${d}`
    }
  }


  // 3. 时间提取（避免 lookbehind 保证 Safari 全版本兼容）
  const timeMatch = text.match(/(?:^|[^\d])(\d{1,2})[:：](\d{2})\s*(AM|PM)?|(?:^|[^\d])(\d{1,2})[点时](?:(\d{1,2})分?)?/i)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1] || timeMatch[4], 10)
    const minute = parseInt(timeMatch[2] || timeMatch[5] || 0, 10)
    const idx = timeMatch.index || 0
    const matchStart = timeMatch[0].match(/^\d/) ? idx : idx + 1
    const prefix = text.slice(Math.max(0, matchStart - 15), matchStart)
    const ampm = (timeMatch[3] || '').toUpperCase()
    if (ampm === 'PM' || /下午|晚上/.test(prefix)) {
      if (hour < 12) hour += 12
    } else if (ampm === 'AM' && hour === 12) {
      hour = 0
    }
    if (hour < 24 && minute < 60) {
      result.time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }
  }

  // 4. 主讲人提取
  const mSpeakerLabel = text.match(/(?:报告人|主讲人|报告嘉宾|主讲嘉宾|Speaker|Presenter|特邀嘉宾|报告学者)\s*[:：\s]\s*([^\n\r,，。；()（）]{2,25})/i)
  if (mSpeakerLabel) {
    result.speaker = mSpeakerLabel[1].trim()
  } else {
    const titlesList = '特聘研究员|副研究员|助理教授|副教授|研究员|博士后|教授|博士|院士|讲师|主任|老师|同学'
    const mSpeakerDe = text.match(new RegExp(`(?:邀请(?:到了|到|了)?|由)(?:[^,，。；\\n\\r]*?的)\\s*([A-Za-z\\u4e00-\\u9fa5·]{2,4}?)\\s*(${titlesList})`))
    if (mSpeakerDe) {
      result.speaker = `${mSpeakerDe[1].trim()} ${mSpeakerDe[2].trim()}`
    } else {
      const mSpeakerDir = text.match(new RegExp(`(?:邀请(?:到了|到|了)?|由)\\s*(?:[^\\s,，。、]+?(?:大学|学院|天文台|研究所|实验室|中心|系统|学会|学校|[台院所系]))?\\s*([A-Za-z\\u4e00-\\u9fa5·]{2,4}?)\\s*(${titlesList})`))
      if (mSpeakerDir) {
        result.speaker = `${mSpeakerDir[1].trim()} ${mSpeakerDir[2].trim()}`
      }
    }
  }

  // 5. 地点提取
  const mLocLine = text.match(/^\s*(?:报告地点|地点|会议地点|Location|Venue)\s*[:：]\s*(.+)/im)
  if (mLocLine) {
    result.location = mLocLine[1].trim()
  } else {
    const mHeld = text.match(/在\s*([^,，。；\n\r]{2,40}?)\s*(?:线上|线下)?(?:举办|举行|召开|进行)/)
    if (mHeld && /会议室|报告厅|多功能厅|大厦|楼|中心|教室|腾讯会议|Zoom|ZOOM|\d+-\d+/i.test(mHeld[1])) {
      result.location = mHeld[1].trim()
    } else {
      const mLocInline = text.match(/(?:报告地点|地点|会议地点|Location|Venue)\s*[:：\s]?\s*([^,，。；\n\r]{2,30})/i)
      if (mLocInline) {
        result.location = mLocInline[1].trim()
      }
    }
  }

  result.title = pickChinesePartIfDual(result.title)
  result.speaker = pickChinesePartIfDual(result.speaker)
  const fullContext = `${text} ${fallback.subject || ''}`
  result.location = applyInstitutionLocationPrefix(result.location, fullContext)

  return result
}

/**
 * 本地智能提取学术报告元数据（支持多场报告识别 + 即时预览 + 离线兜底）
 * @param {string} text 邮件标题与正文文本
 * @param {string} subject 邮件原始标题
 * @returns {{ title: string, date: string, time: string, speaker: string, location: string, notes: string, talks: Array }}
 */
export function parseTalkMetadataLocally(text = '', subject = '') {
  // 提取全局/公共基础元数据（兜底）
  const commonMeta = extractSingleTalkFields(text, {
    date: new Date().toISOString().slice(0, 10),
    time: '10:00',
    subject
  })

  // 尝试分段
  const { header, segments } = splitTalkSegments(text)

  if (segments.length >= 2) {
    const headerMeta = header ? extractSingleTalkFields(header, commonMeta) : commonMeta
    const fallback = {
      date: headerMeta.date || commonMeta.date,
      location: headerMeta.location || commonMeta.location,
      time: headerMeta.time || commonMeta.time,
      subject
    }

    const parsedTalks = segments.map(seg => {
      const segMeta = extractSingleTalkFields(seg, fallback)
      return {
        title: segMeta.title || '学术报告',
        date: segMeta.date || fallback.date,
        time: segMeta.time || fallback.time,
        speaker: segMeta.speaker || '',
        location: segMeta.location || fallback.location,
        notes: seg.length > 30 ? seg.slice(0, 2000) : text.slice(0, 2000),
        poster_url: ''
      }
    }).filter(t => t.title && (t.title !== '学术报告' || t.speaker))

    // 检查是否有至少两场互不相同（标题或报告人不同）的报告
    if (parsedTalks.length >= 2) {
      const isUnique = parsedTalks.some((t, i) => i > 0 && (t.title !== parsedTalks[0].title || t.speaker !== parsedTalks[0].speaker))
      if (isUnique) {
        return {
          ...parsedTalks[0],
          talks: parsedTalks
        }
      }
    }
  }

  // 单场报告兜底
  const single = {
    title: commonMeta.title || '学术报告',
    date: commonMeta.date || new Date().toISOString().slice(0, 10),
    time: commonMeta.time || '10:00',
    speaker: commonMeta.speaker || '',
    location: commonMeta.location || '',
    notes: text.slice(0, 2000),
    poster_url: ''
  }

  return {
    ...single,
    talks: [single]
  }
}

/**
 * 识别是否为学术会议通知邮件（如年会、研讨会、暑期学校、学术论坛等）
 * @param {Object} email 邮件对象
 * @returns {boolean}
 */
export function isConferenceEmail(email) {
  if (!email) return false
  const title = (email.subject || '').toLowerCase()
  const snippet = (email.snippet || '').toLowerCase()
  const body = (email.body_text || '').toLowerCase()
  const combined = `${title} \n ${snippet} \n ${body}`

  // 1. 标题显式会议关键词匹配
  if (/学术会议|研讨会|学术论坛|年会|研讨班|讲习班|研习班|暑期学校|暑假学校|冬令营|大会通知|征文通知|征稿通知|第一轮通知|第二轮通知|第三轮通知|会议通知|参会通知|注册通知|邀请函|call for papers|conference|symposium|workshop|annual meeting|summer school|winter school|congress/i.test(title)) {
    return true
  }

  // 2. 语义综合：包含会议关键词且同时具备注册/报名/征文/截止/主办等特征
  const hasConfKeywords = /会议|研讨会|论坛|年会|研讨班|讲习班|暑期学校|conference|symposium|workshop|school/i.test(combined)
  const hasActionKeywords = /征文|征稿|注册|报名|参会|摘要提交|截稿|早鸟|酒店预订|会议日程|registration|submission|deadline|early bird|call for papers/i.test(combined)
  const hasHostKeywords = /主办|承办|协办|举办地点|召开|举行|organizer|hosted by/i.test(combined)

  if (hasConfKeywords && (hasActionKeywords || hasHostKeywords)) {
    return true
  }

  return false
}

/**
 * 判断邮件的学术日程类型：'conference' | 'talk' | null
 * 会议类型优先判定，若非会议再判定是否为学术报告
 * @param {Object} email 邮件对象
 * @returns {'conference' | 'talk' | null}
 */
export function detectScheduleType(email) {
  if (!email) return null
  if (isConferenceEmail(email)) return 'conference'
  if (isTalkEmail(email)) return 'talk'
  return null
}

const MONTH_NAMES_MAP = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12'
}

function parseStandardDateStr(rawStr) {
  if (!rawStr) return ''
  const currentYear = new Date().getFullYear()
  const s = String(rawStr).trim().replace(/^[：:\-—~至到\s]+/, '')

  // 1. English month format: "YYYY, Month DD" (e.g., "2026, September 22" or "2026 Sep 22")
  const engYMD = s.match(/(?:^|[^\d])(20\d{2})\s*,\s*([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/i)
  if (engYMD) {
    const mStr = engYMD[2].toLowerCase()
    if (MONTH_NAMES_MAP[mStr]) {
      let y = parseInt(engYMD[1], 10)
      if (y < currentYear) y = currentYear
      const m = MONTH_NAMES_MAP[mStr]
      const d = engYMD[3].padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  // 2. English month format: "Month DD, YYYY" or "Month DD YYYY" (e.g., "September 22, 2026")
  const engMDY = s.match(/(?:^|[^A-Za-z])([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,\s*(20\d{2})/i)
    || s.match(/(?:^|[^A-Za-z])([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?\s+(20\d{2})/i)
  if (engMDY) {
    const mStr = engMDY[1].toLowerCase()
    if (MONTH_NAMES_MAP[mStr]) {
      let y = parseInt(engMDY[3], 10)
      if (y < currentYear) y = currentYear
      const m = MONTH_NAMES_MAP[mStr]
      const d = engMDY[2].padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  // 3. English month format: "DD Month YYYY" (e.g., "22 September 2026" or "22nd Sep 2026")
  const engDMY = s.match(/(?:^|[^\d])(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(20\d{2})/i)
  if (engDMY) {
    const mStr = engDMY[2].toLowerCase()
    if (MONTH_NAMES_MAP[mStr]) {
      let y = parseInt(engDMY[3], 10)
      if (y < currentYear) y = currentYear
      const m = MONTH_NAMES_MAP[mStr]
      const d = engDMY[1].padStart(2, '0')
      return `${y}-${m}-${d}`
    }
  }

  // 4. Chinese / ISO with year: "2026年9月22日", "2026-09-22", "2026/09/22", "2026.09.22"
  const fullMatch = s.match(/(?:^|[^\d])(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?/)
  if (fullMatch) {
    let y = parseInt(fullMatch[1], 10)
    if (y < currentYear) {
      y = currentYear
    }
    const m = fullMatch[2].padStart(2, '0')
    const d = fullMatch[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 5. English month format without year: "Month DD" or "DD Month"
  const engMDNoY = s.match(/(?:^|[^A-Za-z])([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s|$|[^A-Za-z\d])/i)
  if (engMDNoY && MONTH_NAMES_MAP[engMDNoY[1].toLowerCase()]) {
    const m = MONTH_NAMES_MAP[engMDNoY[1].toLowerCase()]
    const d = engMDNoY[2].padStart(2, '0')
    return `${currentYear}-${m}-${d}`
  }

  // 6. Chinese / short date without year: "9月22日", "09-22"
  const mdMatch = s.match(/(?:^|[^\d])(\d{1,2})[月/.-](\d{1,2})日?/)
  if (mdMatch) {
    const m = mdMatch[1].padStart(2, '0')
    const d = mdMatch[2].padStart(2, '0')
    return `${currentYear}-${m}-${d}`
  }

  return ''
}

/**
 * 本地规则解析学术会议邮件元数据
 * @param {string} text 邮件正文
 * @param {string} subject 邮件主题
 * @returns {Object} 会议各字段结构
 */
export function parseConferenceMetadataLocally(text = '', subject = '') {
  const combined = `${subject || ''}\n${text || ''}`

  // 1. 标题提取
  let title = (subject || '').replace(/^(?:提醒|通知|Fw|Fwd|转|转发)[:：\s]*/gi, '').trim()
  title = title.replace(/^[【\[](?:会议通知|学术会议|通知|参会邀请)[\]】]\s*/i, '').trim()
  title = title.replace(/^关于(?:召开|举办|组织)(?:的通知|的邀请)?/i, '').trim()
  const pageTitleMatch = text.match(/(?:页面标题|网页标题|会议名称|活动名称)[:：\s]*([^\n\r]+)/i)
  if (pageTitleMatch && pageTitleMatch[1].trim()) {
    title = pageTitleMatch[1].trim()
  } else if (!title && text) {
    const mFirstLine = text.split(/\r?\n/).find(l => {
      const cleanL = l.trim()
      return cleanL.length > 4 && !cleanL.startsWith('【活动官网') && !cleanL.startsWith('http')
    })
    if (mFirstLine) title = mFirstLine.trim().slice(0, 100)
  }
  title = pickChinesePartIfDual(title || '学术会议')

  // 2. 子类型判断
  let subType = '研讨会'
  const mExplicitType = combined.match(/(?:会议类型|活动类型|会议类别)[:：\s]*([^\s\n\r]+)/)
  if (mExplicitType) {
    const rawT = mExplicitType[1].trim()
    if (/国际/i.test(rawT)) subType = '国际会议'
    else if (/年会/i.test(rawT)) subType = '年会'
    else if (/暑期|研习|讲习/i.test(rawT)) subType = '暑期学校'
    else if (/论坛/i.test(rawT)) subType = '学术论坛'
    else if (/专题/i.test(rawT)) subType = '专题研讨'
    else if (/研讨/i.test(rawT)) subType = '研讨会'
  } else if (/国际会议(?!(?:中心|大酒店|酒店|展览|大厦))|international\s+conference/i.test(combined)) {
    subType = '国际会议'
  } else if (/年会|annual meeting/i.test(combined)) {
    subType = '年会'
  } else if (/暑期学校|暑假学校|讲习班|研习班|summer school|冬令营/i.test(combined)) {
    subType = '暑期学校'
  } else if (/论坛|forum/i.test(combined)) {
    subType = '学术论坛'
  } else if (/专题研讨|研讨班|symposium/i.test(combined)) {
    subType = '专题研讨'
  }

  // 3. 会议起止日期提取
  let startDate = ''
  let endDate = ''

  const currentYear = new Date().getFullYear()

  // 3.1 英文日期范围匹配
  const engRangeMatch1 = combined.match(/(?:^|[^\d])(20\d{2})\s*,\s*([A-Za-z]+)\s+(\d{1,2})\s*(?:-|—|——|~|to)\s*(\d{1,2})(?:st|nd|rd|th)?/i)
  const engRangeMatch2 = combined.match(/(?:^|[^\d])(\d{1,2})\s*(?:-|—|——|~|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(20\d{2})/i)
  const engRangeMatch3 = combined.match(/(?:^|[^A-Za-z])([A-Za-z]+)\s+(\d{1,2})\s*(?:-|—|——|~|to)\s*(\d{1,2})(?:st|nd|rd|th)?\s*,\s*(20\d{2})/i)
  const indicoStartsMatch = combined.match(/Starts\s+(?:.*?,)?\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|20\d{2},\s*[A-Za-z]+\s+\d{1,2})/i)
  const indicoEndsMatch = combined.match(/Ends\s+(?:.*?,)?\s*(\d{1,2}\s+[A-Za-z]+\s+20\d{2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|20\d{2},\s*[A-Za-z]+\s+\d{1,2})/i)

  if (engRangeMatch1 && MONTH_NAMES_MAP[engRangeMatch1[2].toLowerCase()]) {
    let y = parseInt(engRangeMatch1[1], 10)
    if (y < currentYear) y = currentYear
    const m = MONTH_NAMES_MAP[engRangeMatch1[2].toLowerCase()]
    const d1 = engRangeMatch1[3].padStart(2, '0')
    const d2 = engRangeMatch1[4].padStart(2, '0')
    startDate = `${y}-${m}-${d1}`
    endDate = `${y}-${m}-${d2}`
  } else if (engRangeMatch2 && MONTH_NAMES_MAP[engRangeMatch2[3].toLowerCase()]) {
    let y = parseInt(engRangeMatch2[4], 10)
    if (y < currentYear) y = currentYear
    const m = MONTH_NAMES_MAP[engRangeMatch2[3].toLowerCase()]
    const d1 = engRangeMatch2[1].padStart(2, '0')
    const d2 = engRangeMatch2[2].padStart(2, '0')
    startDate = `${y}-${m}-${d1}`
    endDate = `${y}-${m}-${d2}`
  } else if (engRangeMatch3 && MONTH_NAMES_MAP[engRangeMatch3[1].toLowerCase()]) {
    let y = parseInt(engRangeMatch3[4], 10)
    if (y < currentYear) y = currentYear
    const m = MONTH_NAMES_MAP[engRangeMatch3[1].toLowerCase()]
    const d1 = engRangeMatch3[2].padStart(2, '0')
    const d2 = engRangeMatch3[3].padStart(2, '0')
    startDate = `${y}-${m}-${d1}`
    endDate = `${y}-${m}-${d2}`
  } else if (indicoStartsMatch && indicoEndsMatch) {
    const sDate = parseStandardDateStr(indicoStartsMatch[1])
    const eDate = parseStandardDateStr(indicoEndsMatch[1])
    if (sDate) {
      startDate = sDate
      endDate = eDate || sDate
    }
  }

  if (!startDate) {
    const rangeMatch1 = combined.match(/(?:^|[^\d])(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})日?\s*(?:-|—|——|~|至|到)\s*(?:(20\d{2})[年/.-])?(?:(\d{1,2})[月/.-])?(\d{1,2})日?/)
    if (rangeMatch1) {
      let y1 = parseInt(rangeMatch1[1], 10)
      if (y1 < currentYear) y1 = currentYear
      const m1 = rangeMatch1[2].padStart(2, '0')
      const d1 = rangeMatch1[3].padStart(2, '0')
      let y2 = rangeMatch1[4] ? parseInt(rangeMatch1[4], 10) : y1
      if (y2 < currentYear) y2 = currentYear
      const m2 = (rangeMatch1[5] || m1).padStart(2, '0')
      const d2 = rangeMatch1[6].padStart(2, '0')
      startDate = `${y1}-${m1}-${d1}`
      endDate = `${y2}-${m2}-${d2}`
    } else {
      const rangeMatch2 = combined.match(/(?:^|[^\d])(\d{1,2})月(\d{1,2})日?\s*(?:-|—|——|~|至|到)\s*(?:(\d{1,2})月)?(\d{1,2})日?/)
      if (rangeMatch2) {
        const y = new Date().getFullYear()
        const m1 = rangeMatch2[1].padStart(2, '0')
        const d1 = rangeMatch2[2].padStart(2, '0')
        const m2 = (rangeMatch2[3] || m1).padStart(2, '0')
        const d2 = rangeMatch2[4].padStart(2, '0')
        startDate = `${y}-${m1}-${d1}`
        endDate = `${y}-${m2}-${d2}`
      } else {
        const singleDate = parseStandardDateStr(combined)
        if (singleDate) {
          startDate = singleDate
          endDate = singleDate
        }
      }
    }
  }

  // 4. 城市与具体地点提取
  let city = ''
  let location = ''
  const mCityInAt = combined.match(/(?:在|于|地点|举办地|举办城市)[:：\s]*([^\s,，。；\n\r]{2,12}?)(?:市|地区|省)?(?:\s*举办|\s*召开|\s*举行|\s*大厦|\s*酒店|\s*宾馆|\s*校区)/)
  if (mCityInAt) {
    const cand = mCityInAt[1].trim().replace(/^.+?省/, '').replace(/(?:省|市|地区)$/, '')
    if (cand.length >= 2 && cand.length <= 6) city = cand
  }
  if (!city) {
    const cityList = ['北京', '上海', '南京', '合肥', '开封', '杭州', '武汉', '广州', '深圳', '成都', '重庆', '西安', '昆明', '青岛', '厦门', '天津', '苏州', '长沙', '大连', '长春', '哈尔滨', '兰州', '贵阳', '太原', '海口', '三亚']
    for (const c of cityList) {
      if (combined.includes(c)) {
        city = c
        break
      }
    }
  }
  if (!city) {
    const engCityMap = {
      shanghai: '上海', beijing: '北京', nanjing: '南京', hefei: '合肥',
      hangzhou: '杭州', wuhan: '武汉', guangzhou: '广州', shenzhen: '深圳',
      chengdu: '成都', chongqing: '重庆', xian: '西安', "xi'an": '西安',
      kunming: '昆明', qingdao: '青岛', xiamen: '厦门', tianjin: '天津',
      suzhou: '苏州', changsha: '长沙'
    }
    for (const [eng, chn] of Object.entries(engCityMap)) {
      if (new RegExp(`\\b${eng}\\b`, 'i').test(combined)) {
        city = chn
        break
      }
    }
  }

  const mHotel = combined.match(/(?:地点|会场|入住酒店|入住|会议地点|开会地点)[:：\s]*([^\n\r,，。；]{4,50})/)
    || combined.match(/([^\n\r,，。；\s]{2,20}?(?:酒店|宾馆|国际会议中心|学术交流中心|大厦|会议室|报告厅|校区))/i)
  if (mHotel) {
    location = mHotel[1].trim().replace(/^(?:酒店|宾馆)[:：\s]*/, '')
  }

  // 5. 主办单位提取
  let organizer = ''
  const mOrgColon = combined.match(/(?:主办单位|主办方|主办机构|承办单位|承办方|组织委员会)[:：\s]*([^\n\r,，。；]{2,40})/i)
  const mOrgDirect = combined.match(/(?:由)?\s*([^\s,，。；\n\r]{2,40}?)\s*(?:联合)?(?:主办|承办|组织)/i)
  if (mOrgColon) {
    organizer = mOrgColon[1].trim()
  } else if (mOrgDirect && !/^(?:各位|大家|本周|本次|定于)/.test(mOrgDirect[1].trim())) {
    organizer = mOrgDirect[1].trim().replace(/^由/, '')
  } else {
    const mOrgKeyword = combined.match(/([^\s,，。；\n\r]{2,25}?(?:天文台|天文学会|学会|研究所|大学|学院|中心))/i)
    if (mOrgKeyword) {
      organizer = mOrgKeyword[1].trim().replace(/^由/, '')
    }
  }

  // 6. 截止与关键日期提取 (摘要开始、摘要截止、早鸟截止、报名截止)
  let abstractStartDate = ''
  let abstractDeadline = ''
  let earlyBirdDeadline = ''
  let registrationDeadline = ''

  // 6.1 摘要阶段范围提取（如：摘要提交：2026-09-22 至 2026-10-22 或 Call for abstracts: 2026, September 22 - 2026, October 22）
  const mAbsRange = combined.match(/(?:摘要(?:提交|投递|征稿)?|call\s*for\s*abstracts?|abstract\s*submission)[\s:：\-—]*((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})\s*(?:-|—|——|~|至|到|to)\s*((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
  if (mAbsRange) {
    abstractStartDate = parseStandardDateStr(mAbsRange[1])
    abstractDeadline = parseStandardDateStr(mAbsRange[2])
  }

  // 6.2 摘要开始日期提取（如：Call for abstracts - 2026, September 22 或 摘要提交开始：2026年9月22日）
  if (!abstractStartDate) {
    const mAbsStart = combined.match(/(?:call\s*for\s*abstracts?(?:\s*opens?|\s*begins?|\s*starts?)?|摘要(?:提交|投递|征集|征稿)?(?:开始|开放|起)(?:时间|日期)?)[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    if (mAbsStart && !/deadline|截止|截稿/i.test(mAbsStart[0])) {
      abstractStartDate = parseStandardDateStr(mAbsStart[1])
    }
  }

  // 6.3 摘要截止日期提取（如：Abstract submission deadline - 2026, October 22 或 摘要提交截止时间：2026年10月22日）
  if (!abstractDeadline) {
    const mAbsDeadline = combined.match(/(?:abstract\s*(?:submission\s*)?deadline|call\s*for\s*abstracts?\s*deadline|摘要(?:提交|投递|征稿)?(?:截止|截稿)(?:日期|时间)?)[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
      || combined.match(/摘要(?:投递|提交|截稿|截止|日期|时间)*[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    if (mAbsDeadline) {
      abstractDeadline = parseStandardDateStr(mAbsDeadline[1])
    }
  }

  // 6.4 早鸟截止日期提取
  const mEb = combined.match(/早鸟(?:优惠|注册|报名|截稿|截止|日期|时间)*[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    || combined.match(/(?:early\s*bird(?:\s*registration)?(?:\s*deadline)?)[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
  if (mEb) earlyBirdDeadline = parseStandardDateStr(mEb[1])

  // 6.5 注册/报名截止日期提取
  const regMatches = [...combined.matchAll(/(?:正式|常规|普通)?(?:参会)?(?:注册|报名)(?:截止|截止日期|截止时间|时间)?[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/gi)]
  for (const m of regMatches) {
    const idx = m.index || 0
    const prefix = combined.slice(Math.max(0, idx - 10), idx)
    if (/早鸟|early/i.test(prefix)) {
      continue
    }
    registrationDeadline = parseStandardDateStr(m[1])
    break
  }
  if (!registrationDeadline) {
    const mRegFallback = combined.match(/(?:registration\s*deadline)[\s:：\-—]+((?:20\d{2}[年/.-])?\d{1,2}[月/.-]\d{1,2}日?|20\d{2},\s*[A-Za-z]+\s+\d{1,2}|[A-Za-z]+\s+\d{1,2},\s*20\d{2}|\d{1,2}\s+[A-Za-z]+\s+20\d{2})/i)
    if (mRegFallback) registrationDeadline = parseStandardDateStr(mRegFallback[1])
  }

  // 7. 网址链接提取
  let websiteUrl = ''
  let registrationUrl = ''
  const urlMatches = [...combined.matchAll(/https?:\/\/[^\s<>"'()]+/gi)]
  for (const m of urlMatches) {
    const u = m[0]
    const idx = m.index || 0
    const lineBefore = (combined.slice(0, idx).split(/\r?\n/).pop() || '').trim()

    const isSubpageHeader = /^[【\[]相关子页面|^[【\[]子页面/i.test(lineBefore)
    const isExplicitWeb = /(?:官网|主页|网站|web|homepage|portal)/i.test(lineBefore)
    const isExplicitReg = /(?:报名|注册|问卷|表单|入口|参会登记)/i.test(lineBefore)
    const isRegToolUrl = /wjx\.cn|wj\.qq\.com|huodongxing|jinshuju|forms\.gle|google\.com\/forms|wenjuan\.com/i.test(u)
    const isRegPathUrl = /\/(?:register|registration|signup|baoming)($|\/|\?)/i.test(u)

    if (isRegToolUrl) {
      registrationUrl = u
    } else if ((isExplicitReg || isRegPathUrl) && !isSubpageHeader) {
      if (!registrationUrl) {
        registrationUrl = u
      }
    } else if (isExplicitWeb && !isSubpageHeader) {
      if (!websiteUrl) {
        websiteUrl = u
      }
    } else if (!isSubpageHeader) {
      if (!websiteUrl) {
        websiteUrl = u
      }
    }
  }

  return {
    title,
    sub_type: subType,
    date: startDate || new Date().toISOString().slice(0, 10),
    end_date: endDate || startDate || new Date().toISOString().slice(0, 10),
    city,
    location,
    organizer,
    abstract_start_date: abstractStartDate,
    abstract_deadline: abstractDeadline,
    early_bird_deadline: earlyBirdDeadline,
    registration_deadline: registrationDeadline,
    website_url: websiteUrl,
    registration_url: registrationUrl,
    handbook_url: '',
    source: subject || '',
    notes: text.slice(0, 2500),
    poster_url: ''
  }
}
