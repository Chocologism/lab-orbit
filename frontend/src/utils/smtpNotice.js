/**
 * 将外部邮箱输入（逗号、分号、换行分隔）解析并校验提取为合法邮箱列表
 */
export function parseExternalEmails(raw) {
  if (!raw) return []
  const tokens = String(raw).split(/[\s,;，；\n\r]+/).map(s => s.trim()).filter(Boolean)
  const validEmails = []
  const seen = new Set()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  for (const t of tokens) {
    const clean = t.toLowerCase()
    if (emailRegex.test(clean) && !seen.has(clean)) {
      seen.add(clean)
      validEmails.push(clean)
    }
  }
  return validEmails
}

/**
 * 格式化组会日期与时间为自然语言（如：9月16日（周三）上午10点）
 */
export function formatSeminarDateTime(dateStr, timeStr) {
  if (!dateStr) return ''
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const parts = String(dateStr).split('-')
  if (parts.length < 3) return `${dateStr} ${timeStr || ''}`.trim()

  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)
  const d = new Date(`${dateStr}T00:00:00`)
  const w = isNaN(d.getDay()) ? '' : weekdays[d.getDay()]

  let formattedTime = (timeStr || '').trim()
  if (formattedTime) {
    const [hStr, mStr] = formattedTime.split(':')
    const h = parseInt(hStr, 10)
    const m = parseInt(mStr || '0', 10)
    if (!isNaN(h)) {
      const period = h < 12 ? '上午' : (h === 12 ? '中午' : '下午')
      const hourDisplay = h > 12 ? (h - 12) : (h === 0 ? 12 : h)
      if (m === 0) {
        formattedTime = `${period}${hourDisplay}点`
      } else {
        formattedTime = `${period}${hourDisplay}点${m}分`
      }
    }
  }

  const datePart = `${month}月${day}日${w ? `（${w}）` : ''}`
  return `${datePart}${formattedTime || ''}`.trim()
}

/**
 * 组会通知标准模板生成器（符合台里/组内标准格式）
 */
export function buildSeminarNoticeBody(params) {
  const formattedTime = formatSeminarDateTime(params.dateStr, params.timeStr)
  const loc = (params.location || '').trim()

  // 区分线下地点与线上腾讯会议
  let offlineLoc = loc
  let onlineMeeting = ''

  const onlineMatch = loc.match(/(腾讯会议|Zoom|会议号|Voov)[:：\s]*([0-9\s\-]+)/i)
  if (onlineMatch) {
    onlineMeeting = onlineMatch[0].trim()
    offlineLoc = loc.replace(onlineMatch[0], '').replace(/[\/|,，]/g, '').trim()
  }

  if (!offlineLoc && !onlineMeeting) {
    offlineLoc = '5-511'
    onlineMeeting = '腾讯会议 911-575-921'
  } else if (!offlineLoc) {
    offlineLoc = '5-511'
  }

  const lines = [
    '大家好，',
    '',
    '下次组会安排如下：',
    `- 时间：${formattedTime || '待定'}`,
    `- 地点：${offlineLoc}`
  ]

  if (onlineMeeting) {
    lines.push(`- 线上：${onlineMeeting}`)
  }

  lines.push('')
  lines.push(`主讲人：${params.presenterName || '待定'}`)
  lines.push(`题目：${params.topic || '近期科研进展与工作汇报'}`)

  const abstractText = (params.abstract || '').trim()
  lines.push(`摘要：${abstractText || '（待主讲人补充）'}`)
  lines.push('')

  const sharers = (params.presentationsText || '').trim()
  lines.push(`Arxiv主讲人：${sharers || '无'}`)
  lines.push('')
  lines.push('请大家准时参加，谢谢！')
  lines.push('')
  lines.push('祝好，')
  lines.push(params.adminName || '管理员')

  return lines.join('\n')
}

/**
 * 生成标准富文本 HTML 组会通知（线下地点标红高亮）
 */
export function buildSeminarNoticeHtml(params) {
  const formattedTime = formatSeminarDateTime(params.dateStr, params.timeStr)
  const loc = (params.location || '').trim()

  let offlineLoc = loc
  let onlineMeeting = ''

  const onlineMatch = loc.match(/(腾讯会议|Zoom|会议号|Voov)[:：\s]*([0-9\s\-]+)/i)
  if (onlineMatch) {
    onlineMeeting = onlineMatch[0].trim()
    offlineLoc = loc.replace(onlineMatch[0], '').replace(/[\/|,，]/g, '').trim()
  }

  if (!offlineLoc && !onlineMeeting) {
    offlineLoc = '5-511'
    onlineMeeting = '腾讯会议 911-575-921'
  } else if (!offlineLoc) {
    offlineLoc = '5-511'
  }

  const presenterName = params.presenterName || '待定'
  const topic = params.topic || '近期科研进展与工作汇报'
  const abstractText = (params.abstract || '').trim() || '（待主讲人补充）'
  const sharers = (params.presentationsText || '').trim() || '无'
  const adminName = params.adminName || '管理员'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif; font-size: 15px; line-height: 1.7; color: #1f2937;">
  <p style="margin: 0 0 16px 0;">大家好，</p>
  <p style="margin: 0 0 8px 0;">下次组会安排如下：</p>
  <ul style="margin: 0 0 16px 0; padding-left: 20px; list-style-type: disc;">
    <li style="margin-bottom: 4px;"><strong>时间</strong>：${formattedTime || '待定'}</li>
    <li style="margin-bottom: 4px;"><strong>地点</strong>：<span style="color: #e53333; font-weight: bold;">${offlineLoc}</span></li>
    ${onlineMeeting ? `<li style="margin-bottom: 4px;"><strong>线上</strong>：${onlineMeeting}</li>` : ''}
  </ul>
  <p style="margin: 0 0 4px 0;"><strong>主讲人</strong>：${presenterName}</p>
  <p style="margin: 0 0 4px 0;"><strong>题目</strong>：${topic}</p>
  <p style="margin: 0 0 16px 0;"><strong>摘要</strong>：${abstractText}</p>
  <p style="margin: 0 0 16px 0;"><strong>Arxiv主讲人</strong>：${sharers}</p>
  <p style="margin: 0 0 16px 0;">请大家准时参加，谢谢！</p>
  <p style="margin: 0 0 4px 0;">祝好，</p>
  <p style="margin: 0;">${adminName}</p>
</div>
`.trim()
}

/**
 * 将任意纯文本组会通知转化为支持地点高亮标红的 HTML
 */
export function formatNoticeBodyToHtml(text) {
  if (!text) return ''
  const lines = text.split('\n')
  const htmlLines = lines.map(line => {
    let l = line.trim()
    if (!l) return '<br>'
    if (/^-\s*地点[：:]/i.test(l) || /^地点[：:]/i.test(l)) {
      l = l.replace(/(地点[：:]\s*)(.+)$/i, (_m, p1, p2) => `${p1}<span style="color: #e53333; font-weight: bold;">${p2}</span>`)
    }
    l = l.replace(/^(时间|地点|线上|主讲人|题目|摘要|Arxiv主讲人|arXiv分享人|arXiv主讲人)[：:]/i, '<strong>$1</strong>：')
    l = l.replace(/^-\s*(时间|地点|线上)[：:]/i, '• <strong>$1</strong>：')
    return `<div style="margin-bottom: 4px;">${l}</div>`
  })
  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 15px; line-height: 1.7; color: #1f2937;">${htmlLines.join('')}</div>`
}
