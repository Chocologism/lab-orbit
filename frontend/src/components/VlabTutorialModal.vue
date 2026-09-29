<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import BaseDialog from './BaseDialog.vue'
import AppIcon from './AppIcon.vue'
import {
  OS_OPTIONS,
  TUTORIAL_CHAPTERS,
  getTutorialData,
  downloadTutorialMarkdown,
  copyTutorialMarkdown
} from '../utils/vlabTutorialContent.js'
import { notify } from '../composables/feedback.js'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const selectedOs = ref('all')
const copiedCodeMap = ref({})
const markdownCopied = ref(false)
const dshExpanded = ref(true)
const modalContentRef = ref(null)

const COPY_SNIPPETS = {
  'key-macos': `mkdir -p ~/.ssh
mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem
chmod 600 ~/.ssh/vlab.pem`,
  'key-win': `if (!(Test-Path "$HOME\\.ssh")) { New-Item -ItemType Directory -Path "$HOME\\.ssh" }
if (Test-Path "$HOME\\Downloads\\vlab.pem") { Move-Item -Path "$HOME\\Downloads\\vlab.pem" -Destination "$HOME\\.ssh\\vlab.pem" -Force }
icacls "$HOME\\.ssh\\vlab.pem" /inheritance:r
icacls "$HOME\\.ssh\\vlab.pem" /grant:r "$($env:USERNAME):(R)"`,
  'key-linux': `mkdir -p ~/.ssh
mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem
chmod 600 ~/.ssh/vlab.pem`,
  'key-wsl': `mkdir -p ~/.ssh
cp /mnt/c/Users/$USER/Downloads/vlab.pem ~/.ssh/vlab.pem
chmod 600 ~/.ssh/vlab.pem`,
  'first-login': 'ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn',
  'verify-api': `read -s -p "请输入您的 USTC API Key: " USTC_KEY && echo
curl -sS https://api.llm.ustc.edu.cn/v1/models \\
  -H "Authorization: Bearer $USTC_KEY"`,
  'install-uv': `mkdir -p ~/ustc-proxy && cd ~/ustc-proxy
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env
uv venv
source .venv/bin/activate
uv pip install "fastapi>=0.110.0" "uvicorn[standard]>=0.28.0" "httpx>=0.27.0"
echo -n "$USTC_KEY" > key.secret
chmod 600 key.secret`,
  'py-proxy': `import os, httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse

app = FastAPI(title="USTC LLM Secure Proxy")
UPSTREAM_URL = "https://api.llm.ustc.edu.cn/v1"
KEY_FILE = os.path.expanduser("~/ustc-proxy/key.secret")

def get_api_key():
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, "r", encoding="utf-8") as f:
            return f.read().strip()
    return os.environ.get("USTC_API_KEY", "")

@app.get("/v1/models")
async def list_models():
    api_key = get_api_key()
    headers = {"Authorization": f"Bearer {api_key}"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{UPSTREAM_URL}/models", headers=headers)
        return JSONResponse(status_code=resp.status_code, content=resp.json())

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    api_key = get_api_key()
    body = await request.json()
    is_stream = body.get("stream", False)
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    client = httpx.AsyncClient(timeout=180.0)

    if is_stream:
        async def stream_generator():
            try:
                async with client.stream(
                    "POST",
                    f"{UPSTREAM_URL}/chat/completions",
                    json=body,
                    headers=headers
                ) as upstream_resp:
                    async for chunk in upstream_resp.aiter_bytes():
                        yield chunk
            finally:
                await client.aclose()
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    else:
        try:
            resp = await client.post(
                f"{UPSTREAM_URL}/chat/completions",
                json=body,
                headers=headers
            )
            await client.aclose()
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        except Exception as e:
            await client.aclose()
            return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    import uvicorn
    # 仅绑定本地 127.0.0.1，严禁暴露公网
    uvicorn.run(app, host="127.0.0.1", port=4000, log_level="info")`,
  'vlab-systemd': `mkdir -p ~/.config/systemd/user
cat << 'EOF' > ~/.config/systemd/user/ustc-proxy.service
[Unit]
Description=USTC LLM Secure Proxy Service
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/ustc-proxy
ExecStart=%h/ustc-proxy/.venv/bin/python proxy-server.py
Restart=always
RestartSec=5
Environment="PYTHONUNBUFFERED=1"

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now ustc-proxy
loginctl enable-linger $USER
systemctl --user status ustc-proxy --no-pager`,
  'ssh-config': `Host ustc-vlab
    HostName vlab.ustc.edu.cn
    User ubuntu
    IdentityFile ~/.ssh/vlab.pem
    IdentitiesOnly yes
    ServerAliveInterval 60
    ServerAliveCountMax 3

Host ustc-vpn
    HostName vlab.ustc.edu.cn
    User ubuntu
    IdentityFile ~/.ssh/vlab.pem
    IdentitiesOnly yes
    ServerAliveInterval 60
    ServerAliveCountMax 3
    ExitOnForwardFailure yes
    LocalForward 127.0.0.1:4000 127.0.0.1:4000`,
  'ssh-test': 'ssh -NT ustc-vpn',
  'curl-local': 'curl -s http://127.0.0.1:4000/v1/models | head -c 100',
  'curl-local-win': 'curl.exe -s http://127.0.0.1:4000/v1/models',
  'autostart-macos': `cat << 'EOF' > ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ustc.vlab-tunnel</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/ssh</string>
        <string>-NT</string>
        <string>ustc-vpn</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/vlab-tunnel.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/vlab-tunnel.err</string>
</dict>
</plist>
EOF

launchctl unload ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist 2>/dev/null || true
launchctl load ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist`,
  'autostart-win': `$Action = New-ScheduledTaskAction -Execute "C:\\Windows\\System32\\OpenSSH\\ssh.exe" -Argument "-NT ustc-vpn"
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "USTC-VLab-Tunnel" -Action $Action -Trigger $Trigger -Settings $Settings
Start-ScheduledTask -TaskName "USTC-VLab-Tunnel"`,
  'autostart-linux': `mkdir -p ~/.config/systemd/user
cat << 'EOF' > ~/.config/systemd/user/ustc-tunnel.service
[Unit]
Description=USTC LLM SSH Local Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/ssh -NT ustc-vpn
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now ustc-tunnel`,
  'dsh-cmd': 'npx @deepseek-ai/dsh web'
}

onMounted(() => {
  try {
    const savedOs = localStorage.getItem('csbd_vlab_tutorial_os')
    if (savedOs && OS_OPTIONS.some(o => o.id === savedOs)) {
      selectedOs.value = savedOs
    }
  } catch (e) {
    // Ignore localStorage access errors
  }
})

watch(selectedOs, (newOs) => {
  try {
    localStorage.setItem('csbd_vlab_tutorial_os', newOs)
  } catch (e) {
    // Ignore localStorage errors
  }
})

const tutorialData = computed(() => {
  return getTutorialData(selectedOs.value)
})

function selectOs(osId) {
  selectedOs.value = osId
}

async function handleCopySnippet(key) {
  const text = COPY_SNIPPETS[key]
  if (!text) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    copiedCodeMap.value[key] = true
    setTimeout(() => {
      copiedCodeMap.value[key] = false
    }, 2200)
    notify('已复制到剪贴板', 'success')
  } catch (err) {
    notify('复制失败，请手动选取复制', 'warning')
  }
}

async function handleCopyFullMarkdown() {
  const success = await copyTutorialMarkdown(selectedOs.value)
  if (success) {
    markdownCopied.value = true
    setTimeout(() => {
      markdownCopied.value = false
    }, 2200)
    notify('已复制适用于本地 Agent 的 Markdown 全文', 'success')
  } else {
    notify('复制失败，请手动选取', 'warning')
  }
}

function handleDownloadMarkdown() {
  downloadTutorialMarkdown(selectedOs.value)
  notify('已触发 Markdown 下载，可直接投喂给本地 Agent 执行配置', 'success')
}

function scrollToChapter(chapterId) {
  if (!modalContentRef.value) return
  const el = modalContentRef.value.querySelector(`#${chapterId}`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function close() {
  emit('close')
}
</script>

<template>
  <BaseDialog
    :open="open"
    title="中国科大大模型 VLab 虚拟机 SSH 隧道配置指南"
    :wide="true"
    @close="close"
  >
    <div ref="modalContentRef" class="vlab-tutorial-modal-body">
      <!-- 顶部系统选择与操作工具栏 -->
      <header class="tutorial-header-toolbar">
        <div class="os-selector-group">
          <span class="os-selector-label">选择操作系统:</span>
          <div class="os-segmented-control" role="tablist">
            <button
              v-for="os in OS_OPTIONS"
              :key="os.id"
              type="button"
              role="tab"
              :aria-selected="selectedOs === os.id"
              :class="['os-tab-btn', { 'is-active': selectedOs === os.id }]"
              :title="os.fullLabel || os.label"
              @click="selectOs(os.id)"
            >
              <AppIcon v-if="selectedOs === os.id" name="check" :size="13" class="os-tab-check" />
              <span>{{ os.label }}</span>
            </button>
          </div>
        </div>

        <div class="header-action-buttons">
          <button
            type="button"
            class="button button-primary header-action-btn"
            title="下载结构化 Markdown 文档，可直接交由 Cursor/Claude Code/Antigravity 等本地 Agent 执行"
            @click="handleDownloadMarkdown"
          >
            <AppIcon name="download" :size="15" />
            <span>下载 Agent 配置文档 (.md)</span>
          </button>
          <button
            type="button"
            class="button button-quiet header-action-btn"
            title="复制 Markdown 全文至剪贴板"
            @click="handleCopyFullMarkdown"
          >
            <AppIcon :name="markdownCopied ? 'check' : 'copy'" :size="15" />
            <span>{{ markdownCopied ? '已复制 Markdown' : '复制 Markdown' }}</span>
          </button>
        </div>
      </header>

      <!-- 每日 100 元免费额度与极速通关卡片 -->
      <section class="value-onboarding-card">
        <div class="onboarding-main-header">
          <div class="onboarding-pill-badge">
            <AppIcon name="sparkle" :size="14" class="onboarding-sparkle-icon" />
            <span>师生专属学术福利</span>
          </div>
          <h3 class="onboarding-title">
            总共只需 10 个步骤 · 畅享每日 100 元免费 Token 额度
          </h3>
          <p class="onboarding-subtitle">
            中国科大大模型公共服务平台面向全校师生每天免费发放 <strong>100 元额度 Token</strong>（全面支持 deepseek V4.1、deepseek V4.1 flash 等 16 款主流顶级开源模型）。通过本安全隧道，校外任何网络免挂校园 VPN 即可高速直连使用！
          </p>
        </div>

        <!-- 两种模式卡片：拥有本地 Agent vs 手动一键复制 -->
        <div class="onboarding-path-grid">
          <!-- 模式一：本地 Agent 托管模式 -->
          <div class="path-card path-card-agent">
            <div class="path-badge-row">
              <span class="path-pill agent-pill">极速托管 · 强烈推荐</span>
              <span class="path-tag">已有 Cursor / Claude Code / Antigravity</span>
            </div>
            <div class="path-header">
              <div class="path-icon-box agent-icon-box">
                <AppIcon name="robot" :size="20" />
              </div>
              <div class="path-title-wrap">
                <strong class="path-title">实际上只需手动完成前 2 步</strong>
                <span class="path-sub">后续步骤直接交由本地 Agent 全自动配置完成</span>
              </div>
            </div>
            <div class="path-body">
              <div class="path-step-row">
                <span class="path-dot">1</span>
                <span><strong>网页完成前 2 步（约 2 分钟）：</strong>在网页申请 API Key、开机 VLab 虚拟机并下载私钥证书 <code>vlab.pem</code>。</span>
              </div>
              <div class="path-step-row">
                <span class="path-dot">2</span>
                <span><strong>下载并投喂配置文档：</strong>点击右上角「下载 Agent 配置文档 (.md)」，将文件与私钥一同提供给本地 Agent。</span>
              </div>
              <div class="path-step-row">
                <span class="path-dot">3</span>
                <span><strong>Agent 全自动跑通：</strong>后续步骤 03 ~ 10（私钥部署、虚拟机代理与本地自启）全部由 Agent 自动执行，无需手动敲命令行！</span>
              </div>
            </div>
            <div class="path-footer">
              <button
                type="button"
                class="path-btn path-btn-agent"
                @click="handleDownloadMarkdown"
              >
                <AppIcon name="download" :size="14" />
                <span>下载 Agent 配置文档 (.md)</span>
              </button>
            </div>
          </div>

          <!-- 模式二：清晰透明的一键复制命令 -->
          <div class="path-card path-card-manual">
            <div class="path-badge-row">
              <span class="path-pill manual-pill">清晰透明 · 零门槛</span>
              <span class="path-tag">无本地 Agent / 终端手动执行</span>
            </div>
            <div class="path-header">
              <div class="path-icon-box manual-icon-box">
                <AppIcon name="terminal" :size="20" />
              </div>
              <div class="path-title-wrap">
                <strong class="path-title">分步封装命令，复制粘贴即通</strong>
                <span class="path-sub">即使无 Agent，按照 10 步流程也能在 8 分钟内轻松跑通</span>
              </div>
            </div>
            <div class="path-body">
              <div class="path-step-row">
                <span class="path-dot">1</span>
                <span><strong>阶段一 · 网页操作 (01~02 步)：</strong>完成账号统一认证、开机虚拟机并下载私钥。</span>
              </div>
              <div class="path-step-row">
                <span class="path-dot">2</span>
                <span><strong>阶段二 · 密钥与虚拟机配置 (03~07 步)：</strong>配置私钥权限，一键部署虚拟机后台常驻代理。</span>
              </div>
              <div class="path-step-row">
                <span class="path-dot">3</span>
                <span><strong>阶段三 · 本地隧道与自启 (08~10 步)：</strong>一键运行端口映射与开机自启脚本，在网页即刻开启使用！</span>
              </div>
            </div>
            <div class="path-footer">
              <button
                type="button"
                class="path-btn path-btn-manual"
                @click="scrollToChapter('step-key')"
              >
                <AppIcon name="right" :size="14" />
                <span>从第 01 步开始配置</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 三阶段里程碑横向导航 -->
      <div class="milestone-roadmap" aria-label="教程三阶段进度导航">
        <button
          type="button"
          class="milestone-card milestone-phase-1"
          @click="scrollToChapter('step-key')"
        >
          <div class="milestone-top">
            <span class="milestone-step-index">阶段 01</span>
            <span class="milestone-tag tag-manual">人工仅需 2 步 (约 2 分钟)</span>
          </div>
          <div class="milestone-title">01~02. 网页准备与私钥下载</div>
          <div class="milestone-desc">申请 Key · 开机虚拟机 · 下载私钥证书</div>
          <div class="milestone-action">
            <span>查看阶段</span>
            <AppIcon name="right" :size="12" />
          </div>
        </button>

        <button
          type="button"
          class="milestone-card milestone-phase-2"
          @click="scrollToChapter('step-ssh-key')"
        >
          <div class="milestone-top">
            <span class="milestone-step-index">阶段 02</span>
            <span class="milestone-tag tag-agent">Agent 可全自动接管</span>
          </div>
          <div class="milestone-title">03~07. 私钥配置与虚拟机代理</div>
          <div class="milestone-desc">配置私钥权限 · 首次登录 · 部署代理与后台常驻</div>
          <div class="milestone-action">
            <span>查看阶段</span>
            <AppIcon name="right" :size="12" />
          </div>
        </button>

        <button
          type="button"
          class="milestone-card milestone-phase-3"
          @click="scrollToChapter('step-local-tunnel')"
        >
          <div class="milestone-top">
            <span class="milestone-step-index">阶段 03</span>
            <span class="milestone-tag tag-web">Agent 可全自动接管</span>
          </div>
          <div class="milestone-title">08~10. 本地隧道与网页直连</div>
          <div class="milestone-desc">SSH 端口映射 · 开机自启常驻 · 网页直通</div>
          <div class="milestone-action">
            <span>查看阶段</span>
            <AppIcon name="right" :size="12" />
          </div>
        </button>
      </div>

      <!-- 快速导航胶囊栏 -->
      <nav class="chapter-nav-bar" aria-label="教程目录快速跳转">
        <span class="nav-hint">快速跳转:</span>
        <div class="nav-chips-scroller">
          <button
            v-for="ch in TUTORIAL_CHAPTERS"
            :key="ch.id"
            type="button"
            class="nav-chip"
            @click="scrollToChapter(ch.id)"
          >
            {{ ch.title }}
          </button>
        </div>
      </nav>

      <!-- 概览与架构拓扑卡片 -->
      <section id="overview" class="tutorial-section overview-card">
        <div class="section-badge-row">
          <span class="step-pill">原理</span>
          <span class="effort-badge effort-info">架构解析</span>
          <span class="section-tag">安全架构拓扑</span>
        </div>
        <h3 class="section-heading">00. 链路原理与架构拓扑</h3>
        <p class="section-desc">
          中国科大大模型公共服务平台部署于校内高算力中心。通过在校内 VLab 虚拟机部署轻量级流式代理并建立加密 SSH 端口转发，可安全突破校外网络限制，实现零凭据泄露的高速直连。
        </p>

        <div class="architecture-diagram-block">
          <div class="diagram-flow">
            <div class="diagram-node node-local">
              <span class="node-title">本地终端 / 本网页 / 本地 Agent</span>
              <span class="node-sub">监听 127.0.0.1:4000 (免密访问)</span>
            </div>
            <div class="diagram-arrow">
              <span class="arrow-text">SSH 加密隧道转发</span>
              <span class="arrow-line">───────▶</span>
            </div>
            <div class="diagram-node node-vlab">
              <span class="node-title">校内 VLab 虚拟机</span>
              <span class="node-sub">FastAPI 流式代理 / 内置真实 API Key</span>
            </div>
            <div class="diagram-arrow">
              <span class="arrow-text">校内内网高速专线</span>
              <span class="arrow-line">───────▶</span>
            </div>
            <div class="diagram-node node-ustc">
              <span class="node-title">科大大模型平台</span>
              <span class="node-sub">DeepSeek V4.1 / V4.1 Flash (16款模型)</span>
            </div>
          </div>
        </div>

        <ul class="key-points-grid">
          <li>
            <strong>本地零密钥泄露风险:</strong>
            <span>真实的 USTC API Key 仅保存在 VLab 虚拟机内的加密文件中，本地无需也不留存任何凭据。</span>
          </li>
          <li>
            <strong>标准兼容性:</strong>
            <span>代理端完全遵循 OpenAI /v1 接口规范，自动支持长思维链流式输出 (Server-Sent Events)。</span>
          </li>
          <li>
            <strong>开机无感自启:</strong>
            <span>支持系统级开机自动常驻，断网自动重连，无需每次手动启动终端窗口。</span>
          </li>
          <li>
            <strong>Agent 全面赋能:</strong>
            <span>一键下载规范的 Markdown 文档，即可直接投喂给 Cursor、Claude Code、Antigravity 等代码助手自动执行。</span>
          </li>
        </ul>
      </section>

      <!-- 第一步：申请 API Key -->
      <section id="step-key" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">01</span>
          <span class="effort-badge effort-manual">阶段一 · 网页操作 (约1分钟)</span>
          <span class="section-tag">凭据申请</span>
        </div>
        <h3 class="section-heading">01. 申请科大大模型 API Key</h3>
        <p class="section-desc">
          中国科大大模型公共服务平台对全校师生开放，请使用学校统一身份认证登录申请。
        </p>

        <!-- 申请审核周期重要提示 -->
        <div class="tip-callout time-alert">
          <AppIcon name="clock" :size="16" class="time-alert-icon" />
          <div class="time-alert-content">
            <strong>申请周期提示：</strong>
            <span>提交创建项目与生成 API Key 申请后，平台审核通过大概需要<strong>半天到一天时间</strong>，审核通过前可能无法正常调用，请提交后耐心等待。</span>
          </div>
        </div>

        <div class="step-items-list">
          <div class="step-item">
            <span class="item-index">1</span>
            <div class="item-content">
              <span>访问中国科大大模型公共服务平台官网：</span>
              <a
                href="https://llm.ustc.edu.cn/"
                target="_blank"
                rel="noopener noreferrer"
                class="external-link-inline"
              >
                <span>https://llm.ustc.edu.cn/</span>
                <AppIcon name="arrow-up-right" :size="13" />
              </a>
            </div>
          </div>
          <div class="step-item">
            <span class="item-index">2</span>
            <div class="item-content">
              <span>点击右上角登录，使用中国科学技术大学统一身份认证（一卡通号及统一身份密码）。</span>
            </div>
          </div>
          <div class="step-item">
            <span class="item-index">3</span>
            <div class="item-content">
              <span>进入「API 密钥管理」或「项目中心」，点击「创建项目」并申请专属 API Key（通常以 <code>sk-</code> 开头），妥善记录备用。</span>
            </div>
          </div>
          <div class="step-item">
            <span class="item-index">4</span>
            <div class="item-content">
              <span>平台现已接入 16 个主流开源顶级模型，全面支持 <code>deepseek V4.1</code> 和 <code>deepseek V4.1 flash</code> 等，满足全场景科研问答、代码辅助与深度推理需求。</span>
            </div>
          </div>
        </div>
      </section>

      <!-- 第二步：创建 VLab 虚拟机与生成下载密钥 -->
      <section id="step-vlab" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">02</span>
          <span class="effort-badge effort-manual">阶段一 · 网页操作 (约2分钟)</span>
          <span class="section-tag">算力与密钥</span>
        </div>
        <h3 class="section-heading">02. 创建 VLab 虚拟机与生成下载密钥</h3>
        <p class="section-desc">
          VLab 是中国科大提供的校内虚拟实验平台，提供稳定的校内 IP 与基础 Linux 运行容器。直接使用 VLab 自带的密钥管理功能生成并下载私钥，无需手动执行 ssh-keygen 或使用 ssh-copy-id 上传。
        </p>

        <div class="step-items-list">
          <div class="step-item">
            <span class="item-index">1</span>
            <div class="item-content">
              <div class="item-step-header">登录 VLab 虚拟实验平台</div>
              <p>
                访问中国科大 VLab 虚拟实验平台官网，进入后先点击页面中的<strong>「虚拟机管理」</strong>，然后再使用统一身份认证登录。官方默认每个用户账号可创建一台虚拟机（若此前已有可用虚拟机可直接复用）：
              </p>
              <a
                href="https://vlab.ustc.edu.cn/"
                target="_blank"
                rel="noopener noreferrer"
                class="external-link-inline"
              >
                <span>https://vlab.ustc.edu.cn/</span>
                <AppIcon name="arrow-up-right" :size="13" />
              </a>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">2</span>
            <div class="item-content">
              <div class="item-step-header">新建虚拟机</div>
              <p>
                登录后点击页面左上方绿色的<strong>「新虚拟机」</strong>按钮。输入虚拟机名称（只能包含英文字母、数字、短线、点，推荐命名为 <code>ustc-ai-proxy</code>）。镜像选择推荐默认 <code>vlab01</code> 系列 Ubuntu 镜像（如 Ubuntu 22.04 LTS 或 Debian 12，命令行镜像即可，代理用途无需桌面环境）。点击「创建」后后台通常分配很快，无需长时间等待；若列表没有立即出现新虚拟机，手动刷新页面几次即可（有时后台实际已创建就绪或已发送邮件通知，但页面未自动刷新列表）。
              </p>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">3</span>
            <div class="item-content">
              <div class="item-step-header">开机</div>
              <p>
                虚拟机创建完成后，在对应虚拟机列表卡片中点击绿色的<strong>「开机」</strong>按钮。虚拟机开机没有所谓的独立状态指示灯，只要<strong>「开机」按钮颜色变暗，且卡片上的「启动时间」显示为非 0</strong>（显示具体运行时长），即代表虚拟机已成功开机运行。
              </p>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">4</span>
            <div class="item-content">
              <div class="item-step-header">【可选】设置 VLab 平台密码</div>
              <p>
                在 VLab 管理页面右上角找到<strong>「修改密码」</strong>或<strong>「设置密码」</strong>。此密码用于平台登录、VNC 桌面以及未挂载私钥时的备用 SSH 密码认证。若已正确配置 SSH 私钥，日常使用无需反复输入此密码。
              </p>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">5</span>
            <div class="item-content">
              <div class="item-step-header">进入「SSH 密钥管理」</div>
              <p>
                在虚拟机管理页面找到刚刚创建并已处于开机运行状态的虚拟机卡片，点击虚拟机卡片下方的<strong>「SSH 密钥管理」</strong>入口。
              </p>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">6</span>
            <div class="item-content">
              <div class="item-step-header">生成新的 SSH 密钥对</div>
              <p>
                在弹出或打开的 SSH 密钥管理界面中，点击<strong>「生成新的 SSH 密钥对」</strong>按钮。平台会自动完成一对高强度密钥的生成，并将对应的公钥自动注入到该虚拟机的安全授权列表中，<strong>完全无需自己在本地运行 ssh-keygen 或使用 ssh-copy-id 上传公钥</strong>。
              </p>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">7</span>
            <div class="item-content">
              <div class="item-step-header">下载私钥 (.pem)</div>
              <p>
                平台完成生成后，点击<strong>「下载私钥」</strong>按钮。浏览器会自动下载一个以 <code>.pem</code> 结尾的文件（例如命名为 <code>vlab.pem</code>）。若使用本地 Agent，可直接将该私钥交给 Agent 自动配置；若手动操作，将在下一步移动至本地系统。
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- 第三步：下载与配置 SSH 私钥 -->
      <section id="step-ssh-key" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">03</span>
          <span class="effort-badge effort-agent">阶段二 · Agent 全自动 / 一键配置</span>
          <span class="section-tag">本地环境</span>
        </div>
        <h3 class="section-heading">03. 下载与配置 SSH 私钥</h3>
        <p class="section-desc">
          在 VLab 控制台中下载对应的登录私钥文件（如 <code>vlab.pem</code>）。若拥有本地 Agent（Cursor, Claude Code, Antigravity 等），可直接将私钥交由 Agent 自动移动并配置权限；若手动操作，将其保存在本地 <code>.ssh</code> 目录中并收紧访问权限。
        </p>

        <!-- macOS -->
        <div v-if="selectedOs === 'all' || selectedOs === 'macos'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">macOS 配置私钥</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('key-macos')"
            >
              {{ copiedCodeMap['key-macos'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['key-macos'] }}</code></pre>
          <p class="code-note">注：SSH 安全标准强制要求私钥只能被当前用户访问，<code>chmod 600</code> 可杜绝权限过宽错误。</p>
        </div>

        <!-- Windows -->
        <div v-if="selectedOs === 'all' || selectedOs === 'windows'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">Windows (PowerShell) 配置私钥</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('key-win')"
            >
              {{ copiedCodeMap['key-win'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <div class="tip-callout win-path-callout">
            <strong>Windows 用户关键提示：</strong>
            <p>Windows 浏览器下载的文件大概率不在 C 盘或默认用户目录（例如在 D 盘或 E 盘下载文件夹）。<strong>最简单直接的方式：</strong>打开 Windows 文件资源管理器，直接将下载好的 <code>vlab.pem</code> 文件<strong>手动移动/复制到 <code>C:\Users\&lt;您的用户名&gt;\.ssh\</code> 文件夹中</strong>即可（若没有 <code>.ssh</code> 文件夹，可在该目录下新建一个）。移动完成后，仅需在 PowerShell 中执行权限收紧命令。</p>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['key-win'] }}</code></pre>
        </div>

        <!-- Linux -->
        <div v-if="selectedOs === 'all' || selectedOs === 'linux'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">Linux 配置私钥</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('key-linux')"
            >
              {{ copiedCodeMap['key-linux'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['key-linux'] }}</code></pre>
        </div>

        <!-- WSL -->
        <div v-if="selectedOs === 'all' || selectedOs === 'wsl'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">WSL 配置私钥</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('key-wsl')"
            >
              {{ copiedCodeMap['key-wsl'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['key-wsl'] }}</code></pre>
        </div>
      </section>

      <!-- 第四步：首次登录 VLab 虚拟机 -->
      <section id="step-first-login" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">04</span>
          <span class="effort-badge effort-agent">阶段二 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">终端连通</span>
        </div>
        <h3 class="section-heading">04. 首次登录 VLab 虚拟机</h3>
        <p class="section-desc">在本地终端执行登录命令，验证私钥与网络畅通：</p>
        <div class="command-card">
          <div class="command-card-header">
            <span>本地终端命令（VLab 官方 Ubuntu 镜像默认 Linux 用户名为固定的 ubuntu，切勿填写学号）：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet('first-login')"
            >
              {{ copiedCodeMap['first-login'] ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['first-login'] }}</code></pre>
          <div class="tip-callout">
            <strong>重要提示：</strong>
            <p>1. 默认 <code>vlab01</code> 镜像固定使用 <code>ubuntu</code> 作为系统登录用户。学号仅用于网页统一身份认证，<strong>不是</strong>虚拟机内部的 Linux 用户名。</p>
            <p>2. 首次连接若提示 <code>Are you sure you want to continue connecting (yes/no/[fingerprint])?</code>，请输入 <code>yes</code> 回车接受主机指纹。</p>
            <p>3. 若您在第 03 步下载的私钥保留了原始文件名（例如 <code>vlab-vm14017.pem</code>），请将命令中的 <code>vlab.pem</code> 替换为您本地的真实文件名。</p>
          </div>
        </div>
      </section>

      <!-- 第五步：在虚拟机验证 API 连通性 -->
      <section id="step-verify-api" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">05</span>
          <span class="effort-badge effort-agent">阶段二 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">虚拟机内部</span>
        </div>
        <h3 class="section-heading">05. 在虚拟机内部验证 API 连通性</h3>
        <p class="section-desc">
          成功登录进 VLab 虚拟机后，在远程终端内测试科大大模型接口的连通状态：
        </p>
        <div class="command-card">
          <div class="command-card-header">
            <span>VLab 终端执行命令：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet('verify-api')"
            >
              {{ copiedCodeMap['verify-api'] ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['verify-api'] }}</code></pre>
          <p class="code-note">
            注意：接口基地址为 <code>https://api.llm.ustc.edu.cn/v1</code>（仅限校内内网/VLab 虚拟机访问）。执行后将直接输出模型列表原始 JSON 数据。若正常输出包含 <code>deepseek-v4.1</code>、<code>deepseek-flash</code> 等模型列表之一，说明虚拟机访问校内大模型接口完全畅通。
          </p>
        </div>
      </section>

      <!-- 第六步：在 VLab 部署 FastAPI 流式代理 -->
      <section id="step-proxy-server" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">06</span>
          <span class="effort-badge effort-agent">阶段二 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">轻量代理</span>
        </div>
        <h3 class="section-heading">06. 部署 FastAPI 流式代理</h3>
        <p class="section-desc">
          在 VLab 虚拟机上安装现代化包管理器 uv，并运行轻量级 FastAPI 代理。该代理仅在虚拟机本地 <code>127.0.0.1:4000</code> 监听，不开放公网端口，由 SSH 隧道提供高强度加密通道。
        </p>
        <div class="step-items-list">
          <div class="step-item">
            <span class="item-index">1</span>
            <div class="item-content">
              <span>在 VLab 虚拟机上安装 uv 并初始化运行环境：</span>
              <div class="command-card compact">
                <button
                  type="button"
                  class="copy-cmd-btn"
                  @click="handleCopySnippet('install-uv')"
                >
                  {{ copiedCodeMap['install-uv'] ? '已复制' : '复制安装命令' }}
                </button>
                <pre class="code-box"><code>{{ COPY_SNIPPETS['install-uv'] }}</code></pre>
              </div>
            </div>
          </div>

          <div class="step-item">
            <span class="item-index">2</span>
            <div class="item-content">
              <span>在 <code>~/ustc-proxy/proxy-server.py</code> 编写代理服务脚本：</span>
              <div class="command-card">
                <div class="command-card-header">
                  <span>~/ustc-proxy/proxy-server.py</span>
                  <button
                    type="button"
                    class="copy-cmd-btn"
                    @click="handleCopySnippet('py-proxy')"
                  >
                    {{ copiedCodeMap['py-proxy'] ? '已复制' : '复制代码' }}
                  </button>
                </div>
                <pre class="code-box language-python"><code>{{ COPY_SNIPPETS['py-proxy'] }}</code></pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 第七步：配置虚拟机代理后台自启 -->
      <section id="step-vlab-systemd" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">07</span>
          <span class="effort-badge effort-agent">阶段二 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">后台守护</span>
        </div>
        <h3 class="section-heading">07. 配置虚拟机代理后台自启 (systemd)</h3>
        <p class="section-desc">
          配置 systemd 用户级服务并开启 <code>loginctl enable-linger</code>，确保即使断开 SSH 终端，代理依然在虚拟机后台常驻运行。
        </p>
        <div class="command-card">
          <div class="command-card-header">
            <span>VLab 终端执行：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet('vlab-systemd')"
            >
              {{ copiedCodeMap['vlab-systemd'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['vlab-systemd'] }}</code></pre>
        </div>
      </section>

      <!-- 第八步：配置本地 SSH 隧道 -->
      <section id="step-local-tunnel" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">08</span>
          <span class="effort-badge effort-agent">阶段三 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">本地端口映射</span>
        </div>
        <h3 class="section-heading">08. 配置本地 SSH 隧道</h3>
        <p class="section-desc">
          在本地电脑的 SSH 配置文件中配置两个主机别名：<code>ustc-vlab</code> 用于日常免密秒登终端排查，<code>ustc-vpn</code> 专职将本地 <code>127.0.0.1:4000</code> 端口通过加密隧道映射至虚拟机的 <code>127.0.0.1:4000</code>。
        </p>

        <div class="command-card">
          <div class="command-card-header">
            <span>在本地 ~/.ssh/config 文件中添加以下配置：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet('ssh-config')"
            >
              {{ copiedCodeMap['ssh-config'] ? '已复制' : '复制配置' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['ssh-config'] }}</code></pre>
          <div class="tip-callout">
            <strong>提示：</strong>若您在第 03 步下载的私钥自带虚拟机编号（例如 <code>~/.ssh/vlab-vm14017.pem</code>），请按实际路径对应修改 <code>IdentityFile</code>。
          </div>
        </div>

        <div class="command-card">
          <div class="command-card-header">
            <span>本地单次前台测试命令（保持窗口开启）：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet('ssh-test')"
            >
              {{ copiedCodeMap['ssh-test'] ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['ssh-test'] }}</code></pre>
          <p class="code-note">
            或者直接运行全局等价单行命令：<code>ssh -L 4000:127.0.0.1:4000 -NT -o IdentitiesOnly=yes -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn</code>
          </p>
        </div>

        <div class="command-card">
          <div class="command-card-header">
            <span>在另一个本地终端窗口中验证接口返回：</span>
            <button
              type="button"
              class="copy-cmd-btn"
              @click="handleCopySnippet(selectedOs === 'windows' ? 'curl-local-win' : 'curl-local')"
            >
              {{ copiedCodeMap[selectedOs === 'windows' ? 'curl-local-win' : 'curl-local'] ? '已复制' : '复制' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ selectedOs === 'windows' ? COPY_SNIPPETS['curl-local-win'] : COPY_SNIPPETS['curl-local'] }}</code></pre>
          <p v-if="selectedOs === 'all' || selectedOs === 'windows'" class="code-note">
            Windows PowerShell 用户特别注意：请运行 <code>curl.exe -s http://127.0.0.1:4000/v1/models</code>（务必加 <code>.exe</code>，避开 PowerShell 将 <code>curl</code> 别名指向 <code>Invoke-WebRequest</code> 造成的「请为以下参数提供值，uri」错误）或直接使用 <code>Invoke-RestMethod http://127.0.0.1:4000/v1/models</code>。
          </p>
        </div>
      </section>

      <!-- 第九步：配置本地开机后台自启 -->
      <section id="step-local-autostart" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill">09</span>
          <span class="effort-badge effort-agent">阶段三 · Agent 全自动 / 一键复制</span>
          <span class="section-tag">开机常驻</span>
        </div>
        <h3 class="section-heading">09. 配置本地开机后台自启</h3>
        <p class="section-desc">
          为了避免每次使用都要手动开终端敲命令，推荐配置系统级后台自启：
        </p>

        <!-- macOS -->
        <div v-if="selectedOs === 'all' || selectedOs === 'macos'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">macOS: Launchd 用户守护配置</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('autostart-macos')"
            >
              {{ copiedCodeMap['autostart-macos'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['autostart-macos'] }}</code></pre>
        </div>

        <!-- Windows -->
        <div v-if="selectedOs === 'all' || selectedOs === 'windows'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">Windows: 任务计划程序 (Task Scheduler)</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('autostart-win')"
            >
              {{ copiedCodeMap['autostart-win'] ? '已复制' : '复制 PowerShell 命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['autostart-win'] }}</code></pre>
        </div>

        <!-- Linux -->
        <div v-if="selectedOs === 'all' || selectedOs === 'linux'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">Linux: systemd 用户自启服务</span>
            <button
              type="button"
              class="copy-code-btn"
              @click="handleCopySnippet('autostart-linux')"
            >
              {{ copiedCodeMap['autostart-linux'] ? '已复制' : '复制命令' }}
            </button>
          </div>
          <pre class="code-box"><code>{{ COPY_SNIPPETS['autostart-linux'] }}</code></pre>
        </div>

        <!-- WSL -->
        <div v-if="selectedOs === 'all' || selectedOs === 'wsl'" class="os-specific-block">
          <div class="os-block-header">
            <span class="os-title">WSL 使用建议</span>
          </div>
          <p class="code-note">
            推荐直接在 Windows 宿主机上按上述任务计划程序启动隧道。Windows 宿主机上的 <code>127.0.0.1:4000</code> 在 WSL2 中可通过 <code>localhost:4000</code> 或 <code>127.0.0.1:4000</code> 直接连通。
          </p>
        </div>
      </section>

      <!-- 第十步：核心配置到本网页 (LabOrbit 科研助手) -->
      <section id="step-web-setup" class="tutorial-section highlight-web-section">
        <div class="section-badge-row">
          <span class="step-pill featured">10</span>
          <span class="effort-badge effort-web">阶段三 · 网页直连 (即刻生效)</span>
          <span class="section-tag featured">本网页直连与关键安全配置</span>
        </div>
        <h3 class="section-heading">10. 配置到本网页 (LabOrbit 科研助手)</h3>
        <p class="section-desc">
          本平台已深度集成中国科大大模型免密隧道直连驱动。按照以下指引完成一次性浏览器安全策略放行后，即可在整个网站中畅享大模型赋能。
        </p>

        <div class="web-setup-card-grid">
          <div class="web-setup-step">
            <div class="step-circle">1</div>
            <div class="step-body">
              <h4>选择服务商</h4>
              <p>
                进入「AI 科研助手」，点击右上角「模型配置」（齿轮图标）。在服务商下拉列表中选择 <strong>USTC via Vlab (推荐)</strong>。
              </p>
              <div class="param-badge-group">
                <span class="param-badge">接口基地址: <code>http://127.0.0.1:4000/v1</code></span>
                <span class="param-badge">API Key: <code>代理端内置认证，无需输入</code></span>
              </div>
            </div>
          </div>

          <div class="web-setup-step caution-step">
            <div class="step-circle alert">2</div>
            <div class="step-body">
              <h4 class="text-accent">核心关键：放行浏览器混合内容 (Mixed Content)</h4>
              <p class="caution-desc">
                本站线上服务运行在加密的 HTTPS 域名 (<code>csbd-hub.pages.dev</code>)。根据现代浏览器的安全规范，HTTPS 页面默认会阻止向本地明文 <code>http://127.0.0.1:4000</code> 发起网络请求，导致测试连通性时提示连接错误。请务必按以下步骤放行：
              </p>
              <ol class="action-steps-ol">
                <li>点击浏览器地址栏最左侧的<strong>网站设置/权限图标</strong>（通常为锁头旁边的调节图标或提示标记）；</li>
                <li>在弹出菜单中点击<strong>「网站设置 (Site settings)」</strong>或<strong>「权限」</strong>；</li>
                <li>在权限列表中找到<strong>「不安全内容 (Insecure content)」</strong>选项；</li>
                <li>将其从默认的「阻止 (Block)」更改为<strong>「允许 (Allow)」</strong>；</li>
                <li>关闭设置页面，返回本网页并<strong>刷新页面 (F5 或 Command+R)</strong>。</li>
              </ol>
            </div>
          </div>

          <div class="web-setup-step">
            <div class="step-circle">3</div>
            <div class="step-body">
              <h4>测试连通性并保存</h4>
              <p>
                刷新后重新点击「模型配置」中的「<strong>测试连通性</strong>」。连通成功后点击「<strong>保存配置</strong>」。
              </p>
              <p class="feature-active-tip">
                保存成功后，文献推荐卡片将自动激活「与 AI 对话」研讨按钮，邮件推送日程将激活「AI 智能识别填报」功能。
              </p>
            </div>
          </div>
        </div>

        <div class="section-footer-actions">
          <router-link
            to="/assistant"
            class="button button-primary"
            @click="close"
          >
            <AppIcon name="robot" :size="16" />
            <span>立即前往 AI 科研助手配置</span>
          </router-link>
        </div>
      </section>

      <!-- 第十一步：[可选] 配置 DeepSeek Harness (dsh) -->
      <section id="step-optional-dsh" class="tutorial-section optional-section">
        <div class="section-badge-row">
          <span class="step-pill optional">11</span>
          <span class="effort-badge effort-opt">进阶扩展 · 可选</span>
          <span class="section-tag">可选扩展</span>
        </div>
        <div class="optional-header" @click="dshExpanded = !dshExpanded">
          <div>
            <h3 class="section-heading">11. [可选] 配置 DeepSeek Harness (dsh)</h3>
            <p class="section-desc">
              如果您喜欢在本地终端运行 DeepSeek 官方出品的开源 Agent 工具 DeepSeek Harness (dsh)，可使用以下配置复用已搭建的 4000 端口隧道。
            </p>
          </div>
          <button type="button" class="icon-toggle-btn" :aria-expanded="dshExpanded">
            <AppIcon :name="dshExpanded ? 'down' : 'right'" :size="16" />
          </button>
        </div>

        <div v-show="dshExpanded" class="optional-body">
          <div class="command-card">
            <div class="command-card-header">
              <span>启动 dsh Web 交互面板：</span>
              <button
                type="button"
                class="copy-cmd-btn"
                @click="handleCopySnippet('dsh-cmd')"
              >
                {{ copiedCodeMap['dsh-cmd'] ? '已复制' : '复制' }}
              </button>
            </div>
            <pre class="code-box"><code>{{ COPY_SNIPPETS['dsh-cmd'] }}</code></pre>
          </div>
          <ul class="dsh-config-list">
            <li><strong>Base URL:</strong> 填入 <code>http://127.0.0.1:4000/v1</code></li>
            <li><strong>API Key:</strong> 填入任意占位文本即可（例如 <code>sk-vlab-local-dummy</code>），因为真实的认证由 VLab 代理端无感注入。</li>
            <li><strong>模型映射:</strong> 在 <code>settings.yaml</code> 中将 <code>deepseek-chat</code> 指向 <code>deepseek-ai/DeepSeek-V3</code>，将 <code>deepseek-reasoner</code> 指向 <code>deepseek-ai/DeepSeek-R1</code>。</li>
          </ul>
        </div>
      </section>

      <!-- 第十二步：常见故障排查与验收清单 -->
      <section id="step-troubleshooting" class="tutorial-section">
        <div class="section-badge-row">
          <span class="step-pill optional">12</span>
          <span class="effort-badge effort-opt">排错诊断 · 备查</span>
          <span class="section-tag">排错清单</span>
        </div>
        <h3 class="section-heading">12. 常见故障排查与验收清单</h3>
        <div class="faq-list">
          <div class="faq-item">
            <h4 class="faq-q">测试连通性时提示 Failed to fetch 或网络连接失败？</h4>
            <p class="faq-a">
              绝大多数情况是因为浏览器的混合内容（Mixed Content）安全策略拦截了明文 HTTP 请求。请务必查看第十步，在地址栏的网站设置中将「不安全内容」修改为「允许」并刷新网页。
            </p>
          </div>
          <div class="faq-item">
            <h4 class="faq-q">SSH 登录报错 Too many authentication failures for ubuntu 或拒绝连接？</h4>
            <p class="faq-a">
              1. 请检查 <code>~/.ssh/config</code> 中是否配置了 <code>IdentitiesOnly yes</code>。本机存在多个私钥或运行有 ssh-agent 时，未加此参数会导致 SSH 逐个尝试不同密钥并触发防暴力破解限制；<br/>
              2. 请确认用户名使用的是固定的 <code>ubuntu</code>，不要误写成统一身份学号；<br/>
              3. 请确认私钥文件路径与权限是否严格为 600。
            </p>
          </div>
          <div class="faq-item">
            <h4 class="faq-q">本地终端执行 curl http://127.0.0.1:4000/v1/models 提示 Connection refused？</h4>
            <p class="faq-a">
              说明本地 SSH 隧道没有在运行。请先运行 <code>ssh -NT ustc-vpn</code> 查看终端是否有具体报错输出；若提示 <code>bind: Address already in use</code>，说明 4000 端口被其他应用占用，请用 <code>lsof -i :4000</code> 找到并关闭冲突进程。
            </p>
          </div>
          <div class="faq-item">
            <h4 class="faq-q">SSH 登录提示 Permissions 0644 for vlab.pem are too open？</h4>
            <p class="faq-a">
              SSH 规范要求私钥仅能被当前系统用户读取。macOS / Linux 用户请执行 <code>chmod 600 ~/.ssh/vlab.pem</code>；Windows 用户请使用教程第三步提供的 <code>icacls</code> 命令收紧访问控制权限。
            </p>
          </div>
          <div class="faq-item">
            <h4 class="faq-q">断开终端后代理服务突然停止响应？</h4>
            <p class="faq-a">
              请检查在 VLab 虚拟机内是否执行了 <code>loginctl enable-linger $USER</code>。在 Linux 中若未启用 linger，当用户登出 SSH 会话时，用户级 systemd 守护进程会被系统自动休眠。
            </p>
          </div>
          <div class="faq-item">
            <h4 class="faq-q">Windows PowerShell 运行验证命令提示「请为以下参数提供值，uri」？</h4>
            <p class="faq-a">
              核心原因：Windows PowerShell 中 <code>curl</code> 默认是 <code>Invoke-WebRequest</code> 的别名。参数 <code>-s</code> 被误识别为 <code>-SessionVariable</code>，导致必选参数 <code>-Uri</code> 缺失而弹出交互式输入提示。<br/>
              解决办法：<br/>
              1. 运行系统内置的真正 curl 程序：<code>curl.exe -s http://127.0.0.1:4000/v1/models</code>（末尾务必带 <code>.exe</code> 避开别名）；<br/>
              2. 或使用 PowerShell 原生网络命令：<code>Invoke-RestMethod http://127.0.0.1:4000/v1/models</code>；<br/>
              3. 若您在进行第五步校内 API 验证，请确认已先登录进 VLab 虚拟机（<code>ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn</code>），校内验证命令必须在远端 Linux 终端执行，切勿在本地 Windows PowerShell 直接运行。
            </p>
          </div>
        </div>
      </section>

      <!-- 底部操作与跳转栏 -->
      <footer class="tutorial-modal-footer">
        <div class="footer-actions">
          <a
            href="https://llm.ustc.edu.cn/"
            target="_blank"
            rel="noopener noreferrer"
            class="button button-quiet"
          >
            <span>科大大模型官网</span>
            <AppIcon name="arrow-up-right" :size="14" />
          </a>
          <button
            type="button"
            class="button button-quiet"
            @click="handleDownloadMarkdown"
          >
            <AppIcon name="download" :size="15" />
            <span>下载 Markdown 文档</span>
          </button>
          <router-link
            to="/assistant"
            class="button button-primary"
            @click="close"
          >
            <AppIcon name="robot" :size="16" />
            <span>前往 AI 科研助手</span>
          </router-link>
        </div>
      </footer>
    </div>
  </BaseDialog>
</template>

<style scoped>
.vlab-tutorial-modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  max-width: 860px;
  min-width: 0;
  box-sizing: border-box;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--text);
  padding: 4px 0 16px 0;
}

/* 顶部工具栏 */
.tutorial-header-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow: hidden;
}

.os-selector-group {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.os-selector-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--muted);
  white-space: nowrap;
  flex-shrink: 0;
}

.os-segmented-control {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  max-width: 100%;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid var(--line);
  border-radius: 9px;
  padding: 3px;
  gap: 4px;
}

.os-tab-btn {
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  padding: 5px 12px;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  box-sizing: border-box;
  flex-shrink: 0;
}

.os-tab-btn:hover:not(.is-active) {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.os-tab-btn.is-active {
  background: var(--accent);
  color: var(--accent-ink, #070314);
  font-weight: 700;
  border-color: var(--accent);
  box-shadow: 0 2px 10px rgba(184, 155, 248, 0.45);
}

.os-tab-check {
  color: var(--accent-ink, #070314);
  flex-shrink: 0;
}

.header-action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  padding: 6px 12px;
}

/* 每日 100 元免费额度与极速通关卡片 */
.value-onboarding-card {
  background: linear-gradient(135deg, rgba(184, 155, 248, 0.09) 0%, rgba(56, 189, 248, 0.05) 50%, var(--surface) 100%);
  border: 1px solid rgba(184, 155, 248, 0.28);
  border-radius: 16px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.onboarding-main-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.onboarding-pill-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  padding: 3px 10px;
  border-radius: 9999px;
  background: rgba(184, 155, 248, 0.16);
  border: 1px solid rgba(184, 155, 248, 0.3);
  color: var(--accent);
  font-size: 11.5px;
  font-weight: 600;
}

.onboarding-sparkle-icon {
  color: var(--accent);
}

.onboarding-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin: 0;
  letter-spacing: -0.2px;
}

.onboarding-subtitle {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
  margin: 0;
}

.onboarding-subtitle strong {
  color: var(--accent);
  font-weight: 600;
}

.onboarding-path-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.path-card {
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: all 0.2s ease;
}

.path-card-agent {
  background: rgba(184, 155, 248, 0.06);
  border: 1px solid rgba(184, 155, 248, 0.32);
}

.path-card-manual {
  background: var(--subtle);
  border: 1px solid var(--line);
}

.path-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.path-pill {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
}

.agent-pill {
  background: var(--accent);
  color: var(--accent-ink, #070314);
}

.manual-pill {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line);
  color: var(--text);
}

.path-tag {
  font-size: 11.5px;
  color: var(--muted);
}

.path-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.path-icon-box {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.agent-icon-box {
  background: rgba(184, 155, 248, 0.2);
  color: var(--accent);
}

.manual-icon-box {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--line);
  color: var(--text);
}

.path-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.path-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}

.path-sub {
  font-size: 11.5px;
  color: var(--muted);
}

.path-body {
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 12.5px;
  color: var(--muted);
  line-height: 1.55;
}

.path-step-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.path-dot {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line);
  color: var(--text);
  font-size: 10.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.path-step-row strong {
  color: var(--text);
}

.path-footer {
  margin-top: 4px;
}

.path-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
  border: 1px solid transparent;
}

.path-btn-agent {
  background: var(--accent);
  color: var(--accent-ink, #070314);
}

.path-btn-agent:hover {
  opacity: 0.92;
  transform: translateY(-1px);
}

.path-btn-manual {
  background: transparent;
  border-color: var(--line);
  color: var(--text);
}

.path-btn-manual:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(255, 255, 255, 0.04);
}

/* 三阶段里程碑横向导航卡片 */
.milestone-roadmap {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.milestone-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 12px 14px;
  cursor: pointer;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
  width: 100%;
  box-sizing: border-box;
}

.milestone-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.milestone-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.milestone-step-index {
  font-size: 11px;
  font-weight: 700;
  color: var(--muted);
  letter-spacing: 0.5px;
}

.milestone-tag {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
}

.tag-manual {
  background: rgba(16, 185, 129, 0.14);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.28);
}

.tag-agent {
  background: rgba(168, 85, 247, 0.14);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.28);
}

.tag-web {
  background: rgba(56, 189, 248, 0.14);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.28);
}

.milestone-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.milestone-desc {
  font-size: 11.5px;
  color: var(--muted);
  line-height: 1.4;
  margin: 0;
}

.milestone-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent);
  font-weight: 500;
  margin-top: 2px;
}

/* 操作负担属性徽章 (Effort Badges) */
.effort-badge {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 5px;
  white-space: nowrap;
}

.effort-info {
  background: rgba(184, 155, 248, 0.12);
  color: var(--accent);
  border: 1px solid rgba(184, 155, 248, 0.24);
}

.effort-manual {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.effort-agent {
  background: rgba(168, 85, 247, 0.12);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.25);
}

.effort-web {
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.25);
}

.effort-opt {
  background: rgba(148, 163, 184, 0.12);
  color: var(--muted);
  border: 1px solid var(--line);
}

/* 快速跳转导航条 */
.chapter-nav-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
}

.nav-hint {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  flex-shrink: 0;
}

.nav-chips-scroller {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding-bottom: 2px;
}

.nav-chips-scroller::-webkit-scrollbar {
  display: none;
}

.nav-chip {
  flex-shrink: 0;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.nav-chip:hover {
  color: var(--accent);
  border-color: var(--accent);
}

/* 章节通用样式 */
.tutorial-section {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 18px 20px;
  scroll-margin-top: 20px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.section-badge-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.step-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 22px;
  padding: 0 8px;
  border-radius: 6px;
  background: rgba(184, 155, 248, 0.15);
  color: var(--accent);
  font-weight: 700;
  font-size: 12px;
}

.step-pill.featured {
  background: var(--accent);
  color: #fff;
}

.step-pill.optional {
  background: rgba(140, 150, 170, 0.18);
  color: var(--muted);
}

.section-tag {
  font-size: 12px;
  color: var(--muted);
  font-weight: 500;
}

.section-tag.featured {
  color: var(--accent);
  font-weight: 600;
}

.section-heading {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13.5px;
  color: var(--muted);
  margin: 0 0 14px 0;
  line-height: 1.6;
}

/* 架构拓扑图样式 */
.architecture-diagram-block {
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 16px;
  margin: 12px 0 16px 0;
  overflow-x: auto;
}

.diagram-flow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 600px;
  gap: 12px;
}

.diagram-node {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.node-title {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}

.node-sub {
  font-size: 11px;
  color: var(--muted);
}

.diagram-arrow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.arrow-text {
  font-size: 11px;
  color: var(--accent);
  white-space: nowrap;
}

.arrow-line {
  font-size: 12px;
  color: var(--muted);
  letter-spacing: -1px;
}

.key-points-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin: 14px 0 0 0;
  padding: 0;
  list-style: none;
}

.key-points-grid li {
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.key-points-grid li strong {
  font-size: 12.5px;
  color: var(--text);
}

.key-points-grid li span {
  font-size: 12px;
  color: var(--muted);
}

/* 步骤条目 */
.step-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.item-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--subtle);
  border: 1px solid var(--line);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}

.item-content {
  flex: 1;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
  font-size: 13.5px;
  color: var(--text);
  line-height: 1.55;
}

.item-step-header {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  margin-bottom: 4px;
}

.item-content p {
  margin: 0 0 6px 0;
  color: var(--muted);
  line-height: 1.6;
}

.item-content p strong {
  color: var(--text);
}

.external-link-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}

.external-link-inline:hover {
  text-decoration: underline;
}

/* 代码与命令块 */
.command-card {
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 10px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
}

.command-card.compact {
  padding: 8px 12px;
  margin-top: 6px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.command-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 8px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.code-box {
  margin: 0;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--line);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: var(--accent);
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.code-note {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: var(--muted);
}

.copy-cmd-btn,
.copy-code-btn {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.copy-cmd-btn:hover,
.copy-code-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 操作系统专享区块 */
.os-specific-block {
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 12px;
}

.os-block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.os-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.tip-callout {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 3px solid var(--accent);
  padding: 8px 12px;
  border-radius: 6px;
  margin-top: 10px;
  font-size: 12.5px;
}

.tip-callout.time-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  background: rgba(234, 179, 8, 0.08);
  border-color: rgba(234, 179, 8, 0.35);
  border-left: 3px solid #eab308;
  color: var(--text);
  margin-top: 10px;
  margin-bottom: 14px;
}

.time-alert-icon {
  color: #eab308;
  flex-shrink: 0;
  margin-top: 2px;
}

.time-alert-content {
  line-height: 1.55;
  font-size: 13px;
}

.time-alert-content strong {
  color: var(--text);
}

/* 本网页高亮卡片 */
.highlight-web-section {
  border-color: rgba(184, 155, 248, 0.4);
  background: linear-gradient(180deg, rgba(184, 155, 248, 0.04) 0%, var(--surface) 100%);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.web-setup-card-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.web-setup-step {
  display: flex;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px 16px;
}

.web-setup-step.caution-step {
  background: rgba(234, 179, 8, 0.03);
  border-color: rgba(234, 179, 8, 0.35);
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(184, 155, 248, 0.15);
  color: var(--accent);
  font-weight: 700;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-circle.alert {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
}

.step-body {
  flex: 1;
}

.step-body h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.step-body h4.text-accent {
  color: var(--accent);
}

.step-body p {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
}

.param-badge-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.param-badge {
  font-size: 12px;
  background: var(--subtle);
  border: 1px solid var(--line);
  padding: 4px 8px;
  border-radius: 6px;
  color: var(--text);
}

.param-badge code {
  color: var(--accent);
  font-family: ui-monospace, monospace;
}

.caution-desc {
  color: var(--text) !important;
}

.action-steps-ol {
  margin: 8px 0 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
}

.action-steps-ol li {
  margin-bottom: 6px;
}

.feature-active-tip {
  color: var(--accent) !important;
  font-size: 12.5px !important;
  margin-top: 6px !important;
}

.section-footer-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

/* 可选 dsh */
.optional-section {
  border-style: dashed;
}

.optional-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}

.icon-toggle-btn {
  background: transparent;
  border: none;
  color: var(--muted);
  cursor: pointer;
  padding: 4px;
}

.optional-body {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.dsh-config-list {
  margin: 10px 0 0 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.6;
}

.dsh-config-list code {
  color: var(--accent);
  font-family: ui-monospace, monospace;
}

/* FAQ 排查 */
.faq-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-item {
  background: var(--subtle);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 12px 14px;
}

.faq-q {
  margin: 0 0 6px 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
}

.faq-a {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
  line-height: 1.55;
}

.faq-a code {
  color: var(--accent);
  font-family: ui-monospace, monospace;
}

/* 底部操作区 */
.tutorial-modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 640px) {
  .tutorial-header-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .os-selector-group {
    flex-direction: column;
    align-items: flex-start;
  }
  .os-segmented-control {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .os-segmented-control::-webkit-scrollbar {
    display: none;
  }
  .header-action-buttons {
    justify-content: stretch;
  }
  .header-action-btn {
    flex: 1;
    justify-content: center;
  }
  .tutorial-modal-footer {
    flex-direction: column;
    align-items: stretch;
  }
  .footer-actions {
    flex-direction: column;
  }
  .footer-actions .button {
    width: 100%;
    justify-content: center;
  }
  .milestone-roadmap {
    grid-template-columns: 1fr;
  }
  .onboarding-path-grid {
    grid-template-columns: 1fr;
  }
  .path-card {
    padding: 12px;
  }
}
</style>
