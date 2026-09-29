/**
 * 用户作用域解析工具 (用于浏览器端 localStorage 按用户进行沙箱隔离)
 * 纯前端隔离：保持 100% 客户端本地持久化与大模型直连，不向服务器上传任何会话隐私。
 */

/**
 * 解析当前用户存储作用域标识（用于本地 localStorage 按用户隔离）
 * 优先级：
 * 1. 显式传入的 userOrScope（字符串、数字或含 id/username/email 的对象）
 * 2. 当前浏览器中持久化的登录用户（cssbd_user / labhub_user）
 * 3. 若均不存在，返回 ''（空字符串，用于表示未登录/公共/默认环境，可向下兼容旧版全局键）
 *
 * @param {string|number|object|null|undefined} [userOrScope]
 * @returns {string} 干净的用户作用域字符串，如 '42'、'alice' 或 ''
 */
export function resolveUserScope(userOrScope) {
  if (userOrScope !== null && userOrScope !== undefined) {
    if (typeof userOrScope === 'string' || typeof userOrScope === 'number') {
      const trimmed = String(userOrScope).trim()
      if (trimmed) return trimmed
    } else if (typeof userOrScope === 'object') {
      const candidate = userOrScope.id ?? userOrScope.username ?? userOrScope.email
      if (candidate !== null && candidate !== undefined) {
        const trimmed = String(candidate).trim()
        if (trimmed) return trimmed
      }
    }
  }

  // 尝试从浏览器 localStorage 获取当前已登录用户
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('cssbd_user') || localStorage.getItem('labhub_user')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          const candidate = parsed.id ?? parsed.username ?? parsed.email
          if (candidate !== null && candidate !== undefined) {
            const trimmed = String(candidate).trim()
            if (trimmed) return trimmed
          }
        }
      }
    } catch (_) {}
  }

  return ''
}
