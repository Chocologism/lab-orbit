/**
 * 中国科大大模型 VLab 虚拟机 SSH 隧道配置教程数据与 Markdown 导出工具
 * 严格遵循 0 Emoji 规范
 */

export const OS_OPTIONS = [
  { id: 'all', label: '全部系统', fullLabel: '全部系统 (完整指南)', shortLabel: '全部' },
  { id: 'macos', label: 'macOS', fullLabel: 'macOS', shortLabel: 'macOS' },
  { id: 'windows', label: 'Windows', fullLabel: 'Windows (PowerShell)', shortLabel: 'Windows' },
  { id: 'linux', label: 'Linux', fullLabel: 'Linux (systemd)', shortLabel: 'Linux' },
  { id: 'wsl', label: 'WSL', fullLabel: 'WSL (Windows 子系统)', shortLabel: 'WSL' }
]

export const TUTORIAL_CHAPTERS = [
  { id: 'overview', title: '00. 链路原理与架构拓扑', badge: '原理' },
  { id: 'step-key', title: '01. 申请科大大模型 API Key', badge: '第一步' },
  { id: 'step-vlab', title: '02. 创建 VLab 虚拟机与生成密钥', badge: '第二步' },
  { id: 'step-ssh-key', title: '03. 下载与配置 SSH 私钥', badge: '第三步' },
  { id: 'step-first-login', title: '04. 首次登录 VLab 虚拟机', badge: '第四步' },
  { id: 'step-verify-api', title: '05. 在虚拟机验证 API 连通性', badge: '第五步' },
  { id: 'step-proxy-server', title: '06. 部署 FastAPI 流式代理', badge: '第六步' },
  { id: 'step-vlab-systemd', title: '07. 配置虚拟机代理后台自启', badge: '第七步' },
  { id: 'step-local-tunnel', title: '08. 配置本地 SSH 隧道', badge: '第八步' },
  { id: 'step-local-autostart', title: '09. 配置本地开机后台自启', badge: '第九步' },
  { id: 'step-web-setup', title: '10. 配置到本网页 (LabOrbit 科研助手)', badge: '核心直连' },
  { id: 'step-optional-dsh', title: '11. [可选] 配置 DeepSeek Harness (dsh)', badge: '可选扩展' },
  { id: 'step-troubleshooting', title: '12. 常见故障排查与验收清单', badge: '排查' }
]

/**
 * 获取用于渲染的结构化章节列表
 * @param {string} os 'all' | 'macos' | 'windows' | 'linux' | 'wsl'
 */
export function getTutorialData(os = 'all') {
  return {
    os,
    chapters: TUTORIAL_CHAPTERS,
    sections: [
      {
        id: 'overview',
        title: '链路原理与架构拓扑',
        badge: '安全架构',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '中国科大大模型公共服务平台仅允许校内 IP 访问。通过将轻量级代理部署在校内 VLab 虚拟机中，并在本地建立加密 SSH 隧道，可实现校外任意网络免 VPN 高速稳定直连。',
        highlights: [
          '真实 API Key 仅保存在校内 VLab 虚拟机中，本地零凭据暴露；',
          '通过本地 127.0.0.1:4000 端口加密转发，兼容 OpenAI API 标准格式；',
          '支持本地开机自启常驻，一次配置长期免登录生效；',
          '直通本网页 LabOrbit 科研助手，同时支持本地任何 AI 编程 Agent (Cursor, Claude Code 等)。'
        ],
        diagram: [
          '本地客户端 (本网页 / 本地 Agent / 终端)',
          '       │',
          '       ▼ [明文 HTTP / 端口 4000]',
          '本地 SSH 隧道客户端 (127.0.0.1:4000)',
          '       │',
          '       ▼ [加密 SSH 隧道传输 (跨越校外互联网)]',
          '校内 VLab 虚拟机 (vlab.ustc.edu.cn)',
          '       │',
          '       ▼ [FastAPI 流式代理 / 自动注入真实 API Key]',
          '中国科大大模型公共服务平台 API (https://api.llm.ustc.edu.cn/v1)'
        ]
      },
      {
        id: 'step-key',
        title: '第一步：申请科大大模型 API Key',
        badge: '凭据准备',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '登录中国科大大模型公共服务平台，获取专属 API Key。',
        notice: '申请通过大概需要半天到一天时间',
        steps: [
          {
            desc: '使用科大统一身份认证登录平台官网：',
            link: { url: 'https://llm.ustc.edu.cn/', label: 'https://llm.ustc.edu.cn/' }
          },
          {
            desc: '在左侧菜单栏进入「API 密钥管理」或「项目管理」，点击「创建项目」或「新建密钥」。'
          },
          {
            desc: '申请周期提示：申请通过大概需要半天到一天时间，审核完成前可能无法正常调用，提交后请耐心等待。'
          },
          {
            desc: '复制生成的 API 密钥（格式通常为 sk-xxxxxx），妥善暂存。请注意：此密钥后续仅需输入到 VLab 虚拟机中，切勿写在公开代码仓库中。'
          },
          {
            desc: '平台现已接入 16 个主流开源顶级模型，全面支持 deepseek V4.1、deepseek V4.1 flash 等，满足全场景科研问答、代码辅助与深度推理需求。'
          }
        ]
      },
      {
        id: 'step-vlab',
        title: '第二步：创建 VLab 虚拟机与生成下载密钥',
        badge: '算力与密钥',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: 'VLab 为中国科大校内虚拟实验平台，提供长期校内 IP 与基础 Linux 运行环境。通过 VLab 平台生成并下载 SSH 私钥，无需手动执行本地 ssh-keygen。',
        steps: [
          {
            title: '1. 登录 VLab 平台',
            desc: '访问中国科大 VLab 虚拟实验平台官网，进入后先点击「虚拟机管理」，然后再使用统一身份认证登录。默认每个用户可创建一台虚拟机（若已有可用虚拟机可直接复用）：',
            link: { url: 'https://vlab.ustc.edu.cn/', label: 'https://vlab.ustc.edu.cn/' }
          },
          {
            title: '2. 新建虚拟机',
            desc: '登录后点击页面左上方绿色的「新虚拟机」按钮。输入虚拟机名称（名称只能包含英文字母、数字、短线、点，如 ustc-ai-proxy）。操作系统镜像推荐选择默认 vlab01 系列 Ubuntu 镜像（如 Ubuntu 22.04 LTS 或 Debian 12，命令行镜像即可，代理用途无需桌面环境）。点击「创建」后后台通常分配很快，无需长时间等待；若列表没有立即出现新虚拟机，手动刷新页面几次即可（有时后台实际已创建就绪或已发送邮件通知，但页面未自动刷新列表）。'
          },
          {
            title: '3. 开机',
            desc: '虚拟机创建完成后，在对应虚拟机列表卡片中点击绿色的「开机」按钮。虚拟机开机没有所谓的独立状态指示灯，只要「开机」按钮颜色变暗，且卡片上的「启动时间」显示为非 0，即代表虚拟机已成功开机运行。'
          },
          {
            title: '4. [可选] 设置 VLab 平台密码',
            desc: '在 VLab 管理页面右上角找到「修改密码」或「设置密码」。此密码用于平台登录、VNC 桌面以及未挂载私钥时的备用 SSH 网关认证。'
          },
          {
            title: '5. 进入「SSH 密钥管理」',
            desc: '在虚拟机管理页面找到刚刚创建并开机的虚拟机卡片，点击虚拟机下方的「SSH 密钥管理」入口。'
          },
          {
            title: '6. 生成新的 SSH 密钥对',
            desc: '点击「生成新的 SSH 密钥对」按钮，平台会自动完成密钥生成并将公钥注入到虚拟机系统内，无需手动执行 ssh-keygen 或 ssh-copy-id。'
          },
          {
            title: '7. 下载私钥 (.pem)',
            desc: '密钥生成完毕后，点击「下载私钥」，浏览器会自动下载一个以 .pem 结尾的文件（例如命名为 vlab.pem）。若使用本地 Agent，可直接将该私钥交给 Agent 自动移动并收紧权限；若手动操作，将在下一步移动至本地系统的 .ssh 目录中。'
          }
        ]
      },
      {
        id: 'step-ssh-key',
        title: '第三步：下载与配置 SSH 私钥',
        badge: '权限与路径',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '在 VLab 控制台下载对应的私钥证书文件（例如命名为 vlab.pem）。若使用本地 Agent（Cursor, Claude Code, Antigravity 等），可直接将私钥交由 Agent 自动移动并配置权限；若手动操作，将其保存在本地 .ssh 目录中并收紧权限。',
        osGuidance: {
          macos: {
            title: 'macOS 私钥配置',
            commands: [
              '# 创建本地 .ssh 目录（若不存在）',
              'mkdir -p ~/.ssh',
              '',
              '# 将下载的私钥移动到 ~/.ssh/vlab.pem',
              'mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem',
              '',
              '# 严格收紧权限为当前用户只读（SSH 规范强制要求 600）',
              'chmod 600 ~/.ssh/vlab.pem'
            ]
          },
          windows: {
            title: 'Windows (PowerShell) 私钥配置',
            note: 'Windows 用户提示：浏览器下载的私钥文件大概率不在 C 盘。最简单的方法是直接打开文件资源管理器，将下载的 vlab.pem 手动移动到 C:\\Users\\<您的用户名>\\.ssh\\ 文件夹中即可。移动完成后仅需执行下方权限收紧命令。',
            commands: [
              '# 在 PowerShell 中创建 .ssh 目录（若不存在）',
              'if (!(Test-Path "$HOME\\.ssh")) { New-Item -ItemType Directory -Path "$HOME\\.ssh" }',
              '',
              '# 若在默认 Downloads 目录可运行以下命令移动（若在其他盘请直接手动拖拽到 $HOME\\.ssh\\vlab.pem）：',
              'if (Test-Path "$HOME\\Downloads\\vlab.pem") { Move-Item -Path "$HOME\\Downloads\\vlab.pem" -Destination "$HOME\\.ssh\\vlab.pem" -Force }',
              '',
              '# Windows 权限重置：移除所有继承权限，仅保留当前用户只读（杜绝 SSH 权限过宽报错）',
              'icacls "$HOME\\.ssh\\vlab.pem" /inheritance:r',
              'icacls "$HOME\\.ssh\\vlab.pem" /grant:r "$($env:USERNAME):(R)"'
            ]
          },
          linux: {
            title: 'Linux 私钥配置',
            commands: [
              '# 创建本地 .ssh 目录',
              'mkdir -p ~/.ssh',
              '',
              '# 移动私钥并设置 600 权限',
              'mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem',
              'chmod 600 ~/.ssh/vlab.pem'
            ]
          },
          wsl: {
            title: 'WSL (Windows 子系统) 私钥配置',
            commands: [
              '# 进入 WSL 终端，创建专属 .ssh 目录',
              'mkdir -p ~/.ssh',
              '',
              '# 从 Windows 宿主下载目录复制私钥文件到 WSL 根目录',
              'cp /mnt/c/Users/$USER/Downloads/vlab.pem ~/.ssh/vlab.pem',
              '',
              '# 收紧 Linux 权限',
              'chmod 600 ~/.ssh/vlab.pem'
            ]
          }
        }
      },
      {
        id: 'step-first-login',
        title: '第四步：首次登录 VLab 虚拟机',
        badge: '连通确认',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '测试本地终端与 VLab 虚拟机的 SSH 连通性。默认用户名固定为 ubuntu（切勿填写统一身份学号）。',
        commands: [
          '# VLab 官方 Ubuntu 镜像默认 Linux 用户名为固定的 ubuntu（请勿写成学号）',
          'ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn'
        ],
        note: '首次连接提示 "Are you sure you want to continue connecting (yes/no/[fingerprint])?" 时，请输入 yes 并回车。若私钥保留了虚拟机编号（如 vlab-vm14017.pem），请对应替换文件名。'
      },
      {
        id: 'step-verify-api',
        title: '第五步：在 VLab 虚拟机验证 API 连通性',
        badge: '校内连通',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '登录进 VLab 虚拟机后，在虚拟机内部直接发起 curl 请求，验证科大大模型平台的访问有效性。',
        commands: [
          '# 在 VLab 终端内执行：临时设置 API Key 环境变量（替换为第一步申请的 key）',
          'read -s -p "请输入您的 USTC API Key: " USTC_KEY && echo',
          '',
          '# 验证模型列表接口',
          'curl -sS https://api.llm.ustc.edu.cn/v1/models \\',
          '  -H "Authorization: Bearer $USTC_KEY"',
          '',
          '# 验证对话流式接口连通性',
          'curl -N -sS https://api.llm.ustc.edu.cn/v1/chat/completions \\',
          '  -H "Content-Type: application/json" \\',
          '  -H "Authorization: Bearer $USTC_KEY" \\',
          '  -d \'{"model":"deepseek-v4.1","messages":[{"role":"user","content":"ping"}],"stream":false}\''
        ],
        note: '注意：本步骤命令需在已登录进 VLab 虚拟机的终端窗口中执行，切勿在本地 Windows PowerShell 窗口中直接运行。若能正常返回 JSON 数据或模型 ID，说明校内 API 链路畅通，可以继续下一步。'
      },
      {
        id: 'step-proxy-server',
        title: '第六步：在 VLab 部署 FastAPI 流式代理',
        badge: '代理服务',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '在 VLab 虚拟机上安装 uv 并配置轻量级 FastAPI 流式代理。该代理负责监听本地 127.0.0.1:4000 端口，自动注入真实 API Key 并向上游转发请求。',
        commands: [
          '# 1. 在 VLab 虚拟机创建工作目录',
          'mkdir -p ~/ustc-proxy && cd ~/ustc-proxy',
          '',
          '# 2. 安装高效 Python 包管理器 uv',
          'curl -LsSf https://astral.sh/uv/install.sh | sh',
          'source $HOME/.local/bin/env',
          '',
          '# 3. 创建虚拟环境并安装核心依赖',
          'uv venv',
          'source .venv/bin/activate',
          'uv pip install "fastapi>=0.110.0" "uvicorn[standard]>=0.28.0" "httpx>=0.27.0"',
          '',
          '# 4. 安全写入真实 API Key（设置严格 600 文件权限）',
          'echo -n "$USTC_KEY" > key.secret',
          'chmod 600 key.secret'
        ],
        codeSnippet: {
          filename: '~/ustc-proxy/proxy-server.py',
          language: 'python',
          content: `import os
import httpx
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
        try:
            resp = await client.get(f"{UPSTREAM_URL}/models", headers=headers)
            return JSONResponse(status_code=resp.status_code, content=resp.json())
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

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
    # 仅绑定 127.0.0.1，严禁暴露公网，由 SSH 隧道提供加密通道
    uvicorn.run(app, host="127.0.0.1", port=4000, log_level="info")`
        }
      },
      {
        id: 'step-vlab-systemd',
        title: '第七步：配置虚拟机代理后台常驻自启',
        badge: '服务常驻',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '通过 systemd 用户服务与 loginctl linger，确保即使断开 SSH 会话或 VLab 发生轻微重载，代理服务依然在虚拟机内部稳定常驻。',
        commands: [
          '# 1. 创建 systemd 用户服务目录',
          'mkdir -p ~/.config/systemd/user',
          '',
          '# 2. 写入服务单元文件',
          'cat << \'EOF\' > ~/.config/systemd/user/ustc-proxy.service',
          '[Unit]',
          'Description=USTC LLM Secure Proxy Service',
          'After=network.target',
          '',
          '[Service]',
          'Type=simple',
          'WorkingDirectory=%h/ustc-proxy',
          'ExecStart=%h/ustc-proxy/.venv/bin/python proxy-server.py',
          'Restart=always',
          'RestartSec=5',
          'Environment="PYTHONUNBUFFERED=1"',
          '',
          '[Install]',
          'WantedBy=default.target',
          'EOF',
          '',
          '# 3. 启用并立即启动服务',
          'systemctl --user daemon-reload',
          'systemctl --user enable --now ustc-proxy',
          '',
          '# 4. 开启用户持久驻留（关键：退出 SSH 后服务不被终止）',
          'loginctl enable-linger $USER',
          '',
          '# 5. 检查运行状态与本地 4000 端口连通',
          'systemctl --user status ustc-proxy --no-pager',
          'curl -s http://127.0.0.1:4000/v1/models | head -c 100'
        ]
      },
      {
        id: 'step-local-tunnel',
        title: '第八步：配置本地 SSH 隧道',
        badge: '端口转发',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '在本地电脑上配置 ~/.ssh/config，定义 ustc-vlab（终端交互秒登）与 ustc-vpn（4000 端口加密隧道），固定使用 ubuntu 用户与 IdentitiesOnly yes 隔离认证。',
        configBlock: {
          path: '~/.ssh/config (Windows 为 %USERPROFILE%\\.ssh\\config)',
          content: `Host ustc-vlab
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
    LocalForward 127.0.0.1:4000 127.0.0.1:4000`
        },
        testCommand: 'ssh -NT ustc-vpn',
        verifyCommand: 'curl -s http://127.0.0.1:4000/v1/models',
        verifyCommandWin: 'curl.exe -s http://127.0.0.1:4000/v1/models',
        verifyNote: 'Windows PowerShell 用户特别注意：请运行 curl.exe 而非 curl（或者使用 Invoke-RestMethod http://127.0.0.1:4000/v1/models），若直接输入 curl 会被 PowerShell 别名拦截为 Invoke-WebRequest 导致提示「请为以下参数提供值，uri」。'
      },
      {
        id: 'step-local-autostart',
        title: '第九步：配置本地开机后台自启',
        badge: '无感使用',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '配置本地开机自动保持 SSH 隧道，无需每次手动在终端敲命令。',
        osGuidance: {
          macos: {
            title: 'macOS: Launchd 用户守护进程',
            path: '~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist',
            commands: [
              '# 1. 写入 launchd plist 配置文件',
              'cat << \'EOF\' > ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist',
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
              '<plist version="1.0">',
              '<dict>',
              '    <key>Label</key>',
              '    <string>com.ustc.vlab-tunnel</string>',
              '    <key>ProgramArguments</key>',
              '    <array>',
              '        <string>/usr/bin/ssh</string>',
              '        <string>-NT</string>',
              '        <string>ustc-vpn</string>',
              '    </array>',
              '    <key>RunAtLoad</key>',
              '    <true/>',
              '    <key>KeepAlive</key>',
              '    <true/>',
              '    <key>StandardOutPath</key>',
              '    <string>/tmp/vlab-tunnel.log</string>',
              '    <key>StandardErrorPath</key>',
              '    <string>/tmp/vlab-tunnel.err</string>',
              '</dict>',
              '</plist>',
              'EOF',
              '',
              '# 2. 加载并启动守护进程',
              'launchctl unload ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist 2>/dev/null || true',
              'launchctl load ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist',
              '',
              '# 3. 验证本地端口是否处于监听状态',
              'lsof -i :4000'
            ]
          },
          windows: {
            title: 'Windows: 任务计划程序后台自启',
            commands: [
              '# 以管理员身份或当前用户在 PowerShell 中创建自启任务',
              '$Action = New-ScheduledTaskAction -Execute "C:\\Windows\\System32\\OpenSSH\\ssh.exe" -Argument "-NT ustc-vpn"',
              '$Trigger = New-ScheduledTaskTrigger -AtLogOn',
              '$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)',
              'Register-ScheduledTask -TaskName "USTC-VLab-Tunnel" -Action $Action -Trigger $Trigger -Settings $Settings -Description "USTC LLM SSH Port Forwarding Tunnel"',
              '',
              '# 立即手动启动任务进行测试',
              'Start-ScheduledTask -TaskName "USTC-VLab-Tunnel"',
              '',
              '# 验证本地 4000 端口',
              'Test-NetConnection -ComputerName 127.0.0.1 -Port 4000'
            ]
          },
          linux: {
            title: 'Linux: systemd 用户级服务',
            path: '~/.config/systemd/user/ustc-tunnel.service',
            commands: [
              '# 1. 写入用户服务',
              'mkdir -p ~/.config/systemd/user',
              'cat << \'EOF\' > ~/.config/systemd/user/ustc-tunnel.service',
              '[Unit]',
              'Description=USTC LLM SSH Local Tunnel',
              'After=network.target',
              '',
              '[Service]',
              'Type=simple',
              'ExecStart=/usr/bin/ssh -NT ustc-vpn',
              'Restart=always',
              'RestartSec=10',
              '',
              '[Install]',
              'WantedBy=default.target',
              'EOF',
              '',
              '# 2. 启用并启动服务',
              'systemctl --user daemon-reload',
              'systemctl --user enable --now ustc-tunnel',
              '',
              '# 3. 验证本地端口',
              'ss -tulpn | grep 4000'
            ]
          },
          wsl: {
            title: 'WSL: 与 Windows 宿主配合使用',
            commands: [
              '# 推荐做法：在 Windows 宿主机配置上述任务计划程序，Windows 上的 127.0.0.1:4000 默认在 WSL2 中可通过 localhost:4000 无缝透明访问。',
              '# 若在 WSL 内部独立启动：',
              'nohup ssh -NT ustc-vpn > /tmp/vlab-tunnel.log 2>&1 &'
            ]
          }
        }
      },
      {
        id: 'step-web-setup',
        title: '第十步：配置到本网页 (LabOrbit 科研助手)',
        badge: '核心直连',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '完成本地隧道后，可将本网页（LabOrbit 科研助手）直连本地隧道。因浏览器跨域与混合内容安全策略，需按照以下图文步骤完成一次性浏览器放行。',
        steps: [
          {
            title: '1. 进入 AI 科研助手模型配置',
            desc: '点击本站顶部导航栏「AI 科研助手」，在右上角点击「模型配置」（齿轮图标）。'
          },
          {
            title: '2. 切换服务商为 USTC via Vlab',
            desc: '在「服务商」下拉菜单中选择「USTC via Vlab (推荐)」。系统将自动预设接口基地址为 http://127.0.0.1:4000/v1，此模式下无需输入任何 API Key。'
          },
          {
            title: '3. 放行浏览器混合内容 (Mixed Content) [极重要]',
            desc: '由于本网站部署在 HTTPS 安全域名 (https://csbd-hub.pages.dev)，现代浏览器默认会阻断网页向本地未加密的 http://127.0.0.1:4000 发起请求。请按以下方式放行：',
            substeps: [
              '点击浏览器地址栏最左侧的「网站设置」图标（通常为锁头旁边的滑块或调节图标）；',
              '在弹出菜单中点击「网站设置」或「权限」；',
              '找到「不安全内容 (Insecure content)」项；',
              '将其权限从默认的「屏蔽 (Block)」修改为「允许 (Allow)」；',
              '关闭设置页，返回本网页并按 F5 (或 Command+R) 刷新页面。'
            ]
          },
          {
            title: '4. 测试连通性并保存',
            desc: '刷新后重新打开「模型配置」，点击「测试连通性」按钮。当弹出「连通性测试成功，延迟 xx ms」时，点击「保存配置」。'
          },
          {
            title: '5. 享受全功能科研赋能',
            desc: '配置成功后，文献推荐流中将自动激活「与 AI 对话」研讨功能，邮件日程中将激活「AI 智能识别填报」，同时支持在对话中进行长文推理与代码分析。'
          }
        ]
      },
      {
        id: 'step-optional-dsh',
        title: '第十一步：[可选] 配置 DeepSeek Harness (dsh)',
        badge: '可选扩展',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '若您需要使用 DeepSeek 官方出品的本地终端与独立 Web 工具 DeepSeek Harness (dsh)，可使用以下配置直连已建立的本地 4000 端口。',
        steps: [
          {
            title: '启动 dsh 交互界面',
            command: 'npx @deepseek-ai/dsh web'
          },
          {
            title: '配置自定义 API 节点',
            desc: '在 dsh 配置界面中，API Base URL 填写：http://127.0.0.1:4000/v1；API Key 可填写任意占位符（例如 sk-vlab-local-dummy），因为真实的认证凭据已由 VLab 代理端自动注入。'
          },
          {
            title: '配置模型映射与思考深度',
            desc: '在 dsh 的 settings.yaml 中可将 deepseek-chat 映射至 deepseek-ai/DeepSeek-V3，将 deepseek-reasoner 映射至 deepseek-ai/DeepSeek-R1。'
          }
        ]
      },
      {
        id: 'step-troubleshooting',
        title: '第十二步：常见故障排查与验收清单',
        badge: '故障排查',
        targetOs: ['all', 'macos', 'windows', 'linux', 'wsl'],
        summary: '若在连接测试或对话中遇到异常，请按以下顺序快速定位解决：',
        faqs: [
          {
            q: '点击测试连通性提示 Failed to fetch 或网络连接失败？',
            a: '最常见原因是浏览器阻断了混合内容 (Mixed Content)。请确保已在浏览器地址栏的网站设置中，将「不安全内容」设为「允许」并刷新网页。'
          },
          {
            q: 'SSH 登录报错 Too many authentication failures 或拒绝连接？',
            a: '1. 请检查 ~/.ssh/config 中是否配置了 IdentitiesOnly yes，避免本地多私钥轮询触发防爆破限制；2. 请确认登录用户固定为 ubuntu 而非学号；3. 确认私钥路径与 600 权限正确。'
          },
          {
            q: '本地终端运行 curl http://127.0.0.1:4000/v1/models 提示 Connection refused？',
            a: '说明本地 SSH 隧道未启动，或 VLab 端的代理服务未在运行。请先运行 `ssh -NT ustc-vpn` 观察是否有报错；若提示端口已被占用，请先使用 lsof -i :4000 (macOS/Linux) 或 netstat -ano | findstr :4000 (Windows) 排查并释放冲突进程。'
          },
          {
            q: 'SSH 连接提示 Permissions 0644 are too open？',
            a: '私钥文件权限过宽。macOS/Linux 用户请执行 `chmod 600 ~/.ssh/vlab.pem`；Windows 用户请使用 icacls 移除其他用户继承权限。'
          },
          {
            q: '过了一段时间后代理突然失效？',
            a: '请检查 VLab 虚拟机是否被关机，或是否忘记在 VLab 端执行 `loginctl enable-linger $USER`。若未开启 linger，用户断开 SSH 后 systemd 用户服务会被系统挂起。'
          },
          {
            q: 'Windows PowerShell 运行验证命令提示「请为以下参数提供值，uri」？',
            a: '核心原因：在 Windows PowerShell 中，`curl` 默认是 cmdlet `Invoke-WebRequest` 的别名。当运行 `curl -s http://...` 时，参数 `-s` 被 PowerShell 模糊匹配为 `-SessionVariable`，并将后面的 URL 当作该变量名，导致必选参数 `-Uri` 缺失而弹出该交互式提示。\n\n解决办法：\n1. 改用 Windows 自带的真实 curl 程序：输入 `curl.exe -s http://127.0.0.1:4000/v1/models`（务必带上 `.exe` 后缀，避开 PowerShell 别名）；\n2. 或使用 PowerShell 原生网络请求命令：`Invoke-RestMethod http://127.0.0.1:4000/v1/models`（简写 `irm http://127.0.0.1:4000/v1/models`）；\n3. 若是在尝试执行第五步测试校内 API，请确认自己是否已登录进 VLab 远程虚拟机（`ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn`），校内 API 验证命令必须在 VLab 远程 Linux 终端执行，切勿在本地 Windows 终端直接执行。'
          }
        ]
      }
    ]
  }
}

/**
 * 生成干净结构化的 Markdown 文档，专供用户下载或一键提供给本地 Agent (Cursor, Claude Code, Antigravity 等)
 * @param {string} os 'all' | 'macos' | 'windows' | 'linux' | 'wsl'
 */
export function generateTutorialMarkdown(os = 'all') {
  const osName = OS_OPTIONS.find(o => o.id === os)?.label || '全部系统'
  const data = getTutorialData(os)

  let md = `# 中国科大大模型 VLab 虚拟机 SSH 隧道配置完整指南\n\n`
  md += `> **核心福利**：中国科大每日为全校师生免费提供 100 元额度的 Token 算力（全面支持 deepseek V4.1、deepseek V4.1 flash 等 16 款主流开源大模型）。\n`
  md += `> **极简执行指引**：\n`
  md += `> 1. 全流程总共只需十个步骤，即可跑通并配置本地开机后台自启常驻；\n`
  md += `> 2. 若拥有本地 AI 编程 Agent（Cursor, Claude Code, Antigravity 等），用户**实际上只需要手动完成前 2 步网页操作与私钥下载**，后续步骤 03 ~ 10 将本 Markdown 文档投喂给本地 Agent 全自动执行即可！\n`
  md += `> 目标操作系统：${osName}\n`
  md += `> 生成来源：中国科大 LabOrbit 科研助手平台\n`
  md += `> 官方大模型平台：https://llm.ustc.edu.cn/\n`
  md += `> VLab 实验平台：https://vlab.ustc.edu.cn/\n\n`

  md += `## 【给本地 AI 编程 Agent 的执行提示】\n\n`
  md += `如果你是 Cursor, Claude Code, Antigravity, VS Code Copilot 等本地 AI 编程助手，请阅读以下指南：\n`
  md += `1. **用户已完成前 2 步**：用户已在网页端完成前 2 步操作（已获得 USTC API Key 并下载了 \`vlab.pem\` 私钥证书文件至本地）。请本地 Agent 接管后续步骤 03 ~ 10，自动完成私钥移动与权限收紧、本地与远端虚拟机的配置与验证；\n`
  md += `2. **私钥处理指引**：用户的私钥证书（如 \`vlab.pem\`）已下载到本地。对于 Windows 用户，浏览器下载路径大概率不在 C 盘或默认用户目录，请 Agent 注意在常见下载路径（如各盘 Downloads 文件夹）自动查找 \`*.pem\` 文件，并将其移动至 \`~/.ssh/vlab.pem\`（或 \`%USERPROFILE%\\.ssh\\vlab.pem\`），并设置权限为当前用户只读（600 权限）；\n`
  md += `3. **目标**：在用户本机 (${osName}) 与用户的校内 VLab 远程虚拟机之间建立稳定、加密且支持开机自启的 SSH 端口转发隧道 (本地 127.0.0.1:4000 -> VLab 127.0.0.1:4000)；\n`
  md += `4. **安全性规范**：真实 API Key 仅存放在 VLab 虚拟机内 (~/ustc-proxy/key.secret，权限 600)，本地无需且严禁留存真实 Key；\n`
  md += `5. **执行范围**：本指南提供了完整的本地终端命令、VLab 远程执行脚本与配置文件。请在操作本地文件（如 ~/.ssh/config、私钥权限设置）时先确认文件备份，并在操作完毕后执行连通性验收。\n\n`
  md += `---\n\n`

  md += `## 目录 (总共只需 10 步核心流程)\n\n`
  TUTORIAL_CHAPTERS.forEach((ch, idx) => {
    md += `${idx + 1}. [${ch.title}](#${ch.id})\n`
  })
  md += `\n---\n\n`

  // 架构说明
  md += `## <span id="overview">00. 链路原理与架构拓扑</span>\n\n`
  md += `中国科大大模型公共服务平台只针对校园网 IP 开放。本方案采用 **VLab 虚拟机端口转发 + 本地加密 SSH 隧道 + FastAPI 流式反向代理** 的架构：\n\n`
  md += `\`\`\`text\n`
  md += `[本地应用 / 本网页 / 本地 Agent]\n`
  md += `              │  HTTP 请求 (127.0.0.1:4000)\n`
  md += `              ▼\n`
  md += `[本地 SSH 隧道 (LocalForward 127.0.0.1:4000 127.0.0.1:4000)]\n`
  md += `              │  SSH 加密通道 (穿透校外互联网)\n`
  md += `              ▼\n`
  md += `[校内 VLab 虚拟机 (vlab.ustc.edu.cn)]\n`
  md += `              │  FastAPI 代理服务 (~/ustc-proxy/proxy-server.py)\n`
  md += `              │  自动从 key.secret 读取并注入 Authorization: Bearer <KEY>\n`
  md += `              ▼\n`
  md += `[中国科大大模型公共服务平台 API (https://api.llm.ustc.edu.cn/v1)]\n`
  md += `\`\`\`\n\n`

  // 第一步
  md += `## <span id="step-key">01. 申请科大大模型 API Key</span>\n\n`
  md += `> **申请周期提示**：申请通过大概需要半天到一天时间，请提交申请后耐心等待平台审批通过。\n\n`
  md += `1. 访问中国科大大模型官网：[https://llm.ustc.edu.cn/](https://llm.ustc.edu.cn/) 并使用统一身份认证登录；\n`
  md += `2. 进入「API 密钥管理」或「项目中心」，点击「创建项目」并申请专属 API Key；\n`
  md += `3. 提示：申请通过大概需要半天到一天时间，审核完成前可能无法正常调用；\n`
  md += `4. 妥善复制生成的 API 密钥（格式通常为 \`sk-xxxxxx\`），此密钥后续仅存放在 VLab 虚拟机中，本地无需留存；\n`
  md += `5. 平台现已接入 16 个主流开源顶级模型，全面支持 deepseek V4.1 和 deepseek V4.1 flash 等：\n`
  md += `   - \`deepseek V4.1\`\n`
  md += `   - \`deepseek V4.1 flash\`\n`
  md += `   - 以及其他主流开源模型共 16 款\n\n`

  // 第二步
  md += `## <span id="step-vlab">02. 创建 VLab 虚拟机与生成下载密钥</span>\n\n`
  md += `1. **登录 VLab 平台**：\n`
  md += `   - 访问 [https://vlab.ustc.edu.cn/](https://vlab.ustc.edu.cn/)，进入后先点击页面中的「虚拟机管理」，然后再使用统一身份认证登录；\n`
  md += `   - 平台默认每个用户可创建一台虚拟机，若已有可用虚拟机可直接复用；\n`
  md += `2. **新建虚拟机**：\n`
  md += `   - 点击页面左上方绿色的「新虚拟机」按钮；\n`
  md += `   - 输入虚拟机名称（名称只能包含英文字母、数字、短线、点，如 \`ustc-ai-proxy\`）；\n`
  md += `   - 选择 Linux 镜像（推荐默认 \`vlab01\` 系列 Ubuntu 镜像，如 Ubuntu 22.04 LTS 或 Debian 12，命令行镜像即可，代理用途无需桌面环境）；\n`
  md += `   - 点击「创建」按钮。后台通常分配很快，无需长时间等待；若列表没有立即出现新虚拟机，手动刷新页面几次即可（有时后台实际已创建就绪或已发送邮件通知，但页面未自动刷新列表）；\n`
  md += `3. **开机**：\n`
  md += `   - 创建完成后，在虚拟机卡片上点击绿色的「开机」按钮。虚拟机开机没有所谓的独立状态指示灯，只要「开机」按钮颜色变暗，且卡片上的「启动时间」显示为非 0，即代表虚拟机已成功开机运行；\n`
  md += `4. **【可选】设置 VLab 平台密码**：\n`
  md += `   - 在管理页面右上角找到「修改密码」或「设置密码」，用于平台登录、VNC 桌面以及未挂载私钥时的备用 SSH 密码认证；\n`
  md += `5. **进入「SSH 密钥管理」**：\n`
  md += `   - 在虚拟机管理页面找到刚刚创建并开机的虚拟机卡片，点击卡片下方的「SSH 密钥管理」入口；\n`
  md += `6. **生成新的 SSH 密钥对**：\n`
  md += `   - 点击「生成新的 SSH 密钥对」按钮，平台会自动完成密钥对生成并将公钥注入到虚拟机中（无需自己在本地运行 \`ssh-keygen\` 或 \`ssh-copy-id\`）；\n`
  md += `7. **下载私钥**：\n`
  md += `   - 点击「下载私钥」按钮，浏览器会自动下载一个以 \`.pem\` 结尾的私钥证书文件（例如保存为 \`vlab.pem\`）。若使用本地 Agent，可直接将该私钥交给 Agent 自动配置；若手动操作，将在下一步移动至本地系统。\n\n`

  // 第三步
  md += `## <span id="step-ssh-key">03. 下载与配置 SSH 私钥</span>\n\n`
  md += `在 VLab 平台下载 SSH 私钥证书文件并保存为 \`vlab.pem\`。若使用本地 Agent（Cursor, Claude Code, Antigravity 等），可直接将私钥交由 Agent 自动移动并配置权限；若手动操作，请按下方各系统指引执行。\n\n`

  if (os === 'all' || os === 'macos') {
    md += `### macOS 本地操作命令\n\n`
    md += `\`\`\`bash\n`
    md += `mkdir -p ~/.ssh\n`
    md += `mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem\n`
    md += `chmod 600 ~/.ssh/vlab.pem\n`
    md += `\`\`\`\n\n`
  }

  if (os === 'all' || os === 'windows') {
    md += `### Windows (PowerShell) 本地操作指引与命令\n\n`
    md += `> **Windows 用户提示**：浏览器下载的私钥文件大概率不在 C 盘（例如在 D 盘或 E 盘下载文件夹）。\n`
    md += `> **最简单直接的方式**：打开 Windows 文件资源管理器，直接将下载好的 \`vlab.pem\` 文件**手动移动/复制到 \`C:\\Users\\<您的用户名>\\.ssh\\\` 文件夹中**即可（若没有 \`.ssh\` 文件夹，可在该目录下新建一个）。\n`
    md += `> 移动完成后，仅需在 PowerShell 中执行下方权限收紧命令：\n\n`
    md += `\`\`\`powershell\n`
    md += `if (!(Test-Path "$HOME\\.ssh")) { New-Item -ItemType Directory -Path "$HOME\\.ssh" }\n`
    md += `if (Test-Path "$HOME\\Downloads\\vlab.pem") { Move-Item -Path "$HOME\\Downloads\\vlab.pem" -Destination "$HOME\\.ssh\\vlab.pem" -Force }\n`
    md += `icacls "$HOME\\.ssh\\vlab.pem" /inheritance:r\n`
    md += `icacls "$HOME\\.ssh\\vlab.pem" /grant:r "$($env:USERNAME):(R)"\n`
    md += `\`\`\`\n\n`
  }

  if (os === 'all' || os === 'linux') {
    md += `### Linux 本地操作命令\n\n`
    md += `\`\`\`bash\n`
    md += `mkdir -p ~/.ssh\n`
    md += `mv ~/Downloads/vlab.pem ~/.ssh/vlab.pem\n`
    md += `chmod 600 ~/.ssh/vlab.pem\n`
    md += `\`\`\`\n\n`
  }

  if (os === 'all' || os === 'wsl') {
    md += `### WSL 本地操作命令\n\n`
    md += `\`\`\`bash\n`
    md += `mkdir -p ~/.ssh\n`
    md += `cp /mnt/c/Users/$USER/Downloads/vlab.pem ~/.ssh/vlab.pem\n`
    md += `chmod 600 ~/.ssh/vlab.pem\n`
    md += `\`\`\`\n\n`
  }

  // 第四步
  md += `## <span id="step-first-login">04. 首次登录 VLab 虚拟机</span>\n\n`
  md += `在本地终端中测试登录（VLab Ubuntu 镜像默认 Linux 用户名固定为 \`ubuntu\`，切勿填写学号）：\n\n`
  md += `\`\`\`bash\n`
  md += `ssh -i ~/.ssh/vlab.pem ubuntu@vlab.ustc.edu.cn\n`
  md += `\`\`\`\n\n`
  md += `提示指纹验证时输入 \`yes\`。若私钥保留了虚拟机编号（如 \`vlab-vm14017.pem\`），请对应替换文件名。\n\n`

  // 第五步
  md += `## <span id="step-verify-api">05. 在虚拟机验证 API 连通性</span>\n\n`
  md += `登录进入 VLab 虚拟机后，在远程终端内执行：\n\n`
  md += `\`\`\`bash\n`
  md += `read -s -p "请输入 USTC API Key: " USTC_KEY && echo\n`
  md += `curl -sS https://api.llm.ustc.edu.cn/v1/models \\\n`
  md += `  -H "Authorization: Bearer $USTC_KEY"\n`
  md += `\`\`\`\n\n`

  // 第六步
  md += `## <span id="step-proxy-server">06. 部署 FastAPI 流式代理</span>\n\n`
  md += `在 VLab 虚拟机上安装 uv 并创建代理服务：\n\n`
  md += `\`\`\`bash\n`
  md += `mkdir -p ~/ustc-proxy && cd ~/ustc-proxy\n`
  md += `curl -LsSf https://astral.sh/uv/install.sh | sh\n`
  md += `source $HOME/.local/bin/env\n`
  md += `uv venv\n`
  md += `source .venv/bin/activate\n`
  md += `uv pip install "fastapi>=0.110.0" "uvicorn[standard]>=0.28.0" "httpx>=0.27.0"\n`
  md += `echo -n "$USTC_KEY" > key.secret\n`
  md += `chmod 600 key.secret\n`
  md += `\`\`\`\n\n`
  md += `在 \`~/ustc-proxy/proxy-server.py\` 中写入以下代理脚本：\n\n`
  md += `\`\`\`python\n`
  md += `import os, httpx\n`
  md += `from fastapi import FastAPI, Request\n`
  md += `from fastapi.responses import StreamingResponse, JSONResponse\n\n`
  md += `app = FastAPI(title="USTC LLM Secure Proxy")\n`
  md += `UPSTREAM_URL = "https://api.llm.ustc.edu.cn/v1"\n`
  md += `KEY_FILE = os.path.expanduser("~/ustc-proxy/key.secret")\n\n`
  md += `def get_api_key():\n`
  md += `    if os.path.exists(KEY_FILE):\n`
  md += `        with open(KEY_FILE, "r", encoding="utf-8") as f:\n`
  md += `            return f.read().strip()\n`
  md += `    return os.environ.get("USTC_API_KEY", "")\n\n`
  md += `@app.get("/v1/models")\n`
  md += `async def list_models():\n`
  md += `    api_key = get_api_key()\n`
  md += `    headers = {"Authorization": f"Bearer {api_key}"}\n`
  md += `    async with httpx.AsyncClient(timeout=30.0) as client:\n`
  md += `        resp = await client.get(f"{UPSTREAM_URL}/models", headers=headers)\n`
  md += `        return JSONResponse(status_code=resp.status_code, content=resp.json())\n\n`
  md += `@app.post("/v1/chat/completions")\n`
  md += `async def chat_completions(request: Request):\n`
  md += `    api_key = get_api_key()\n`
  md += `    body = await request.json()\n`
  md += `    is_stream = body.get("stream", False)\n`
  md += `    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}\n`
  md += `    client = httpx.AsyncClient(timeout=180.0)\n\n`
  md += `    if is_stream:\n`
  md += `        async def stream_generator():\n`
  md += `            try:\n`
  md += `                async with client.stream(\n`
  md += `                    "POST",\n`
  md += `                    f"{UPSTREAM_URL}/chat/completions",\n`
  md += `                    json=body,\n`
  md += `                    headers=headers\n`
  md += `                ) as upstream_resp:\n`
  md += `                    async for chunk in upstream_resp.aiter_bytes():\n`
  md += `                        yield chunk\n`
  md += `            finally:\n`
  md += `                await client.aclose()\n`
  md += `        return StreamingResponse(stream_generator(), media_type="text/event-stream")\n`
  md += `    else:\n`
  md += `        try:\n`
  md += `            resp = await client.post(\n`
  md += `                f"{UPSTREAM_URL}/chat/completions",\n`
  md += `                json=body,\n`
  md += `                headers=headers\n`
  md += `            )\n`
  md += `            await client.aclose()\n`
  md += `            return JSONResponse(status_code=resp.status_code, content=resp.json())\n`
  md += `        except Exception as e:\n`
  md += `            await client.aclose()\n`
  md += `            return JSONResponse(status_code=500, content={"error": str(e)})\n\n`
  md += `if __name__ == "__main__":\n`
  md += `    import uvicorn\n`
  md += `    uvicorn.run(app, host="127.0.0.1", port=4000, log_level="info")\n`
  md += `\`\`\`\n\n`

  // 第七步
  md += `## <span id="step-vlab-systemd">07. 配置虚拟机代理后台自启</span>\n\n`
  md += `在 VLab 虚拟机终端内配置 systemd 用户单元：\n\n`
  md += `\`\`\`bash\n`
  md += `mkdir -p ~/.config/systemd/user\n`
  md += `cat << 'EOF' > ~/.config/systemd/user/ustc-proxy.service\n`
  md += `[Unit]\n`
  md += `Description=USTC LLM Secure Proxy Service\n`
  md += `After=network.target\n\n`
  md += `[Service]\n`
  md += `Type=simple\n`
  md += `WorkingDirectory=%h/ustc-proxy\n`
  md += `ExecStart=%h/ustc-proxy/.venv/bin/python proxy-server.py\n`
  md += `Restart=always\n`
  md += `RestartSec=5\n`
  md += `Environment="PYTHONUNBUFFERED=1"\n\n`
  md += `[Install]\n`
  md += `WantedBy=default.target\n`
  md += `EOF\n\n`
  md += `systemctl --user daemon-reload\n`
  md += `systemctl --user enable --now ustc-proxy\n`
  md += `loginctl enable-linger $USER\n`
  md += `\`\`\`\n\n`

  // 第八步
  md += `## <span id="step-local-tunnel">08. 配置本地 SSH 隧道</span>\n\n`
  md += `在本地电脑编辑 \`~/.ssh/config\`（Windows 为 \`$HOME\\.ssh\\config\`）：\n\n`
  md += `\`\`\`ssh\n`
  md += `Host ustc-vlab\n`
  md += `    HostName vlab.ustc.edu.cn\n`
  md += `    User ubuntu\n`
  md += `    IdentityFile ~/.ssh/vlab.pem\n`
  md += `    IdentitiesOnly yes\n`
  md += `    ServerAliveInterval 60\n`
  md += `    ServerAliveCountMax 3\n\n`
  md += `Host ustc-vpn\n`
  md += `    HostName vlab.ustc.edu.cn\n`
  md += `    User ubuntu\n`
  md += `    IdentityFile ~/.ssh/vlab.pem\n`
  md += `    IdentitiesOnly yes\n`
  md += `    ServerAliveInterval 60\n`
  md += `    ServerAliveCountMax 3\n`
  md += `    ExitOnForwardFailure yes\n`
  md += `    LocalForward 127.0.0.1:4000 127.0.0.1:4000\n`
  md += `\`\`\`\n\n`
  md += `提示：若您下载的私钥自带虚拟机编号（例如 \`~/.ssh/vlab-vm14017.pem\`），请按实际路径修改 \`IdentityFile\`。\n\n`
  md += `在本地终端测试前台转发：\n\n`
  md += `\`\`\`bash\n`
  md += `ssh -NT ustc-vpn\n`
  md += `\`\`\`\n\n`
  md += `在新窗口验证：\n\n`
  md += `- **macOS / Linux**：\`curl -s http://127.0.0.1:4000/v1/models\`\n`
  md += `- **Windows (PowerShell)**：\`curl.exe -s http://127.0.0.1:4000/v1/models\` 或 \`Invoke-RestMethod http://127.0.0.1:4000/v1/models\`\n`
  md += `  > **Windows 避坑提示**：PowerShell 中 \`curl\` 是 \`Invoke-WebRequest\` 的别名，若只敲 \`curl -s ...\` 会触发 \`-SessionVariable\` 并提示「请为以下参数提供值，uri」。务必输入 \`curl.exe\` 或使用 \`Invoke-RestMethod\`。\n\n`

  // 第九步
  md += `## <span id="step-local-autostart">09. 配置本地开机后台自启</span>\n\n`

  if (os === 'all' || os === 'macos') {
    md += `### macOS 本地自启 (Launchd)\n\n`
    md += `创建 \`~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist\`：\n\n`
    md += `\`\`\`xml\n`
    md += `<?xml version="1.0" encoding="UTF-8"?>\n`
    md += `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n`
    md += `<plist version="1.0">\n`
    md += `<dict>\n`
    md += `    <key>Label</key>\n`
    md += `    <string>com.ustc.vlab-tunnel</string>\n`
    md += `    <key>ProgramArguments</key>\n`
    md += `    <array>\n`
    md += `        <string>/usr/bin/ssh</string>\n`
    md += `        <string>-NT</string>\n`
    md += `        <string>ustc-vpn</string>\n`
    md += `    </array>\n`
    md += `    <key>RunAtLoad</key>\n`
    md += `    <true/>\n`
    md += `    <key>KeepAlive</key>\n`
    md += `    <true/>\n`
    md += `    <key>StandardOutPath</key>\n`
    md += `    <string>/tmp/vlab-tunnel.log</string>\n`
    md += `    <key>StandardErrorPath</key>\n`
    md += `    <string>/tmp/vlab-tunnel.err</string>\n`
    md += `</dict>\n`
    md += `</plist>\n`
    md += `\`\`\`\n\n`
    md += `加载守护进程：\`launchctl load ~/Library/LaunchAgents/com.ustc.vlab-tunnel.plist\`\n\n`
  }

  if (os === 'all' || os === 'windows') {
    md += `### Windows 本地自启 (任务计划程序)\n\n`
    md += `以 PowerShell 运行：\n\n`
    md += `\`\`\`powershell\n`
    md += `$Action = New-ScheduledTaskAction -Execute "C:\\Windows\\System32\\OpenSSH\\ssh.exe" -Argument "-NT ustc-vpn"\n`
    md += `$Trigger = New-ScheduledTaskTrigger -AtLogOn\n`
    md += `$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1)\n`
    md += `Register-ScheduledTask -TaskName "USTC-VLab-Tunnel" -Action $Action -Trigger $Trigger -Settings $Settings\n`
    md += `Start-ScheduledTask -TaskName "USTC-VLab-Tunnel"\n`
    md += `\`\`\`\n\n`
  }

  if (os === 'all' || os === 'linux') {
    md += `### Linux 本地自启 (systemd)\n\n`
    md += `写入 \`~/.config/systemd/user/ustc-tunnel.service\`：\n\n`
    md += `\`\`\`ini\n`
    md += `[Unit]\n`
    md += `Description=USTC LLM SSH Local Tunnel\n`
    md += `After=network.target\n\n`
    md += `[Service]\n`
    md += `Type=simple\n`
    md += `ExecStart=/usr/bin/ssh -NT ustc-vpn\n`
    md += `Restart=always\n`
    md += `RestartSec=10\n\n`
    md += `[Install]\n`
    md += `WantedBy=default.target\n`
    md += `\`\`\`\n\n`
    md += `启用服务：\`systemctl --user enable --now ustc-tunnel\`\n\n`
  }

  if (os === 'all' || os === 'wsl') {
    md += `### WSL 使用建议\n\n`
    md += `在 Windows 宿主机上按上述任务计划程序启动隧道后，WSL 环境可直接通过 \`127.0.0.1:4000\` 访问。\n\n`
  }

  // 第十步
  md += `## <span id="step-web-setup">10. 配置到本网页 (LabOrbit 科研助手)</span>\n\n`
  md += `1. **打开配置窗口**：进入本站「AI 科研助手」，点击右上角齿轮图标打开「模型配置」；\n`
  md += `2. **选择服务商**：在下拉框中选择 **USTC via Vlab (推荐)**。接口基地址默认为 \`http://127.0.0.1:4000/v1\`，无需填写 API Key；\n`
  md += `3. **放行浏览器混合内容 (Mixed Content) [关键步骤]**：\n`
  md += `   - 本站线上为 HTTPS 协议，浏览器默认阻止连接本地 HTTP 接口；\n`
  md += `   - 点击浏览器地址栏左侧网站设置图标 -> 点击「网站设置」或「权限」；\n`
  md += `   - 找到「不安全内容 (Insecure content)」项，从「阻止」修改为「**允许**」；\n`
  md += `   - 刷新网页；\n`
  md += `4. **测试与保存**：点击「测试连通性」，通过后点击「保存配置」。\n\n`

  // 第十一步
  md += `## <span id="step-optional-dsh">11. [可选] 配置 DeepSeek Harness (dsh)</span>\n\n`
  md += `若需要在本地终端使用 DeepSeek Harness：\n`
  md += `\`\`\`bash\n`
  md += `npx @deepseek-ai/dsh web\n`
  md += `\`\`\`\n`
  md += `- API Base URL: \`http://127.0.0.1:4000/v1\`\n`
  md += `- API Key: \`sk-vlab-local-dummy\` (占位符即可)\n`
  md += `- 模型配置：在 \`settings.yaml\` 中将 deepseek-chat 映射为 \`deepseek-ai/DeepSeek-V3\`，deepseek-reasoner 映射为 \`deepseek-ai/DeepSeek-R1\`。\n\n`

  // 第十二步
  md += `## <span id="step-troubleshooting">12. 常见故障排查与验收清单</span>\n\n`
  md += `- **测试连通性失败或显示网络异常**：优先检查浏览器是否放行了 Mixed Content（不安全内容）；\n`
  md += `- **SSH 报错 Too many authentication failures 或连接被拒**：请确保 ~/.ssh/config 已配置 \`IdentitiesOnly yes\` 且登录用户固定为 \`ubuntu\`（切勿写成学号）；\n`
  md += `- **端口 4000 冲突**：运行 \`lsof -i :4000\` (macOS/Linux) 或 \`netstat -ano | findstr :4000\` (Windows) 查看占用进程；\n`
  md += `- **SSH 连接报错 Permissions 0644 are too open**：检查私钥权限是否为当前用户只读 (\`chmod 600\`)；\n`
  md += `- **服务离线**：确认 VLab 虚拟机是否开机，以及是否执行过 \`loginctl enable-linger $USER\`；\n`
  md += `- **Windows 运行 curl 提示「请为以下参数提供值，uri」**：PowerShell 中 \`curl\` 是 \`Invoke-WebRequest\` 的别名，请运行 \`curl.exe -s http://127.0.0.1:4000/v1/models\`（带 \`.exe\`）或 \`Invoke-RestMethod http://127.0.0.1:4000/v1/models\`。\n`

  return md
}

/**
 * 触发 Markdown 文件下载
 * @param {string} os
 */
export function downloadTutorialMarkdown(os = 'all') {
  const content = generateTutorialMarkdown(os)
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ustc-vlab-setup-${os}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * 复制 Markdown 内容至剪贴板
 * @param {string} os
 */
export async function copyTutorialMarkdown(os = 'all') {
  const content = generateTutorialMarkdown(os)
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return true
  }
  const textArea = document.createElement('textarea')
  textArea.value = content
  textArea.style.position = 'fixed'
  textArea.style.opacity = '0'
  document.body.appendChild(textArea)
  textArea.select()
  try {
    document.execCommand('copy')
    document.body.removeChild(textArea)
    return true
  } catch (err) {
    document.body.removeChild(textArea)
    return false
  }
}
