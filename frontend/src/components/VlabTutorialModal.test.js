import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { parse } from '@vue/compiler-sfc'
import {
  OS_OPTIONS,
  TUTORIAL_CHAPTERS,
  getTutorialData,
  generateTutorialMarkdown
} from '../utils/vlabTutorialContent.js'

describe('USTC VLab Tutorial Modal & Multi-OS Content Engine', () => {
  const modalPath = path.resolve(__dirname, 'VlabTutorialModal.vue')
  const modalContent = fs.readFileSync(modalPath, 'utf8')
  const modalParsed = parse(modalContent)

  describe('OS Options & Chapter Definitions', () => {
    it('supports all major operating systems (All, macOS, Windows, Linux, WSL)', () => {
      const ids = OS_OPTIONS.map(o => o.id)
      expect(ids).toEqual(['all', 'macos', 'windows', 'linux', 'wsl'])
    })

    it('defines 13 comprehensive structured chapters', () => {
      expect(TUTORIAL_CHAPTERS.length).toBe(13)
      const chapterIds = TUTORIAL_CHAPTERS.map(c => c.id)
      expect(chapterIds).toContain('overview')
      expect(chapterIds).toContain('step-key')
      expect(chapterIds).toContain('step-vlab')
      expect(chapterIds).toContain('step-ssh-key')
      expect(chapterIds).toContain('step-first-login')
      expect(chapterIds).toContain('step-verify-api')
      expect(chapterIds).toContain('step-proxy-server')
      expect(chapterIds).toContain('step-vlab-systemd')
      expect(chapterIds).toContain('step-local-tunnel')
      expect(chapterIds).toContain('step-local-autostart')
      expect(chapterIds).toContain('step-web-setup')
      expect(chapterIds).toContain('step-optional-dsh')
      expect(chapterIds).toContain('step-troubleshooting')
    })
  })

  describe('Structured Tutorial Data & OS Content Filtering', () => {
    it('provides complete architecture diagram and security principles', () => {
      const data = getTutorialData('all')
      const overview = data.sections.find(s => s.id === 'overview')
      expect(overview).toBeDefined()
      expect(overview.highlights.some(h => h.includes('真实 API Key 仅保存在校内 VLab 虚拟机中'))).toBe(true)
      expect(overview.highlights.some(h => h.includes('127.0.0.1:4000'))).toBe(true)
    })

    it('contains proxy-server.py with FastAPI streaming reverse proxy', () => {
      const data = getTutorialData('all')
      const proxySec = data.sections.find(s => s.id === 'step-proxy-server')
      expect(proxySec).toBeDefined()
      expect(proxySec.codeSnippet.content).toContain('FastAPI(title="USTC LLM Secure Proxy")')
      expect(proxySec.codeSnippet.content).toContain('StreamingResponse(stream_generator(), media_type="text/event-stream")')
      expect(proxySec.codeSnippet.content).toContain('https://api.llm.ustc.edu.cn/v1')
      expect(proxySec.codeSnippet.content).toContain('port=4000')

      const verifySec = data.sections.find(s => s.id === 'step-verify-api')
      expect(verifySec).toBeDefined()
      expect(verifySec.commands.some(c => c.includes('https://api.llm.ustc.edu.cn/v1/models'))).toBe(true)
    })

    it('contains systemd linger configuration for VLab session persistence', () => {
      const data = getTutorialData('all')
      const sysSec = data.sections.find(s => s.id === 'step-vlab-systemd')
      expect(sysSec).toBeDefined()
      expect(sysSec.commands.some(c => c.includes('loginctl enable-linger'))).toBe(true)
      expect(sysSec.commands.some(c => c.includes('ustc-proxy.service'))).toBe(true)
    })

    it('provides multi-OS specific autostart solutions', () => {
      const data = getTutorialData('all')
      const autostart = data.sections.find(s => s.id === 'step-local-autostart')
      expect(autostart.osGuidance.macos.title).toContain('Launchd')
      expect(autostart.osGuidance.macos.commands.some(c => c.includes('com.ustc.vlab-tunnel.plist'))).toBe(true)

      expect(autostart.osGuidance.windows.title).toContain('任务计划程序')
      expect(autostart.osGuidance.windows.commands.some(c => c.includes('Register-ScheduledTask'))).toBe(true)

      expect(autostart.osGuidance.linux.title).toContain('systemd')
      expect(autostart.osGuidance.linux.commands.some(c => c.includes('ustc-tunnel.service'))).toBe(true)
    })

    it('includes CSBD Web Assistant setup and browser Mixed Content unblock guide', () => {
      const data = getTutorialData('all')
      const webSec = data.sections.find(s => s.id === 'step-web-setup')
      expect(webSec).toBeDefined()
      const mixedContentStep = webSec.steps.find(s => s.title.includes('Mixed Content'))
      expect(mixedContentStep).toBeDefined()
      expect(mixedContentStep.substeps.some(st => st.includes('不安全内容'))).toBe(true)
      expect(mixedContentStep.substeps.some(st => st.includes('允许'))).toBe(true)
    })

    it('includes optional DeepSeek Harness (dsh) configuration step', () => {
      const data = getTutorialData('all')
      const dshSec = data.sections.find(s => s.id === 'step-optional-dsh')
      expect(dshSec).toBeDefined()
      expect(dshSec.steps.some(s => s.command?.includes('@deepseek-ai/dsh web'))).toBe(true)
    })

    it('prompts user about API Key application review duration', () => {
      const data = getTutorialData('all')
      const keySec = data.sections.find(s => s.id === 'step-key')
      expect(keySec).toBeDefined()
      expect(keySec.notice).toContain('半天到一天时间')
      expect(keySec.steps.some(st => st.desc.includes('半天到一天时间'))).toBe(true)
    })

    it('provides detailed 7-step guide for VLab creation, power on, and SSH key pair generation', () => {
      const data = getTutorialData('all')
      const vlabSec = data.sections.find(s => s.id === 'step-vlab')
      expect(vlabSec).toBeDefined()
      expect(vlabSec.title).toContain('创建 VLab 虚拟机与生成下载密钥')
      expect(vlabSec.steps.length).toBe(7)
      expect(vlabSec.steps[0].title).toContain('登录 VLab 平台')
      expect(vlabSec.steps[1].title).toContain('新建虚拟机')
      expect(vlabSec.steps[1].desc).toContain('ustc-ai-proxy')
      expect(vlabSec.steps[2].title).toContain('开机')
      expect(vlabSec.steps[3].title).toContain('设置 VLab 平台密码')
      expect(vlabSec.steps[4].title).toContain('SSH 密钥管理')
      expect(vlabSec.steps[5].title).toContain('生成新的 SSH 密钥对')
      expect(vlabSec.steps[6].title).toContain('下载私钥')
    })
  })

  describe('Agent Markdown Document Generation', () => {
    it('generates rich markdown tailored for local coding agents with zero emoji', () => {
      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('# 中国科大大模型 VLab 虚拟机 SSH 隧道配置完整指南')
      expect(mdAll).toContain('给本地 AI 编程 Agent 的执行提示')
      expect(mdAll).toContain('Cursor, Claude Code, Antigravity')
      expect(mdAll).toContain('https://llm.ustc.edu.cn/')
      expect(mdAll).toContain('https://vlab.ustc.edu.cn/')
      expect(mdAll).toContain('127.0.0.1:4000')
      expect(mdAll).toContain('Mixed Content')
      expect(mdAll).toContain('npx @deepseek-ai/dsh web')
      expect(mdAll).toContain('申请通过大概需要半天到一天时间')
      expect(mdAll).toContain('新建虚拟机')
      expect(mdAll).toContain('开机')
      expect(mdAll).toContain('SSH 密钥管理')
      expect(mdAll).toContain('生成新的 SSH 密钥对')
      expect(mdAll).toContain('下载私钥')

      // 验证全量文本无 emoji
      const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u
      expect(emojiRegex.test(mdAll)).toBe(false)
    })

    it('filters markdown appropriately for specific OS (e.g. macOS vs Windows)', () => {
      const macMd = generateTutorialMarkdown('macos')
      expect(macMd).toContain('com.ustc.vlab-tunnel.plist')
      expect(macMd).not.toContain('Register-ScheduledTask')

      const winMd = generateTutorialMarkdown('windows')
      expect(winMd).toContain('Register-ScheduledTask')
      expect(winMd).not.toContain('com.ustc.vlab-tunnel.plist')
    })
  })

  describe('VlabTutorialModal.vue Component Features', () => {
    it('defines segmented OS selector and action buttons', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('os-segmented-control')
      expect(template).toContain('selectOs(os.id)')
      expect(template).toContain('handleDownloadMarkdown')
      expect(template).toContain('handleCopyFullMarkdown')
    })

    it('provides quick jump navigation chips', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('chapter-nav-bar')
      expect(template).toContain('scrollToChapter(ch.id)')
    })

    it('renders the application review notice and detailed VLab creation steps', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('time-alert')
      expect(template).toContain('申请周期提示')
      expect(template).toContain('半天到一天时间')
      expect(template).toContain('item-step-header')
      expect(template).toContain('登录 VLab 虚拟实验平台')
      expect(template).toContain('虚拟机管理')
      expect(template).toContain('新建虚拟机')
      expect(template).toContain('手动刷新页面几次即可')
      expect(template).toContain('开机')
      expect(template).toContain('按钮颜色变暗')
      expect(template).toContain('启动时间」显示为非 0')
      expect(template).toContain('进入「SSH 密钥管理」')
      expect(template).toContain('生成新的 SSH 密钥对')
      expect(template).toContain('下载私钥 (.pem)')
      expect(template).toContain('win-path-callout')
      expect(template).toContain('Windows 用户关键提示')
    })

    it('highlights Section 10 CSBD Web configuration with Mixed Content alert', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('highlight-web-section')
      expect(template).toContain('Mixed Content')
      expect(template).toContain('不安全内容')
      expect(template).toContain('to="/assistant"')
    })

    it('supports collapsible optional DeepSeek Harness section', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('optional-section')
      expect(template).toContain('dshExpanded')
      expect(modalContent).toContain('npx @deepseek-ai/dsh web')
    })

    it('highlights 16 mainstream open-source models strictly exemplifying deepseek V4.1 and deepseek V4.1 flash', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('16 个主流开源顶级模型')
      expect(template).toContain('deepseek V4.1')
      expect(template).toContain('deepseek V4.1 flash')
      expect(template).not.toContain('极速推理与对话')

      const data = getTutorialData('all')
      const keySec = data.sections.find(s => s.id === 'step-key')
      expect(keySec.steps.some(s => s.desc.includes('16 个主流开源顶级模型') && s.desc.includes('deepseek V4.1'))).toBe(true)

      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('16 个主流开源顶级模型')
      expect(mdAll).toContain('deepseek V4.1')
      expect(mdAll).toContain('deepseek V4.1 flash')
      expect(mdAll).not.toContain('极速推理与对话')
    })

    it('renders check icon on the actively selected OS tab with full title and concise labels', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('os-tab-check')
      expect(template).toContain('v-if="selectedOs === os.id"')
      expect(template).toContain(':title="os.fullLabel || os.label"')

      const labels = OS_OPTIONS.map(o => o.label)
      expect(labels).toEqual(['全部系统', 'macOS', 'Windows', 'Linux', 'WSL'])
    })

    it('renders encouraging onboarding banner highlighting 10 steps, 100 RMB daily free tokens, and agent delegation', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('value-onboarding-card')
      expect(template).toContain('总共只需 10 个步骤 · 畅享每日 100 元免费 Token 额度')
      expect(template).toContain('每天免费发放')
      expect(template).toContain('100 元额度 Token')
      expect(template).toContain('实际上只需手动完成前 2 步')
      expect(template).toContain('后续步骤直接交由本地 Agent 全自动配置完成')
      expect(template).toContain('分步封装命令，复制粘贴即通')

      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('100 元额度的 Token 算力')
      expect(mdAll).toContain('总共只需十个步骤')
      expect(mdAll).toContain('实际上只需要手动完成前 2 步网页操作与私钥下载')
      expect(mdAll).toContain('用户已完成前 2 步')
    })

    it('renders 3-phase milestone roadmap and visual effort badges to reduce visual intimidation', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('milestone-roadmap')
      expect(template).toContain('阶段 01')
      expect(template).toContain('人工仅需 2 步 (约 2 分钟)')
      expect(template).toContain('01~02. 网页准备与私钥下载')
      expect(template).toContain('阶段 02')
      expect(template).toContain('03~07. 私钥配置与虚拟机代理')
      expect(template).toContain('Agent 可全自动接管')
      expect(template).toContain('阶段 03')

      // 验证降低心智负担的各步骤操作属性徽章
      expect(template).toContain('effort-badge effort-manual')
      expect(template).toContain('阶段一 · 网页操作')
      expect(template).toContain('effort-badge effort-agent')
      expect(template).toContain('阶段二 · Agent 全自动 / 一键配置')
      expect(template).toContain('effort-badge effort-web')
    })

    it('configures SSH tunnel with dedicated interactive Host ustc-vlab, tunnel Host ustc-vpn, User ubuntu, and IdentitiesOnly yes', () => {
      const scriptContent = modalParsed.descriptor.script?.content || modalParsed.descriptor.scriptSetup?.content || ''
      expect(scriptContent).toContain("'first-login': 'ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn'")
      expect(scriptContent).toContain('Host ustc-vlab')
      expect(scriptContent).toContain('Host ustc-vpn')
      expect(scriptContent).toContain('User ubuntu')
      expect(scriptContent).toContain('IdentitiesOnly yes')
      expect(scriptContent).toContain("'ssh-test': 'ssh -NT ustc-vpn'")

      const data = getTutorialData('all')
      const step8 = data.sections.find(s => s.id === 'step-local-tunnel')
      expect(step8).toBeDefined()
      expect(step8.configBlock.content).toContain('Host ustc-vlab')
      expect(step8.configBlock.content).toContain('Host ustc-vpn')
      expect(step8.configBlock.content).toContain('User ubuntu')
      expect(step8.configBlock.content).toContain('IdentitiesOnly yes')
      expect(step8.testCommand).toBe('ssh -NT ustc-vpn')

      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('Host ustc-vlab')
      expect(mdAll).toContain('Host ustc-vpn')
      expect(mdAll).toContain('User ubuntu')
      expect(mdAll).toContain('IdentitiesOnly yes')
      expect(mdAll).toContain('ssh -NT ustc-vpn')
      expect(mdAll).not.toContain('<YOUR_STUDENT_ID>')
      expect(modalContent).not.toContain('<统一身份用户名>')
    })

    it('simplifies Step 08 tip callout to solely mention IdentityFile path adjustment', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('若您在第 03 步下载的私钥自带虚拟机编号')
      expect(template).toContain('按实际路径对应修改 <code>IdentityFile</code>')
      // 确认去除了冗余的 1/2/3 列表
      expect(template).not.toContain('User ubuntu：VLab 官方 Ubuntu 镜像')
      expect(template).not.toContain('IdentitiesOnly yes：强烈必须！')
      expect(template).not.toContain('双 Host 分离设计：配置')

      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('提示：若您下载的私钥自带虚拟机编号')
      expect(mdAll).toContain('按实际路径修改 `IdentityFile`')
      expect(mdAll).not.toContain('- **User ubuntu**：VLab 官方 Ubuntu 镜像')
    })

    it('provides Windows PowerShell curl uri prompt mitigation in Step 8, Step 5, FAQ, and markdown', () => {
      const template = modalParsed.descriptor.template?.content || ''
      expect(template).toContain('curl-local-win')
      expect(template).toContain('curl.exe -s http://127.0.0.1:4000/v1/models')
      expect(template).toContain('请为以下参数提供值，uri')
      expect(template).toContain('Invoke-WebRequest')
      expect(template).toContain('Invoke-RestMethod')

      const data = getTutorialData('all')
      const step5 = data.sections.find(s => s.id === 'step-verify-api')
      expect(step5.note).toContain('切勿在本地 Windows PowerShell 窗口中直接运行')

      const step8 = data.sections.find(s => s.id === 'step-local-tunnel')
      expect(step8.verifyCommandWin).toContain('curl.exe')
      expect(step8.verifyNote).toContain('请为以下参数提供值，uri')

      const step12 = data.sections.find(s => s.id === 'step-troubleshooting')
      const uriFaq = step12.faqs.find(f => f.q.includes('请为以下参数提供值，uri'))
      expect(uriFaq).toBeDefined()
      expect(uriFaq.a).toContain('Invoke-WebRequest')
      expect(uriFaq.a).toContain('curl.exe')
      expect(uriFaq.a).toContain('Invoke-RestMethod')

      const mdAll = generateTutorialMarkdown('all')
      expect(mdAll).toContain('curl.exe -s http://127.0.0.1:4000/v1/models')
      expect(mdAll).toContain('请为以下参数提供值，uri')
      expect(mdAll).toContain('Invoke-RestMethod')
    })
  })
})
