import { DEMO_MEMBERS } from './demoData'

export function isDemoMode() {
  const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null)

  // 1. URL Query 显式控制（具有最高覆盖优先级，支持 search 与 hash 内部 query）
  if (typeof window !== 'undefined') {
    let demoParam = null
    try {
      if (window.location?.search) {
        const params = new URLSearchParams(window.location.search)
        demoParam = params.get('demo')
      }
      if (!demoParam && window.location?.hash && window.location.hash.includes('?')) {
        const hashQuery = window.location.hash.slice(window.location.hash.indexOf('?') + 1)
        const params = new URLSearchParams(hashQuery)
        demoParam = params.get('demo')
      }
      if (demoParam === '1' || demoParam === 'true') {
        storage?.setItem('labhub_force_demo', '1')
        return true
      }
      if (demoParam === '0' || demoParam === 'false') {
        storage?.setItem('labhub_force_demo', '0')
        if (storage?.getItem('labhub_token')?.startsWith('demo_')) {
          storage?.removeItem('labhub_token')
          storage?.removeItem('labhub_user')
        }
        return false
      }
    } catch {}
  }

  // 2. 本地持久化显式指定（最高优先级：'0' 为绝对禁止，'1' 为绝对开启）
  if (storage?.getItem('labhub_force_demo') === '0') return false
  if (storage?.getItem('labhub_force_demo') === '1') return true

  // 3. 部署环境与域名判断：GitHub Pages 域名天然为演示体验模式
  if (typeof window !== 'undefined') {
    const host = window.location.hostname || ''
    if (host.endsWith('github.io') || host.includes('github.io')) return true
  }

  // 4. 构建环境变量（仅在未被本地明确关闭时生效，如 build:demo）
  if (import.meta.env?.VITE_DEMO_MODE === 'true') return true

  // 5. 其余任何情况（标准本地或云服务器生产部署），绝对处于真实部署模式！
  // 若存在历史遗留的 demo_ token，顺手清理，杜绝状态污染
  if (storage?.getItem('labhub_token')?.startsWith('demo_')) {
    storage?.removeItem('labhub_token')
    storage?.removeItem('labhub_user')
  }

  return false
}

/**
 * 初始化演示环境：自动注入体验凭据，免密直通主看板
 * 默认进入管理员（李华 - 导师）视角
 */
export function initDemoAuth() {
  if (!isDemoMode()) return

  const existingToken = localStorage.getItem('labhub_token')
  if (!existingToken || existingToken.startsWith('demo_')) {
    const defaultUser = DEMO_MEMBERS[0]
    localStorage.setItem('labhub_token', 'demo_jwt_token_laborbit_experience')
    if (!localStorage.getItem('labhub_user') || existingToken !== 'demo_jwt_token_laborbit_experience') {
      localStorage.setItem('labhub_user', JSON.stringify(defaultUser))
    }
  }
}

/**
 * 演示模式下切换体验身份（管理员 vs 普通成员）
 */
export function switchDemoRole(role = 'admin') {
  let targetUser = null
  if (role === 'admin' || role === 'teacher') {
    targetUser = DEMO_MEMBERS.find(m => m.role === 'admin') || DEMO_MEMBERS[0]
  } else {
    targetUser = DEMO_MEMBERS.find(m => m.role === 'member') || DEMO_MEMBERS[1]
  }
  localStorage.setItem('labhub_user', JSON.stringify(targetUser))
  localStorage.setItem('labhub_token', 'demo_jwt_token_laborbit_experience')
  return targetUser
}
