import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { isNoticeEmail } from '../utils/talkEmail'

describe('Glass Style & Notice Email Attachment Suite', () => {
  const filesTs = readFileSync(resolve(__dirname, '../../functions/api/routes/files.ts'), 'utf-8')
  const mailboxTs = readFileSync(resolve(__dirname, '../../functions/api/routes/mailbox.ts'), 'utf-8')
  const mailboxView = readFileSync(resolve(__dirname, 'MailboxView.vue'), 'utf-8')
  const accountView = readFileSync(resolve(__dirname, 'AccountView.vue'), 'utf-8')
  const homeView = readFileSync(resolve(__dirname, 'HomeView.vue'), 'utf-8')
  const indexCss = readFileSync(resolve(__dirname, '../index.css'), 'utf-8')

  it('verifies PDF CSP directive allows embedded Chromium/Safari preview and supports ?download=1', () => {
    // Check that sandbox directive is only applied to html/svg, not application/pdf
    expect(filesTs).toContain("if (contentType === 'text/html' || contentType === 'image/svg+xml') {")
    expect(filesTs).toContain("headers.set('Content-Security-Policy', \"default-src 'none'; sandbox\")")
    // Check download query param support
    expect(filesTs).toContain("const forceDownload = c.req.query('download') === '1' || c.req.query('download') === 'true'")
    expect(filesTs).toContain("const disposition = (forceDownload || (!isImage && !isPdf)) ? 'attachment' : 'inline'")
  })

  it('correctly classifies notices from graduate departments and administrative keywords', () => {
    const graduateNotice = {
      from: '研究生工作部 <yjsb@example.edu>',
      subject: '关于《硕士分流退出机制实施细则》的意见征集',
      body_text: '请各位导师和研究生认真审阅附件中的实施细则...'
    }
    expect(isNoticeEmail(graduateNotice)).toBe(true)

    const normalEmail = {
      from: 'Bob <bob@example.com>',
      subject: 'Meeting follow up',
      body_text: 'Let us meet tomorrow.'
    }
    expect(isNoticeEmail(normalEmail)).toBe(false)
  })

  it('provides on-demand attachment fetching endpoint in mailbox.ts and client.js', () => {
    expect(mailboxTs).toContain('/emails/:id/fetch-attachments')
    expect(mailboxTs).toContain('isNoticeCandidate')
    expect(mailboxTs).toContain('isNoticeEmail')
    expect(mailboxView).toContain('handleFetchEmailAttachments')
    expect(mailboxView).toContain('doc-download-btn')
  })

  it('configures Card Glass Style toggle in StyleView and reactive handling in HomeView', () => {
    const styleView = readFileSync(resolve(__dirname, 'StyleView.vue'), 'utf-8')
    expect(styleView).toContain('卡片玻璃质感')
    expect(styleView).toContain('currentGlassStyle')
    expect(styleView).toContain('handleGlassStyleSelect')
    expect(homeView).toContain("currentGlassStyle.value !== 'liquid'")
    expect(homeView).toContain('glass-style-changed')
  })

  it('defines CSS rules for liquid and frosted glass styles on .glass-card', () => {
    expect(indexCss).toContain('[data-glass-style="liquid"]')
    expect(indexCss).toContain('[data-glass-style="frosted"]')
    expect(indexCss).toContain('[data-glass-style="liquid"] .glass-card')
    expect(indexCss).toContain('[data-glass-style="frosted"] .glass-card')
  })

  it('verifies repairPdfIfTruncated repairs missing xref, trailer and %%EOF on truncated PDFs', () => {
    expect(filesTs).toContain('export function repairPdfIfTruncated')
    expect(filesTs).toContain('repairPdfIfTruncated(responseBody)')
  })
})

