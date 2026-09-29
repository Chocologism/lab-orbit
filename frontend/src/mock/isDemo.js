import { DEMO_MEMBERS } from './demoData'

export function isDemoMode() {
  // 1. 构建环境变量指定
  if (import.meta.env?.VITE_DEMO_MODE === 'true') return true

  const storage = typeof localStorage !== 'undefined' ? localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null)

  // 2. URL Query 显式控制（具有最高覆盖优先级）
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search)
      const demoParam = params.get('demo')
      if (demoParam === '1' || demoParam === 'true') {
        storage?.setItem('labhub_force_demo', '1')
        return true
      }
      if (demoParam === '0' || demoParam === 'false') {
        storage?.removeItem('labhub_force_demo')
        if (storage?.getItem('labhub_token')?.startsWith('demo_')) {
          storage?.removeItem('labhub_token')
          storage?.removeItem('labhub_user')
        }
        return false
      }
    } catch {}
  }

  // 3. 本地持久化开关 (一旦激活，全站跳转保持沙盒模式)
  if (storage?.getItem('labhub_force_demo') === '1') return true

  // 4. 当前登录身份为演示 Token (防御路由丢失 query 导致会话中断)
  if (storage?.getItem('labhub_token')?.startsWith('demo_')) return true

  if (typeof window === 'undefined') return false

  // 5. 位于 GitHub Pages 域名
  const host = window.location.hostname || ''
  if (host.endsWith('github.io') || host.includes('github.io')) return true

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
