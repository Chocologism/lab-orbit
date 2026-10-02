import { describe, it, expect, vi } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import { generatePaperRis, downloadRisFile } from '../utils/risExport'
import { zoteroApi } from '../api/client'

describe('Zotero Web API & RIS Export Integration', () => {
  const paperSample = {
    arxiv_id: 'arXiv:2401.09999v2',
    title: 'Strong Lensing Reconstruction via Deep Learning and Wavelets',
    authors: ['Alex Doe', 'Jane Doe', 'John Smith'],
    abstract: 'We present a novel method for strong gravitational lensing reconstruction using multi-frequency data.',
    published: '2024-01-15T08:00:00Z',
    journal: 'ApJ Letters',
    doi: '10.3847/2041-8213/ad1234',
    recommend_comment: '重点关注 Section 3 的透镜反演网络结构与小波损失函数设计'
  }

  const translationSample = {
    title: '基于深度学习与小波分析的强引力透镜重构方法',
    abstract: '我们提出了一种利用多频段观测数据进行强引力透镜重构的新方法。'
  }

  describe('RIS Generation (generatePaperRis)', () => {
    it('generates standard RIS lines with correct metadata', () => {
      const ris = generatePaperRis(paperSample, translationSample)

      expect(ris).toContain('TY  - PREP')
      expect(ris).toContain('TI  - Strong Lensing Reconstruction via Deep Learning and Wavelets')
      expect(ris).toContain('AU  - Alex Doe')
      expect(ris).toContain('AU  - Jane Doe')
      expect(ris).toContain('AU  - John Smith')
      expect(ris).toContain('AB  - We present a novel method for strong gravitational lensing reconstruction using multi-frequency data.')
      expect(ris).toContain('PY  - 2024')
      expect(ris).toContain('DA  - 2024-01-15T08:00:00Z')
      expect(ris).toContain('DO  - 10.3847/2041-8213/ad1234')
      expect(ris).toContain('JF  - ApJ Letters')
      expect(ris).toContain('M3  - arXiv:2401.09999')
      expect(ris).toContain('UR  - https://arxiv.org/abs/2401.09999')
      expect(ris).toContain('L1  - https://arxiv.org/pdf/2401.09999.pdf')
      expect(ris).toContain('ER  - ')
    })

    it('includes translation and recommendation notes in RIS content', () => {
      const ris = generatePaperRis(paperSample, translationSample)

      expect(ris).toContain('N1  - 【学术中文标题】: 基于深度学习与小波分析的强引力透镜重构方法')
      expect(ris).toContain('N1  - 【学术中文摘要】: 我们提出了一种利用多频段观测数据进行强引力透镜重构的新方法。')
      expect(ris).toContain('N1  - 推荐理由: 重点关注 Section 3 的透镜反演网络结构与小波损失函数设计')
    })

    it('handles minimal papers without DOI, journal or translation', () => {
      const minimalPaper = {
        arxiv_id: '2305.12345',
        title: 'Simple Minimal Paper',
        authors: 'Solo Author'
      }
      const ris = generatePaperRis(minimalPaper, null)

      expect(ris).toContain('TY  - PREP')
      expect(ris).toContain('TI  - Simple Minimal Paper')
      expect(ris).toContain('AU  - Solo Author')
      expect(ris).toContain('M3  - arXiv:2305.12345')
      expect(ris).toContain('ER  - ')
      expect(ris).not.toContain('DO  - ')
    })
  })

  describe('downloadRisFile browser triggering', () => {
    it('creates Blob with application/x-research-info-systems MIME and triggers link click', () => {
      const mockClick = vi.fn()
      const mockElement = {
        href: '',
        download: '',
        click: mockClick
      }
      const mockBody = {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
      global.document = {
        createElement: vi.fn(() => mockElement),
        body: mockBody
      }
      global.window = {}
      global.Blob = class {
        constructor(content, options) {
          this.content = content
          this.options = options
        }
      }
      const mockRevoke = vi.fn()
      const mockCreate = vi.fn(() => 'blob:mock-url')
      global.URL = {
        createObjectURL: mockCreate,
        revokeObjectURL: mockRevoke
      }

      const res = downloadRisFile(paperSample, translationSample)

      expect(res).toBe(true)
      expect(mockCreate).toHaveBeenCalled()
      expect(mockBody.appendChild).toHaveBeenCalledWith(mockElement)
      expect(mockClick).toHaveBeenCalled()
      expect(mockBody.removeChild).toHaveBeenCalledWith(mockElement)
      expect(mockElement.download).toBe('2401.09999_zotero.ris')
    })
  })

  describe('AccountView.vue Zotero configuration section', () => {
    const filePath = path.resolve(__dirname, 'AccountView.vue')
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = parse(content)

    it('contains anchor navigation to #section-zotero and section element', () => {
      const template = parsed.descriptor.template?.content || ''
      expect(template).toContain('href="#section-zotero"')
      expect(template).toContain('id="section-zotero"')
      expect(template).toContain('Zotero 文献库直连设置')
      expect(template).toContain('zotero-status-badge')
    })

    it('defines zoteroApi imports and configuration handler methods', () => {
      const script = parsed.descriptor.scriptSetup?.content || ''
      expect(script).toContain('zoteroApi')
      expect(script).toContain('loadZoteroConfig')
      expect(script).toContain('loadZoteroCollections')
      expect(script).toContain('handleSaveZotero')
      expect(script).toContain('handleRefreshZoteroCollections')
      expect(script).toContain('handleClearZotero')
    })

    it('includes styling for zotero section and status badge', () => {
      const style = parsed.descriptor.styles[0]?.content || ''
      expect(style).toContain('.zotero-account-section')
      expect(style).toContain('.zotero-status-badge')
    })
  })

  describe('ArxivFeedView.vue Zotero push integration', () => {
    const filePath = path.resolve(__dirname, 'ArxivFeedView.vue')
    const content = fs.readFileSync(filePath, 'utf8')
    const parsed = parse(content)

    it('contains zotero-push-btn on paper cards', () => {
      const template = parsed.descriptor.template?.content || ''
      expect(template).toContain('class="zotero-push-btn button small secondary"')
      expect(template).toContain('@click="openZoteroPushModal(paper)"')
      expect(template).toContain('存入 Zotero')
    })

    it('contains BaseDialog modal for Zotero push and RIS export', () => {
      const template = parsed.descriptor.template?.content || ''
      expect(template).toContain(':open="zoteroModalOpen"')
      expect(template).toContain('存入 Zotero 个人文献库')
      expect(template).toContain('zotero-modal-body')
      expect(template).toContain('handleExportRis')
      expect(template).toContain('handlePushToZotero')
    })

    it('defines script methods for modal management, RIS export and Zotero cloud push', () => {
      const script = parsed.descriptor.scriptSetup?.content || ''
      expect(script).toContain('openZoteroPushModal')
      expect(script).toContain('closeZoteroModal')
      expect(script).toContain('handlePushToZotero')
      expect(script).toContain('handleExportRis')
      expect(script).toContain('zoteroCustomNote')
      expect(script).toContain('zoteroTagsInput')
      expect(script).toContain('zoteroApi.pushPaper')
    })

    it('embeds ZoteroCollectionTree, note textarea and tags input in modal', () => {
      const template = parsed.descriptor.template?.content || ''
      expect(template).toContain('ZoteroCollectionTree')
      expect(template).toContain('zotero-custom-note-textarea')
      expect(template).toContain('zotero-tags-input')
    })

    it('includes CSS for zotero button, tree modal, note and tag inputs', () => {
      const style = parsed.descriptor.styles[0]?.content || ''
      expect(style).toContain('.zotero-push-btn')
      expect(style).toContain('.zotero-modal-body')
      expect(style).toContain('.zotero-custom-note-textarea')
      expect(style).toContain('.zotero-tags-input')
      expect(style).toContain('.unconfigured-action-boxes')
    })
  })

  describe('zoteroApi client methods', () => {
    it('exports all expected API endpoints', () => {
      expect(typeof zoteroApi.getConfig).toBe('function')
      expect(typeof zoteroApi.saveConfig).toBe('function')
      expect(typeof zoteroApi.clearConfig).toBe('function')
      expect(typeof zoteroApi.getCollections).toBe('function')
      expect(typeof zoteroApi.pushPaper).toBe('function')
    })
  })
})
