<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { authApi, accountApi, zoteroApi } from '../api/client'
import UserAvatar from '../components/UserAvatar.vue'
import { getMemberPresence, presenceNow } from '../composables/usePresence'
import LoadingState from '../components/LoadingState.vue'
import AppIcon from '../components/AppIcon.vue'
import BaseDialog from '../components/BaseDialog.vue'
import ThinHoundCheckbox from '../components/ThinHoundCheckbox.vue'
import ZoteroCollectionTree from '../components/ZoteroCollectionTree.vue'
import { notify } from '../composables/feedback'
import { useAdminMode, applyViewMode } from '../composables/useAdminMode'
import { useTutorial } from '../composables/useTutorial'

const user = ref(null), loading = ref(true), error = ref(''), busy = ref(false), members = ref([]), permissionBusy = ref(false)

const { currentMode: adminViewMode, isAdminMode, isUserMode, setAdminMode: saveAdminMode } = useAdminMode()
const { openTutorial } = useTutorial()

function handleLaunchTutorial() {
  const currentRole = user.value?.role || 'member'
  openTutorial({ role: currentRole, mandatory: false })
}

const isActualAdmin = computed(() => {
  return Boolean(user.value && (user.value.actual_role === 'admin' || user.value.role === 'admin' || user.value.is_admin_account))
})

const onlineCount = computed(() => {
  const _ = presenceNow.value
  if (!Array.isArray(members.value)) return 0
  return members.value.filter(m => getMemberPresence(m, presenceNow.value) === 'online').length
})

async function handleSwitchAdminMode(targetMode) {
  if (adminViewMode.value === targetMode) return
  saveAdminMode(targetMode)
  if (user.value) {
    user.value = applyViewMode({ ...user.value, role: 'admin' })
  }
  if (targetMode === 'admin') {
    if (members.value.length === 0) {
      try {
        const [mem, codes] = await Promise.all([authApi.getMembers(), authApi.getInviteCodes()])
        members.value = mem
        inviteCodes.value = codes
      } catch (e) {
        // ignore
      }
    }
    notify('已切换为管理模式')
  } else {
    notify('已切换为用户模式')
  }
}

const realName = ref(''), nickname = ref(''), email = ref(''), identity = ref('student'), currentPassword = ref(''), newPassword = ref(''), confirmPassword = ref('')
// 邀请码管理
const inviteCodes = ref([]), inviteCodeBusy = ref(false)
const newCode = ref(''), newNote = ref(''), newInviteRole = ref('student'), newInviteIdentity = ref('student')
function updated(data) { user.value = data; localStorage.setItem('labhub_user', JSON.stringify(data)); window.dispatchEvent(new Event('account-updated')) }
async function load() { error.value = ''; loading.value = true; try { const data = await authApi.getMe(); user.value = data; realName.value = data.real_name || data.name; nickname.value = data.nickname; email.value = data.email; identity.value = data.identity || 'student'; if (data.role === 'admin') { members.value = await authApi.getMembers(); inviteCodes.value = await authApi.getInviteCodes() } } catch(e) { error.value = e.message } finally { loading.value = false } }
const updatingSeminarMemberId = ref(null)

async function toggleSeminarPermission(member) {
  if (member.role === 'admin') {
    notify('系统管理员默认拥有全部组会管理权限，无需单独配置', 'info')
    return
  }
  if (updatingSeminarMemberId.value === member.id) return

  const prevVal = Boolean(member.can_manage_seminars)
  const targetVal = !prevVal
  // 乐观更新：立刻在当前微任务中切换状态，使 SVG 描边动画毫无卡顿、一气呵成
  member.can_manage_seminars = targetVal
  updatingSeminarMemberId.value = member.id

  try {
    const updatedMember = await authApi.setSeminarPermission(member.id, targetVal)
    member.can_manage_seminars = Boolean(updatedMember.can_manage_seminars)
    notify('组会管理权限已更新')
  } catch(e) {
    // 异常时回滚
    member.can_manage_seminars = prevVal
    notify(e.message || '更新权限失败', 'error')
  } finally {
    updatingSeminarMemberId.value = null
  }
}
async function toggleAdminRole(member) {
  const willBeAdmin = member.role !== 'admin'
  const memberDisplayName = member.real_name || member.name || member.nickname
  const actionText = willBeAdmin ? `将 ${memberDisplayName} 设为系统管理员` : `取消 ${memberDisplayName} 的管理员权限`
  if (!confirm(`确定要${actionText}吗？`)) return
  permissionBusy.value = true
  try {
    const updatedMember = await authApi.setMemberRole(member.id, willBeAdmin ? 'admin' : 'student')
    member.role = updatedMember.role
    member.can_manage_seminars = updatedMember.can_manage_seminars
    notify(`已更新 ${memberDisplayName} 的权限`)
  } catch(e) {
    notify(e.message || '更新权限失败', 'error')
  } finally {
    permissionBusy.value = false
  }
}
async function toggleMemberIdentity(member) {
  const memberDisplayName = member.real_name || member.name || member.nickname
  const newIdentity = member.identity === 'teacher' ? 'student' : 'teacher'
  permissionBusy.value = true
  try {
    const updatedMember = await authApi.setMemberIdentity(member.id, newIdentity)
    member.identity = updatedMember.identity
    notify(`已将 ${memberDisplayName} 的身份设为「${updatedMember.identity === 'teacher' ? '导师' : '学生'}」`)
  } catch(e) {
    notify(e.message || '更新身份失败', 'error')
  } finally {
    permissionBusy.value = false
  }
}
async function saveProfile() { busy.value = true; error.value = ''; try { updated(await accountApi.profile({ real_name: realName.value, nickname: nickname.value })); notify('资料已保存') } catch(e) { error.value = e.message } finally { busy.value = false } }
async function saveCredentials() {
  if (newPassword.value !== confirmPassword.value) { error.value = '两次输入的新密码不一致'; return }
  busy.value = true; error.value = ''
  try {
    const data = await accountApi.credentials({ current_password: currentPassword.value, ...(email.value.trim().toLowerCase() !== user.value.email ? {email: email.value} : {}), ...(newPassword.value ? {new_password: newPassword.value} : {}) })
    localStorage.setItem('labhub_token', data.access_token); localStorage.setItem('laborbit_token', data.access_token); updated(data.user)
    currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''; notify('账户已更新，其他登录会话已失效')
  } catch(e) { error.value = e.message } finally { busy.value = false }
}
function compressAvatar(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        if (file.size > 200 * 1024) return reject(new Error('头像文件大小不得超过 200 KB'))
        return resolve(file)
      }

      const minDim = Math.min(img.width, img.height)
      const sx = (img.width - minDim) / 2
      const sy = (img.height - minDim) / 2
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size)

      canvas.toBlob((blob) => {
        if (!blob) {
          if (file.size > 200 * 1024) return reject(new Error('头像文件大小不得超过 200 KB'))
          return resolve(file)
        }
        if (blob.size > 200 * 1024) {
          return reject(new Error('头像文件压缩后仍超过 200 KB，请选用较小图片'))
        }
        const compressedFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        resolve(compressedFile)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      if (file.size > 200 * 1024) return reject(new Error('头像文件大小不得超过 200 KB'))
      resolve(file)
    }
    img.src = url
  })
}

async function uploadAvatar(event) {
  const file = event.target.files?.[0]; if (!file) return
  busy.value = true; error.value = ''
  try {
    const processedFile = await compressAvatar(file)
    if (processedFile.size > 200 * 1024) throw new Error('头像文件大小不得超过 200 KB')
    updated(await accountApi.avatar(processedFile))
    notify('头像已更新')
  } catch(e) {
    error.value = e.message
    notify(e.message, 'error')
  } finally {
    busy.value = false
    event.target.value = ''
  }
}

// Zotero 文献库直连设置
const zoteroConfig = ref({
  configured: false,
  user_id: '',
  default_collection: '',
  has_api_key: false
})
const zoteroForm = reactive({
  user_id: '',
  api_key: '',
  default_collection: ''
})
const zoteroCollections = ref([])
const zoteroLoading = ref(false)
const zoteroSaving = ref(false)
const zoteroClearing = ref(false)
const zoteroError = ref('')

async function loadZoteroConfig() {
  zoteroLoading.value = true
  zoteroError.value = ''
  try {
    const data = await zoteroApi.getConfig()
    if (data) {
      zoteroConfig.value = data
      zoteroForm.user_id = data.user_id || ''
      zoteroForm.default_collection = data.default_collection || ''
      if (data.configured) {
        await loadZoteroCollections()
      }
    }
  } catch (err) {
    // 静默降级
  } finally {
    zoteroLoading.value = false
  }
}

async function loadZoteroCollections() {
  try {
    const collections = await zoteroApi.getCollections()
    zoteroCollections.value = Array.isArray(collections) ? collections : []
  } catch (err) {
    console.warn('获取 Zotero 目录失败:', err)
  }
}

async function handleSaveZotero() {
  if (!zoteroForm.user_id || !zoteroForm.user_id.trim()) {
    notify('请输入 Zotero User ID', 'warning')
    return
  }
  if (!zoteroConfig.value.has_api_key && (!zoteroForm.api_key || !zoteroForm.api_key.trim())) {
    notify('首次绑定请输入 Zotero API Key', 'warning')
    return
  }

  zoteroSaving.value = true
  zoteroError.value = ''
  try {
    const res = await zoteroApi.saveConfig({
      user_id: zoteroForm.user_id.trim(),
      api_key: zoteroForm.api_key ? zoteroForm.api_key.trim() : undefined,
      default_collection: zoteroForm.default_collection || ''
    })
    zoteroConfig.value = {
      configured: true,
      user_id: res.user_id,
      default_collection: res.default_collection,
      has_api_key: true
    }
    zoteroForm.api_key = ''
    notify('Zotero 直连配置验证成功并已保存')
    await loadZoteroCollections()
  } catch (err) {
    zoteroError.value = err.message || 'Zotero 凭证验证失败，请检查 User ID 与 API Key 权限'
    notify(zoteroError.value, 'error')
  } finally {
    zoteroSaving.value = false
  }
}

async function handleRefreshZoteroCollections() {
  if (!zoteroConfig.value.configured) return
  zoteroLoading.value = true
  try {
    await loadZoteroCollections()
    notify('已成功刷新 Zotero 文献分类目录')
  } catch (err) {
    notify(err.message || '刷新分类目录失败', 'error')
  } finally {
    zoteroLoading.value = false
  }
}

async function handleClearZotero() {
  if (!confirm('确定要清除已绑定的 Zotero API 配置吗？解绑后将恢复为本地 RIS 导出模式。')) return
  zoteroClearing.value = true
  try {
    await zoteroApi.clearConfig()
    zoteroConfig.value = {
      configured: false,
      user_id: '',
      default_collection: '',
      has_api_key: false
    }
    zoteroForm.user_id = ''
    zoteroForm.api_key = ''
    zoteroForm.default_collection = ''
    zoteroCollections.value = []
    notify('已成功解绑 Zotero 账户')
  } catch (err) {
    notify(err.message || '清除配置失败', 'error')
  } finally {
    zoteroClearing.value = false
  }
}

let memberPollTimer = null

onMounted(() => {
  load()
  loadZoteroConfig()

  memberPollTimer = setInterval(async () => {
    if (user.value?.role === 'admin' && typeof document !== 'undefined' && document.visibilityState === 'visible') {
      try {
        const mem = await authApi.getMembers()
        members.value = mem
      } catch (e) {
        // silent
      }
    }
  }, 30000)
})

onBeforeUnmount(() => {
  if (memberPollTimer) {
    clearInterval(memberPollTimer)
    memberPollTimer = null
  }
  if (showCustomThemeModal.value && !themeSnapshot.isSaved) {
    if (themeSnapshot.scheme === 'custom' && themeSnapshot.customScheme) {
      saveCustomColorScheme(themeSnapshot.customScheme)
    }
    applyThemeToDOM(themeSnapshot.scheme, currentBgType.value)
  }
})
async function createInviteCode() {
  const code = newCode.value.trim()
  if (!code) return
  inviteCodeBusy.value = true
  try {
    const created = await authApi.createInviteCode(code, newNote.value.trim(), newInviteRole.value, newInviteIdentity.value)
    inviteCodes.value.unshift(created)
    newCode.value = ''
    newNote.value = ''
    notify(`邀请码 ${created.code} 已创建`)
  } catch(e) {
    notify(e.message || '创建失败', 'error')
  } finally {
    inviteCodeBusy.value = false
  }
}
function inviteAssignmentLabel(invite) {
  const authority = invite.registration_role === 'admin' ? '管理员' : '普通用户'
  const academicIdentity = invite.registration_identity === 'teacher' ? '导师' : '学生'
  return `${authority} · ${academicIdentity}`
}
async function updateInviteAssignment(ic, changes) {
  inviteCodeBusy.value = true
  try {
    const updatedInvite = await authApi.updateInviteCode(
      ic.id,
      changes.registration_role || ic.registration_role,
      changes.registration_identity || ic.registration_identity,
    )
    Object.assign(ic, updatedInvite)
    notify(`邀请码 ${ic.code} 的注册身份已更新`)
  } catch(e) {
    notify(e.message || '更新失败', 'error')
  } finally {
    inviteCodeBusy.value = false
  }
}
async function toggleInviteCode(ic) {
  inviteCodeBusy.value = true
  try {
    const updated = await authApi.toggleInviteCode(ic.id)
    ic.is_active = updated.is_active
    notify(updated.is_active ? `邀请码 ${ic.code} 已启用` : `邀请码 ${ic.code} 已停用`)
  } catch(e) {
    notify(e.message || '操作失败', 'error')
  } finally {
    inviteCodeBusy.value = false
  }
}
async function deleteInviteCode(ic) {
  if (!confirm(`确定删除邀请码「${ic.code}」？此操作不可撤销。`)) return
  inviteCodeBusy.value = true
  try {
    await authApi.deleteInviteCode(ic.id)
    inviteCodes.value = inviteCodes.value.filter(c => c.id !== ic.id)
    notify(`邀请码 ${ic.code} 已删除`)
  } catch(e) {
    notify(e.message || '删除失败', 'error')
  } finally {
    inviteCodeBusy.value = false
  }
}
function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => notify(`已复制：${code}`)).catch(() => notify('复制失败', 'error'))
}

// 管理员手动创建成员账号
const showCreateMemberModal = ref(false)
const creatingMember = ref(false)
const createMemberForm = ref({
  name: '',
  nickname: '',
  email: '',
  password: '',
  identity: 'student',
  role: 'student',
  can_manage_seminars: false
})

function openCreateMemberModal() {
  createMemberForm.value = {
    name: '',
    nickname: '',
    email: '',
    password: '',
    identity: 'student',
    role: 'student',
    can_manage_seminars: false
  }
  showCreateMemberModal.value = true
}

async function handleCreateMember() {
  if (!createMemberForm.value.name.trim()) {
    notify('请填写真实姓名', 'error')
    return
  }
  if (!createMemberForm.value.email.trim() || !createMemberForm.value.email.includes('@')) {
    notify('请输入有效的邮箱地址', 'error')
    return
  }
  if (!createMemberForm.value.password || createMemberForm.value.password.length < 6) {
    notify('初始密码长度不得少于 6 位', 'error')
    return
  }

  creatingMember.value = true
  try {
    const newMember = await authApi.createMember({
      name: createMemberForm.value.name.trim(),
      nickname: createMemberForm.value.nickname.trim(),
      email: createMemberForm.value.email.trim().toLowerCase(),
      password: createMemberForm.value.password,
      identity: createMemberForm.value.identity,
      role: createMemberForm.value.role,
      can_manage_seminars: createMemberForm.value.role === 'admin' || createMemberForm.value.can_manage_seminars
    })
    members.value.push(newMember)
    showCreateMemberModal.value = false
    notify(`成员「${newMember.real_name || newMember.name}」已创建成功`)
  } catch (e) {
    notify(e.message || '创建成员失败', 'error')
  } finally {
    creatingMember.value = false
  }
}

async function deleteMember(member) {
  if (member.id === user.value.id) {
    notify('不能删除当前登录的管理员账号', 'error')
    return
  }
  const displayName = member.real_name || member.name || member.nickname || member.email
  if (!confirm(`确定彻底删除用户「${displayName}」(${member.email}) 吗？\n删除后该用户的账号凭证及个人配置将被清除，此操作不可撤销。`)) {
    return
  }
  permissionBusy.value = true
  try {
    await authApi.deleteMember(member.id)
    members.value = members.value.filter(m => m.id !== member.id)
    notify(`用户「${displayName}」已成功删除`)
  } catch (e) {
    notify(e.message || '删除用户失败', 'error')
  } finally {
    permissionBusy.value = false
  }
}

</script>
<style scoped>
.account-page {
  width: 100%;
  max-width: 900px;
  min-width: 0;
  box-sizing: border-box;
}

.account-section {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.member-section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.member-count-text {
  font-size: 12px;
}

.online-count-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 3px 9px;
  border-radius: 999px;
  font-weight: 500;
}

.presence-dot-inline {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: presence-breathe 2.4s ease-in-out infinite;
  display: inline-block;
  flex-shrink: 0;
}

.member-presence-wrap {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.member-avatar-chip {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--raised, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  user-select: none;
}

.presence-dot-corner {
  position: absolute;
  right: -1px;
  bottom: -1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 2px solid var(--surface);
  box-sizing: content-box;
  transition: background-color 0.3s ease, box-shadow 0.3s ease;
  pointer-events: none;
}

.presence-dot-corner.online {
  background-color: #10b981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: presence-breathe 2.4s ease-in-out infinite;
}

.presence-dot-corner.away {
  background-color: #f59e0b;
}

.presence-dot-corner.offline {
  background-color: #6b7280;
}

@keyframes presence-breathe {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}

.members-perm-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
  width: 100%;
  min-width: 0;
}

.member-perm-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
}

.member-name {
  font-weight: 600;
  font-size: 14px;
  color: var(--text);
  overflow-wrap: anywhere;
}

.member-email {
  font-size: 12px;
  color: var(--muted);
  overflow-wrap: anywhere;
  word-break: break-all;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
}

.perm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--soft);
  cursor: pointer;
  white-space: nowrap;
}

.perm-checkbox-label input {
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

.invite-code-list {
  display: grid;
  gap: 8px;
  margin-top: 14px;
  margin-bottom: 16px;
  width: 100%;
  min-width: 0;
}

.invite-code-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 8px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.invite-code-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
}

.invite-code-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.03em;
  overflow-wrap: anywhere;
}

.invite-code-note {
  font-size: 12px;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.invite-code-target {
  font-size: 12px;
  color: var(--accent);
  border-left: 1px solid var(--line);
  padding-left: 10px;
  overflow-wrap: anywhere;
}

.invite-code-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
  min-width: 0;
  max-width: 100%;
}

.invite-choice {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(70px, 1fr));
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--raised);
  max-width: 100%;
  box-sizing: border-box;
}

.invite-choice button {
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.4;
  white-space: nowrap;
  transition: background .18s ease, color .18s ease, transform .18s ease;
}

.invite-choice button:hover:not(:disabled) {
  background: rgba(208,231,232,.12);
  color: var(--text);
}

.invite-choice button:active:not(:disabled) {
  transform: scale(.98);
}

.invite-choice button.is-active {
  background: var(--surface);
  box-shadow: inset 0 0 0 1px rgba(208,231,232,.18);
  color: var(--text);
}

.invite-choice-new {
  flex: 1 1 160px;
  min-width: 0;
}

.invite-code-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
  width: 100%;
  min-width: 0;
}

.invite-code-inputs {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.invite-code-inputs input {
  min-width: 0;
}


.account-shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-top: 14px;
  width: 100%;
  min-width: 0;
}

.account-shortcut-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  text-decoration: none;
  color: var(--text);
  transition: all 0.22s ease;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.account-shortcut-card:hover {
  background: var(--raised);
  border-color: rgba(184, 155, 248, 0.35);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.shortcut-icon-box {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  font-size: 18px;
  flex-shrink: 0;
}

.shortcut-icon-box.cyan {
  background: rgba(184, 155, 248, 0.14);
  color: var(--accent);
  border: 1px solid rgba(184, 155, 248, 0.25);
}

.shortcut-icon-box.purple {
  background: rgba(184, 155, 248, 0.14);
  color: var(--accent);
  border: 1px solid rgba(184, 155, 248, 0.25);
}

.shortcut-icon-box.amber {
  background: rgba(243, 216, 162, 0.12);
  color: var(--warning);
  border: 1px solid rgba(243, 216, 162, 0.25);
}

.shortcut-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}

.shortcut-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  overflow-wrap: anywhere;
}

.shortcut-desc {
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.shortcut-arrow {
  color: var(--muted);
  font-size: 16px;
  transition: transform 0.2s ease, color 0.2s ease;
  flex-shrink: 0;
}

.account-shortcut-card:hover .shortcut-arrow {
  transform: translateX(3px);
  color: var(--accent);
}

/* 界面风格切换卡片 */
.theme-settings-section {
  margin-top: 20px;
  width: 100%;
  min-width: 0;
}

.theme-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  margin-top: 16px;
  width: 100%;
  min-width: 0;
}

.theme-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  position: relative;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

.theme-card:hover {
  transform: translateY(-2px);
  border-color: rgba(184, 155, 248, 0.35);
  box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.4), 0 0 16px -4px rgba(184, 155, 248, 0.15);
}

[data-theme-style="vanta-fog"] .theme-card:hover {
  border-color: rgba(197, 230, 223, 0.35);
  box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.4), 0 0 16px -4px rgba(197, 230, 223, 0.15);
}

.theme-card.is-active {
  border-color: var(--accent);
  background: linear-gradient(135deg, rgba(184, 155, 248, 0.08) 0%, rgba(20, 16, 35, 0.6) 100%);
  box-shadow: 0 8px 28px -6px rgba(0, 0, 0, 0.5), 0 0 20px -4px var(--accent-glow, rgba(184, 155, 248, 0.3));
}

[data-theme-style="vanta-fog"] .theme-card.is-active {
  background: linear-gradient(135deg, rgba(197, 230, 223, 0.08) 0%, rgba(13, 37, 44, 0.6) 100%);
}

.theme-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.theme-card-title-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1 1 160px;
}

.theme-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  overflow-wrap: anywhere;
  word-break: break-word;
}

.theme-subtitle {
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.theme-active-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
  flex-shrink: 0;
}

.active-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: var(--accent);
  box-shadow: 0 0 8px var(--accent);
  animation: pulse-dot 2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}

.theme-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 14px;
  border-top: 1px solid var(--line);
  margin-top: auto;
  flex-wrap: wrap;
  width: 100%;
  min-width: 0;
}

.theme-palette-preview {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.32);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.65), inset 0 2px 4px rgba(0, 0, 0, 0.5);
  display: inline-block;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s ease;
  flex-shrink: 0;
}

.color-dot:hover {
  transform: scale(1.18);
  border-color: rgba(255, 255, 255, 0.7);
}

.theme-card-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  margin: 0 0 14px 0;
  flex-grow: 1;
}

.bg-card-hint {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.custom-card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.custom-card-actions .button {
  padding: 6px 12px;
  font-size: 13px;
}

/* 自定义界面配色弹窗 */
.custom-theme-dialog-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.custom-subheading {
  font-size: 13px;
  font-weight: 600;
  color: var(--soft);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
}

.custom-templates-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 8px;
}

.custom-tpl-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  text-align: left;
}

.custom-tpl-btn:hover {
  border-color: var(--accent);
  background: var(--raised);
  transform: translateY(-1px);
}

.custom-tpl-btn.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 0 12px -2px var(--accent);
  background: var(--raised);
}

.custom-tpl-preview {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.custom-tpl-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.custom-tpl-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.custom-form-and-preview-grid {
  display: grid;
  grid-template-columns: 1.15fr 0.85fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 720px) {
  .custom-form-and-preview-grid {
    grid-template-columns: 1fr;
  }
}

.custom-config-col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.custom-input-label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--soft);
}

.custom-name-input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--text);
  font-size: 13px;
  box-sizing: border-box;
}

.custom-name-input:focus,
.hex-text-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--raised);
}

.color-picker-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.color-picker-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.color-picker-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.color-picker-desc {
  font-size: 11px;
  color: var(--muted);
  line-height: 1.4;
}

.color-input-combo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.native-color-picker {
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  width: 44px;
  height: 36px;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
}

.native-color-picker::-webkit-color-swatch-wrapper {
  padding: 2px;
}

.native-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 6px;
}

.hex-text-input {
  flex: 1;
  padding: 8px 12px;
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--text);
  box-sizing: border-box;
}

.custom-checkbox-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--soft);
  cursor: pointer;
  user-select: none;
  margin-top: 4px;
}

.custom-checkbox-row input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--accent);
  width: 16px;
  height: 16px;
}

.custom-preview-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.custom-live-preview-box {
  padding: 18px;
  border-radius: 12px;
  border: 1px solid;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.preview-mockup-panel {
  width: 100%;
  padding: 16px;
  border-radius: 10px;
  border: 1px solid;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.preview-mockup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.preview-mockup-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.preview-mockup-badge {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 100px;
  border: 1px solid;
}

.preview-mockup-desc {
  font-size: 12px;
  line-height: 1.5;
  margin: 0 0 14px 0;
}

.preview-mockup-elements {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.preview-mockup-btn-primary {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  cursor: default;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.preview-mockup-btn-secondary {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid;
  cursor: default;
}

.preview-mockup-subbox {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid;
}

.preview-subbox-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.custom-dialog-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
  margin-top: 8px;
  flex-wrap: wrap;
}

.dialog-action-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.bg-dim-control-card {
  margin-top: 20px;
  padding: 18px 22px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid var(--line);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bg-dim-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.bg-dim-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bg-dim-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-bright, #ffffff);
}

.bg-dim-value-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: rgba(var(--primary-rgb, 10, 194, 210), 0.15);
  border: 1px solid rgba(var(--primary-rgb, 10, 194, 210), 0.35);
  color: var(--primary, #0ac2d2);
  font-size: 12px;
  font-weight: 600;
}

.bg-dim-desc {
  font-size: 12px;
  margin: 0;
  line-height: 1.5;
}

.bg-dim-reset-btn {
  font-size: 12px;
  padding: 4px 10px;
  align-self: flex-start;
}

.bg-dim-slider-wrapper {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
}

.dim-tick-label {
  font-size: 12px;
  color: var(--text-muted, #94a3b8);
  white-space: nowrap;
  user-select: none;
}

/* curly-chipmunk-73 style custom range slider */
.bg-dim-slider {
  --base: var(--accent, var(--primary, #0ac2d2));
  --light: color-mix(in sRGB, var(--base) 65%, #fff);
  --lighter: color-mix(in sRGB, var(--base) 25%, #ffffff);
  --dark: color-mix(in sRGB, var(--base) 90%, #000);
  --transparent: color-mix(in sRGB, var(--base) 0%, transparent);

  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  font-size: 13px;
  flex: 1;
  width: 100%;
  height: 26px;
  padding: 0 !important;
  margin: 0 !important;
  border: 4px solid #ffffff;
  border-radius: 9999px;
  box-shadow:
    0 0 12px rgba(0, 0, 0, 0.4),
    0 2px 6px rgba(0, 0, 0, 0.25),
    inset 0 1px 2px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  overflow: hidden;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;

  /* Bulletproof filled track using CSS gradients driven by --val */
  background:
    /* Top horizontal glossy white reflection bar along the filled liquid */
    linear-gradient(var(--light), var(--light)) 14px 2px / calc(max(0%, var(--val) - 24px)) 2.5px no-repeat,
    /* Left specular light dot */
    radial-gradient(circle at 8px 5px, var(--light) 2px, transparent 2.5px) no-repeat,
    /* Filled liquid base color from 0% to --val, with bottom dark shade */
    linear-gradient(
      to bottom,
      var(--base) 0%,
      var(--base) 70%,
      var(--dark) 85%
    ) 0 0 / var(--val) 100% no-repeat,
    /* Unfilled portion from --val to 100% in pastel softer tone */
    linear-gradient(
      to bottom,
      var(--lighter) 0%,
      var(--lighter) 75%,
      color-mix(in sRGB, var(--lighter) 85%, #000) 100%
    );
}

.bg-dim-slider:hover,
.bg-dim-slider:focus-visible {
  border-color: #ffffff;
  box-shadow:
    0 0 16px rgba(0, 0, 0, 0.5),
    0 3px 8px rgba(0, 0, 0, 0.3),
    0 0 14px rgba(var(--primary-rgb, 10, 194, 210), 0.5);
}

/* WebKit Track: transparent so the styled input capsule background shines through */
.bg-dim-slider::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  height: 100%;
  background: transparent;
  border: none;
}

/* WebKit Thumb: 3D glossy bubble button */
.bg-dim-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 5px 4px, #ffffff 2px, transparent 2.5px),
    radial-gradient(circle at 6px 5px, var(--light) 3px, transparent 3.5px),
    linear-gradient(135deg, var(--light), var(--base));
  box-shadow:
    inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4),
    inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.8),
    0 1px 4px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  margin-top: 0px;
}

.bg-dim-slider::-webkit-slider-thumb:hover {
  transform: scale(1.12);
  box-shadow:
    inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4),
    inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.9),
    0 0 10px var(--light),
    0 2px 6px rgba(0, 0, 0, 0.6);
}

/* Firefox Track: transparent */
.bg-dim-slider::-moz-range-track {
  height: 100%;
  background: transparent;
  border: none;
}

/* Firefox Thumb: 3D glossy bubble button */
.bg-dim-slider::-moz-range-thumb {
  height: 18px;
  width: 18px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 5px 4px, #ffffff 2px, transparent 2.5px),
    radial-gradient(circle at 6px 5px, var(--light) 3px, transparent 3.5px),
    linear-gradient(135deg, var(--light), var(--base));
  box-shadow:
    inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4),
    inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.8),
    0 1px 4px rgba(0, 0, 0, 0.5);
  cursor: pointer;
  border: 1.5px solid rgba(255, 255, 255, 0.9);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.bg-dim-slider::-moz-range-thumb:hover {
  transform: scale(1.12);
  box-shadow:
    inset -1.5px -1.5px 3px rgba(0, 0, 0, 0.4),
    inset 1.5px 1.5px 3px rgba(255, 255, 255, 0.9),
    0 0 10px var(--light),
    0 2px 6px rgba(0, 0, 0, 0.6);
}

.local-bg-control-box {
  margin-top: 20px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.22);
  border: 1px dashed var(--line);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.local-bg-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.local-bg-icon {
  line-height: 1;
  margin-top: 2px;
  flex-shrink: 0;
}

/* chilly-sloth-36 vector floppy icon with hover animations */
.action_has {
  --sz: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(var(--sz) * 2.5);
  width: calc(var(--sz) * 2.5);
  padding: 0.4rem 0.5rem;
  border-radius: 8px;
  border: 1px solid var(--line, rgba(255, 255, 255, 0.16));
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-muted, #94a3b8);
  box-sizing: border-box;
  transition: border-color 0.25s ease, background 0.25s ease, color 0.25s ease, transform 0.2s ease;
}

.local-bg-header .local-bg-icon.action_has {
  --sz: 0.85rem;
  margin-top: 1px;
}

.local-bg-upload-zone .upload-icon.action_has {
  --sz: 1.15rem;
  margin-bottom: 2px;
}

.has_saved:hover,
.local-bg-header:hover .local-bg-icon.has_saved,
.local-bg-upload-zone:hover .upload-icon.has_saved {
  border-color: var(--accent, #b89bf8);
  color: var(--accent, #b89bf8);
  background: rgba(184, 155, 248, 0.08);
}

.has_saved:hover svg,
.local-bg-header:hover .local-bg-icon.has_saved svg,
.local-bg-upload-zone:hover .upload-icon.has_saved svg {
  color: var(--accent, #b89bf8);
}

.has_saved svg {
  overflow: visible;
  height: calc(var(--sz) * 1.5);
  width: calc(var(--sz) * 1.5);
  --ease: cubic-bezier(0.5, 0, 0.25, 1);
  --zoom-from: 1.5;
  --zoom-via: 0.85;
  --zoom-to: 1;
  --duration: 0.85s;
  transition: color 0.25s ease;
}

.has_saved:hover path[data-path="box"],
.local-bg-header:hover .local-bg-icon.has_saved path[data-path="box"],
.local-bg-upload-zone:hover .upload-icon.has_saved path[data-path="box"] {
  transition: all 0.3s var(--ease);
  animation: has-saved var(--duration) var(--ease) forwards;
  fill: rgba(184, 155, 248, 0.25);
}

.has_saved:hover path[data-path="line-top"],
.local-bg-header:hover .local-bg-icon.has_saved path[data-path="line-top"],
.local-bg-upload-zone:hover .upload-icon.has_saved path[data-path="line-top"] {
  animation: has-saved-line-top var(--duration) var(--ease) forwards;
}

.has_saved:hover path[data-path="line-bottom"],
.local-bg-header:hover .local-bg-icon.has_saved path[data-path="line-bottom"],
.local-bg-upload-zone:hover .upload-icon.has_saved path[data-path="line-bottom"] {
  animation: has-saved-line-bottom var(--duration) var(--ease) forwards,
    has-saved-line-bottom-2 calc(var(--duration) * 1) var(--ease)
      calc(var(--duration) * 0.75);
}

@keyframes has-saved-line-top {
  33.333% {
    transform: rotate(0deg) translate(1px, 2px) scale(var(--zoom-from));
    d: path("M 3 5 L 3 8 L 3 8");
  }
  66.666% {
    transform: rotate(20deg) translate(2px, -2px) scale(var(--zoom-via));
  }
  99.999% {
    transform: rotate(0deg) translate(0px, 0px) scale(var(--zoom-to));
  }
}

@keyframes has-saved-line-bottom {
  33.333% {
    transform: rotate(0deg) translate(1px, 2px) scale(var(--zoom-from));
    d: path("M 17 20 L 17 13 L 7 13 L 7 20");
  }
  66.666% {
    transform: rotate(20deg) translate(2px, -2px) scale(var(--zoom-via));
  }
  99.999% {
    transform: rotate(0deg) translate(0px, 0px) scale(var(--zoom-to));
  }
}

@keyframes has-saved-line-bottom-2 {
  from {
    d: path("M 17 21 L 17 21 L 7 21 L 7 21");
  }
  to {
    transform: rotate(0deg) translate(0px, 0px) scale(var(--zoom-to));
    d: path("M 17 20 L 17 13 L 7 13 L 7 20");
    fill: currentColor;
  }
}

@keyframes has-saved {
  33.333% {
    transform: rotate(0deg) translate(1px, 2px) scale(var(--zoom-from));
  }
  66.666% {
    transform: rotate(20deg) translate(2px, -2px) scale(var(--zoom-via));
  }
  99.999% {
    transform: rotate(0deg) translate(0px, 0px) scale(var(--zoom-to));
  }
}

.upload-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.local-bg-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.local-bg-title-wrap p {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.5;
}

.local-bg-status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  flex-wrap: wrap;
}

.local-bg-meta-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1 1 auto;
}

.local-bg-filename {
  font-size: 13px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
}

.local-bg-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.local-bg-upload-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 22px 16px;
  border: 1px dashed rgba(255, 255, 255, 0.25);
  border-radius: 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
}

.local-bg-upload-zone:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--accent);
  transform: translateY(-1px);
}

.upload-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}



.upload-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.upload-tip {
  font-size: 11px;
}

.select-theme-btn {
  font-size: 12px;
  padding: 5px 14px;
  white-space: nowrap;
}

.font-cards-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.font-section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.font-mode-segmented {
  display: inline-flex;
  padding: 3px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 9px;
  gap: 4px;
}

.font-mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  font-size: 12px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
}

.font-mode-pill:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.05);
}

.font-mode-pill.active {
  background: var(--raised, rgba(255, 255, 255, 0.12));
  color: var(--text);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

.preview-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.font-preview-stage {
  margin-top: 4px;
  padding: 16px 20px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.font-preview-stage.is-custom {
  border-color: rgba(184, 155, 248, 0.35);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}

[data-color-scheme="classic-cyan"] .font-preview-stage.is-custom {
  border-color: rgba(174, 222, 211, 0.35);
}

.font-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.font-preview-label {
  font-size: 11px;
  color: var(--muted);
  letter-spacing: 0.04em;
  font-weight: 500;
}

.font-preview-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.font-preview-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-tag {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.04em;
  font-weight: 500;
}

.font-preview-line-title {
  font-size: 19px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.35;
  font-family: var(--font);
}

.font-preview-line-en {
  font-size: 13.5px;
  color: var(--soft);
  line-height: 1.4;
  font-family: var(--font);
}

.font-preview-line-digits {
  font-size: 12px;
  color: var(--accent);
  margin-top: 1px;
  font-family: var(--font);
}

.split-font-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  margin-top: 14px;
}

.split-font-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px 18px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
  gap: 14px;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.split-font-card.has-file {
  border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
}

.split-font-card-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.slot-badge-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.active-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: #10b981;
  font-weight: 500;
}

.slot-fallback-hint {
  font-size: 11px;
}

.slot-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  word-break: break-all;
}

.slot-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
  margin: 0;
}

.slot-info-box {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--line);
}

.slot-file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.slot-action-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.slot-empty-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 22px 14px;
  border: 1px dashed var(--line);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.02);
  gap: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.slot-empty-box:hover {
  border-color: var(--accent);
  background: rgba(255, 255, 255, 0.04);
}

.sync-hint-btn {
  margin-top: 6px;
  font-size: 11px;
  padding: 4px 9px;
}

.font-section-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.create-member-grid-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
  width: 100%;
  min-width: 0;
}

/* 移动端全面自适应 */
@media (max-width: 768px) {
  .account-page {
    width: 100%;
    max-width: 100%;
  }

  .account-section {
    padding: 16px 14px !important;
  }

  .section-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .section-title-row > div {
    width: 100%;
    flex-wrap: wrap;
    justify-content: space-between;
  }

  :deep(.form-row),
  .form-row,
  .create-member-grid-row {
    grid-template-columns: 1fr !important;
    gap: 12px;
  }

  .member-perm-card {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 14px;
  }

  .member-info {
    width: 100%;
    justify-content: flex-start;
  }

  .member-actions {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }

  .member-actions button {
    flex-grow: 1;
  }

  .invite-code-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
  }

  .invite-code-info {
    width: 100%;
  }

  .invite-code-actions {
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }

  .invite-choice {
    width: 100%;
  }

  .invite-choice-new {
    min-width: 0;
    width: 100%;
  }

  .invite-code-inputs {
    flex-direction: column;
  }

  .invite-code-inputs input {
    width: 100%;
  }

  .theme-cards-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .theme-card {
    padding: 14px 14px;
  }

  .theme-card-footer {
    justify-content: space-between;
  }

  .select-theme-btn {
    flex-grow: 1;
    text-align: center;
  }

  .custom-card-actions {
    flex-grow: 1;
    justify-content: flex-end;
  }

  .custom-card-actions .button {
    flex-grow: 1;
    text-align: center;
  }

  .custom-dialog-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .custom-dialog-actions .dialog-action-right {
    width: 100%;
  }

  .custom-dialog-actions .dialog-action-right .button {
    flex: 1;
  }

  .account-shortcuts-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .account-shortcut-card {
    padding: 12px 14px;
  }

  :deep(.avatar-editor),
  .avatar-editor {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }

  .account-page > * {
    min-width: 0;
    max-width: 100%;
  }

  .form-actions button {
    width: 100%;
  }
}

/* ==========================================================================
   水波云雾风格还原 (Vanta Fog / Clouds Static)
   ========================================================================== */
[data-theme-style="vanta-fog"] .account-shortcut-card:hover {
  border-color: rgba(197, 230, 223, 0.35) !important;
}
[data-theme-style="vanta-fog"] .shortcut-icon-box.cyan {
  background: rgba(174, 222, 211, 0.12) !important;
  border: 1px solid rgba(174, 222, 211, 0.25) !important;
  color: var(--accent, #c5e6df) !important;
}

.admin-mode-status-banner {
  margin-top: 14px;
  padding: 10px 14px;
  border-radius: 8px;
  background: rgba(243, 216, 162, 0.1);
  border: 1px solid rgba(243, 216, 162, 0.25);
  color: var(--warning, #e6b85c);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 10px;
  line-height: 1.5;
}

.account-nav-anchors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.anchor-pill {
  min-height: 28px;
  padding: 3px 12px;
  font-size: 12px;
  border-radius: 999px;
  text-decoration: none;
  color: var(--soft);
}

.anchor-pill:hover {
  color: var(--text);
  border-color: var(--accent);
}

.anchor-pill.highlight-glass {
  border-color: rgba(184, 155, 248, 0.4);
  color: var(--accent);
  background: var(--glass);
}

.zotero-account-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.zotero-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--muted);
}

.zotero-status-badge.is-connected {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
  color: #4ade80;
}

.zotero-form-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field-hint {
  display: block;
  font-size: 12px;
  color: var(--muted);
  margin-top: 4px;
  line-height: 1.4;
}

.field-hint a {
  color: var(--accent);
  text-decoration: underline;
}

.full-width-field {
  width: 100%;
}

.zotero-form-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.danger-text {
  color: #f87171 !important;
}

.danger-text:hover {
  border-color: #ef4444 !important;
}
</style>
<template><div class="personal-page account-page"><header class="page-heading"><div><p class="eyebrow">YOUR ACCOUNT</p><h1>账户设置</h1></div><div class="account-nav-anchors"><a href="#section-profile" class="button secondary small anchor-pill">个人资料</a><a href="#section-security" class="button secondary small anchor-pill">邮箱密码</a><a href="#section-zotero" class="button secondary small anchor-pill">Zotero 直连</a><router-link to="/style" class="button secondary small anchor-pill highlight-glass">个性风格 →</router-link></div></header><LoadingState v-if="loading" /><p v-if="error" class="error-banner" role="alert">{{ error }} <button v-if="!user" class="button secondary" @click="load">重试</button></p><template v-if="user && !loading">
<section class="panel account-section"><h2>头像设置</h2><div class="avatar-editor"><div class="account-avatar"><UserAvatar :user="user" /></div><label class="button secondary avatar-upload">上传头像<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="上传头像" :disabled="busy" @change="uploadAvatar" /></label><span class="muted">支持 PNG、JPEG 或 WebP，限制在 200 KB 以内（上传大图将自动压缩裁切）。</span></div></section>
<form id="section-profile" class="panel account-section form-grid" @submit.prevent="saveProfile"><h2>个人资料</h2><div class="form-row"><label>姓名<input v-model="realName" maxlength="100" required autocomplete="name" /></label><label>昵称<input v-model="nickname" maxlength="50" placeholder="可选，用于页面显示" /></label><label>组内身份<input :value="identity === 'teacher' ? '导师 / PI' : '学生 / 组员'" disabled aria-label="组内身份由管理员设置" /></label></div><div class="form-actions"><button class="button primary" :disabled="busy">保存资料</button></div></form>
<form id="section-security" class="panel account-section form-grid" @submit.prevent="saveCredentials"><h2>邮箱与密码</h2><label>登录邮箱<input v-model="email" type="email" required autocomplete="email" maxlength="100" /></label><label>当前密码<input v-model="currentPassword" type="password" required autocomplete="current-password" /></label><div class="form-row"><label>新密码<input v-model="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="不修改密码时留空" /></label><label>确认新密码<input v-model="confirmPassword" type="password" :required="!!newPassword" autocomplete="new-password" /></label></div><p class="muted">新密码至少 8 个字符。修改邮箱或密码需要验证当前密码。</p><div class="form-actions"><button class="button primary" :disabled="busy">保存账户设置</button></div></form>
<section id="section-zotero" class="panel account-section zotero-account-section">
  <div class="section-title-row">
    <div>
      <h2>Zotero 文献库直连设置</h2>
      <p class="muted">
        绑定个人 Zotero Web API 凭证后，可直接在「文献推荐流」中一键将论文（包含元数据、官方 arXiv PDF 附件、推荐理由及精校中文翻译笔记）直推入您的 Zotero 云端文献库与分类目录。
      </p>
    </div>
    <div class="zotero-status-badge" :class="{ 'is-connected': zoteroConfig.configured }">
      <AppIcon :name="zoteroConfig.configured ? 'check' : 'database'" :size="14" />
      <span>{{ zoteroConfig.configured ? '已连接云端文献库' : '未连接 (本地 RIS 模式)' }}</span>
    </div>
  </div>

  <form class="form-grid zotero-form-grid" @submit.prevent="handleSaveZotero">
    <div class="form-row">
      <label>
        <span class="label-text">Zotero User ID (用户 ID)</span>
        <input
          v-model="zoteroForm.user_id"
          type="text"
          required
          autocomplete="off"
          placeholder="例如: 11280390"
        />
        <span class="field-hint">
          前往 <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noopener">Zotero Feeds/API 密钥管理页</a> 顶部可查看您的 User ID。
        </span>
      </label>

      <label>
        <span class="label-text">Zotero API Key (密钥)</span>
        <input
          v-model="zoteroForm.api_key"
          type="password"
          autocomplete="new-password"
          :placeholder="zoteroConfig.has_api_key ? '已保存密钥（留空保持不变）' : '粘贴您的 Personal API Key'"
        />
        <span class="field-hint">
          需勾选“Allow library access”并允许读取和修改个人文献库。
        </span>
      </label>
    </div>

    <div class="form-row">
      <div class="full-width-field">
        <ZoteroCollectionTree
          v-model="zoteroForm.default_collection"
          :collections="zoteroCollections"
          label="默认推送分类集合"
          :initially-expanded="false"
        />
        <span class="field-hint">
          推送到 Zotero 时默认预选的文献分类文件夹。在文献卡片推送弹窗中仍可随时临时切换。
        </span>
      </div>
    </div>

    <p v-if="zoteroError" class="inline-error" role="alert">{{ zoteroError }}</p>

    <div class="form-actions zotero-form-actions">
      <button
        type="submit"
        class="button primary"
        :disabled="zoteroSaving || zoteroLoading || !zoteroForm.user_id"
      >
        {{ zoteroSaving ? '验证并保存中…' : (zoteroConfig.configured ? '保存并更新配置' : '验证连接并保存') }}
      </button>

      <button
        v-if="zoteroConfig.configured"
        type="button"
        class="button secondary"
        :disabled="zoteroLoading"
        @click="handleRefreshZoteroCollections"
      >
        <AppIcon name="refresh" :size="14" />
        <span>刷新分类目录</span>
      </button>

      <button
        v-if="zoteroConfig.configured"
        type="button"
        class="button secondary danger-text"
        :disabled="zoteroClearing"
        @click="handleClearZotero"
      >
        {{ zoteroClearing ? '正在解除…' : '解除绑定' }}
      </button>
    </div>
  </form>
</section>
<section class="panel account-section">
  <div class="section-title-row">
    <h2>常用快捷入口</h2>
    <span class="muted" style="font-size:12px;">快速前往文献收藏、个性风格与反馈中心</span>
  </div>
  <div class="account-shortcuts-grid">
    <router-link to="/favorites" class="account-shortcut-card">
      <div class="shortcut-icon-box cyan"><AppIcon name="star" :size="18" /></div>
      <div class="shortcut-info">
        <strong class="shortcut-title">我的收藏</strong>
        <span class="shortcut-desc muted">查看与检索个人星标收藏的学术论文与文献</span>
      </div>
      <span class="shortcut-arrow">→</span>
    </router-link>
    <router-link to="/style" class="account-shortcut-card">
      <div class="shortcut-icon-box purple"><AppIcon name="style" :size="18" /></div>
      <div class="shortcut-info">
        <strong class="shortcut-title">个性风格</strong>
        <span class="shortcut-desc muted">定制系统界面配色、卡片玻璃质感、背景动效与专属字体方案</span>
      </div>
      <span class="shortcut-arrow">→</span>
    </router-link>
    <router-link :to="user.role === 'admin' ? '/admin/feedback' : '/feedback'" class="account-shortcut-card">
      <div class="shortcut-icon-box amber"><AppIcon name="mail" :size="18" /></div>
      <div class="shortcut-info">
        <strong class="shortcut-title">{{ user.role === 'admin' ? '反馈管理' : '问题与意见反馈' }}</strong>
        <span class="shortcut-desc muted">{{ user.role === 'admin' ? '查看并处理组员提交的系统使用反馈' : '向团组提交系统使用建议或遇到功能问题' }}</span>
      </div>
      <span class="shortcut-arrow">→</span>
    </router-link>
    <button type="button" class="account-shortcut-card" style="text-align: left; background: none; border: none; font: inherit; cursor: pointer;" @click="handleLaunchTutorial">
      <div class="shortcut-icon-box emerald"><AppIcon name="layout" :size="18" /></div>
      <div class="shortcut-info">
        <strong class="shortcut-title">功能向导</strong>
        <span class="shortcut-desc muted">重新启动课题组协作平台全站功能指引（按当前身份定制）</span>
      </div>
      <span class="shortcut-arrow">→</span>
    </button>
  </div>
</section>

<section v-if="isActualAdmin" class="panel account-section theme-settings-section">
  <div class="section-title-row">
    <div>
      <h2>管理员视角模式</h2>
    </div>
    <div class="font-mode-segmented" role="tablist" aria-label="管理员视角模式选择">
      <button
        type="button"
        class="font-mode-pill"
        :class="{ active: adminViewMode === 'admin' }"
        role="tab"
        :aria-selected="adminViewMode === 'admin'"
        @click="handleSwitchAdminMode('admin')"
      >
        <AppIcon name="cpu" :size="13" />
        <span>管理模式</span>
      </button>
      <button
        type="button"
        class="font-mode-pill"
        :class="{ active: adminViewMode === 'user' }"
        role="tab"
        :aria-selected="adminViewMode === 'user'"
        @click="handleSwitchAdminMode('user')"
      >
        <AppIcon name="user" :size="13" />
        <span>用户模式</span>
      </button>
    </div>
  </div>
</section>
</template><section v-if="user?.role === 'admin'" class="panel account-section">
  <div class="section-title-row">
    <div class="member-section-heading">
      <h2>成员权限与身份设置</h2>
      <span class="muted member-count-text">（共 {{ members.length }} 位组员）</span>
      <span class="badge success online-count-badge">
        <span class="presence-dot-inline"></span>
        当前在线 {{ onlineCount }} / {{ members.length }} 人
      </span>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <span class="badge cyan">管理员功能</span>
      <button type="button" class="button small primary" @click="openCreateMemberModal">
        <AppIcon name="plus" :size="15" />添加成员
      </button>
    </div>
  </div>
  <div class="members-perm-list">
    <div v-for="member in members" :key="member.id" class="member-perm-card">
      <div class="member-info">
        <div class="member-presence-wrap">
          <div class="member-avatar-chip">
            <UserAvatar :user="member" />
          </div>
          <span :class="['presence-dot-corner', getMemberPresence(member)]"></span>
        </div>
        <span class="member-name" :title="member.nickname && member.nickname !== (member.real_name || member.name) ? '昵称: ' + member.nickname : undefined">{{ member.real_name || member.name || member.nickname }}</span>
        <span class="member-email mono">{{ member.email }}</span>
        <span :class="['badge', member.identity === 'teacher' ? 'amber' : '']">
          {{ member.identity === 'teacher' ? '导师' : '学生' }}
        </span>
        <span v-if="member.role === 'admin'" class="badge cyan">系统管理员</span>
      </div>
      <div class="member-actions">
        <button
          type="button"
          class="button small ghost"
          :disabled="permissionBusy"
          :title="member.identity === 'teacher' ? '切换为学生身份' : '切换为导师身份'"
          @click="toggleMemberIdentity(member)"
        >
          {{ member.identity === 'teacher' ? '设为学生' : '设为导师' }}
        </button>
        <button 
          type="button" 
          :class="['button small', member.role === 'admin' ? 'secondary' : 'ghost']"
          :disabled="permissionBusy || (member.id === user.id && members.filter(m => m.role === 'admin').length <= 1)"
          :title="member.role === 'admin' ? '取消管理员权限' : '提升为管理员'"
          @click="toggleAdminRole(member)"
        >
          {{ member.role === 'admin' ? '取消管理员' : '设为管理员' }}
        </button>
        <ThinHoundCheckbox
          :checked="member.role === 'admin' || member.can_manage_seminars"
          :disabled="member.role === 'admin'"
          :title="member.role === 'admin' ? '管理员默认拥有组会管理权限' : '允许新增和修改组会日程'"
          label-position="before"
          :size="26"
          @change="toggleSeminarPermission(member)"
        >
          组会管理
        </ThinHoundCheckbox>
        <button
          type="button"
          class="button small ghost danger"
          :disabled="permissionBusy || member.id === user.id"
          :title="member.id === user.id ? '不能删除自己的账号' : '删除该成员账号'"
          @click="deleteMember(member)"
        >
          <AppIcon name="trash" :size="14" />删除
        </button>
      </div>
    </div>
  </div>
</section>

<!-- 邀请码管理 -->
<section v-if="user?.role === 'admin'" class="panel account-section">
  <div class="section-title-row">
    <h2>注册邀请码管理</h2>
    <span class="badge cyan">管理员功能</span>
  </div>

  <!-- 现有邀请码列表 -->
  <div class="invite-code-list">
    <div v-if="inviteCodes.length === 0" class="muted" style="padding: 12px 0;">暂无邀请码，请在下方创建。</div>
    <div v-for="ic in inviteCodes" :key="ic.id" class="invite-code-row">
      <div class="invite-code-info">
        <span class="invite-code-value mono">{{ ic.code }}</span>
        <span v-if="ic.note" class="invite-code-note muted">{{ ic.note }}</span>
        <span class="invite-code-target">{{ inviteAssignmentLabel(ic) }}</span>
        <span :class="['badge', ic.is_active ? 'green' : '']" style="font-size:11px;">{{ ic.is_active ? '激活' : '已停用' }}</span>
      </div>
      <div class="invite-code-actions">
        <div class="invite-choice" role="group" :aria-label="`${ic.code} 的权限类型`">
          <button type="button" :class="{ 'is-active': ic.registration_role === 'student' }" :aria-pressed="ic.registration_role === 'student'" :disabled="inviteCodeBusy" @click="updateInviteAssignment(ic, { registration_role: 'student' })">普通用户</button>
          <button type="button" :class="{ 'is-active': ic.registration_role === 'admin' }" :aria-pressed="ic.registration_role === 'admin'" :disabled="inviteCodeBusy" @click="updateInviteAssignment(ic, { registration_role: 'admin' })">管理员</button>
        </div>
        <div class="invite-choice" role="group" :aria-label="`${ic.code} 的学术身份`">
          <button type="button" :class="{ 'is-active': ic.registration_identity === 'student' }" :aria-pressed="ic.registration_identity === 'student'" :disabled="inviteCodeBusy" @click="updateInviteAssignment(ic, { registration_identity: 'student' })">学生</button>
          <button type="button" :class="{ 'is-active': ic.registration_identity === 'teacher' }" :aria-pressed="ic.registration_identity === 'teacher'" :disabled="inviteCodeBusy" @click="updateInviteAssignment(ic, { registration_identity: 'teacher' })">导师</button>
        </div>
        <button type="button" class="button small ghost" title="复制邀请码" @click="copyCode(ic.code)">复制</button>
        <button
          type="button"
          :class="['button small', ic.is_active ? 'secondary' : 'ghost']"
          :disabled="inviteCodeBusy"
          @click="toggleInviteCode(ic)"
        >{{ ic.is_active ? '停用' : '启用' }}</button>
        <button
          type="button"
          class="button small ghost danger"
          :disabled="inviteCodeBusy"
          @click="deleteInviteCode(ic)"
        >删除</button>
      </div>
    </div>
  </div>

  <!-- 创建新邀请码 -->
  <form class="invite-code-form" @submit.prevent="createInviteCode">
    <div class="invite-code-inputs">
      <input v-model="newCode" placeholder="邀请码（如 LAB-2026）" maxlength="100" required style="flex:1;" />
      <input v-model="newNote" placeholder="备注（可选）" maxlength="200" style="flex:1;" />
      <div class="invite-choice invite-choice-new" role="group" aria-label="新邀请码的权限类型">
        <button type="button" :class="{ 'is-active': newInviteRole === 'student' }" :aria-pressed="newInviteRole === 'student'" @click="newInviteRole = 'student'">普通用户</button>
        <button type="button" :class="{ 'is-active': newInviteRole === 'admin' }" :aria-pressed="newInviteRole === 'admin'" @click="newInviteRole = 'admin'">管理员</button>
      </div>
      <div class="invite-choice invite-choice-new" role="group" aria-label="新邀请码的学术身份">
        <button type="button" :class="{ 'is-active': newInviteIdentity === 'student' }" :aria-pressed="newInviteIdentity === 'student'" @click="newInviteIdentity = 'student'">学生</button>
        <button type="button" :class="{ 'is-active': newInviteIdentity === 'teacher' }" :aria-pressed="newInviteIdentity === 'teacher'" @click="newInviteIdentity = 'teacher'">导师</button>
      </div>
    </div>
    <button class="button primary small" :disabled="inviteCodeBusy || !newCode.trim()">创建邀请码</button>
  </form>
</section>

<!-- 管理员手动创建成员弹窗 -->
<BaseDialog
  :open="showCreateMemberModal"
  title="手动创建组内成员账号"
  :busy="creatingMember"
  @close="showCreateMemberModal = false"
>
  <form class="create-member-modal-form" @submit.prevent="handleCreateMember">
    <p class="muted" style="font-size: 13px; margin-bottom: 16px; line-height: 1.6;">
      管理员可直接录入组内成员账号与初始密码。创建完成后，成员即可凭此邮箱与密码直接登录系统，无需额外注册邀请码。
    </p>

    <div class="form-row create-member-grid-row">
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>真实姓名 <strong style="color: var(--danger)">*</strong></span>
        <input v-model="createMemberForm.name" required placeholder="如 张三（用于组会主讲人辨认）" maxlength="100" />
      </label>
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>昵称（选填）</span>
        <input v-model="createMemberForm.nickname" placeholder="组内称呼或常用简称" maxlength="50" />
      </label>
    </div>

    <div class="form-row create-member-grid-row">
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>登录邮箱 <strong style="color: var(--danger)">*</strong></span>
        <input v-model="createMemberForm.email" type="email" required placeholder="如 name@example.edu" maxlength="100" />
      </label>
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>初始登录密码 <strong style="color: var(--danger)">*</strong></span>
        <input v-model="createMemberForm.password" type="password" required minlength="6" placeholder="至少 6 位密码" autocomplete="new-password" />
      </label>
    </div>

    <div class="form-row create-member-grid-row">
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>组内学术身份</span>
        <select v-model="createMemberForm.identity">
          <option value="student">学生 / 普通组员</option>
          <option value="teacher">导师 / PI</option>
        </select>
      </label>
      <label style="display: flex; flex-direction: column; gap: 6px; font-size: 13px;">
        <span>权限角色</span>
        <select v-model="createMemberForm.role">
          <option value="student">普通用户</option>
          <option value="admin">系统管理员</option>
        </select>
      </label>
    </div>

    <div v-if="createMemberForm.role !== 'admin'" style="margin-top: 6px; margin-bottom: 18px;">
      <ThinHoundCheckbox
        v-model="createMemberForm.can_manage_seminars"
        label-position="after"
        :size="26"
      >
        授权管理组会排期（允许创建和修改组会日程）
      </ThinHoundCheckbox>
    </div>

    <div class="form-actions" style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px;">
      <button type="button" class="button secondary" :disabled="creatingMember" @click="showCreateMemberModal = false">
        取消
      </button>
      <button type="submit" class="button primary" :disabled="creatingMember">
        {{ creatingMember ? '正在创建…' : '立即创建成员' }}
      </button>
    </div>
  </form>
</BaseDialog>
</div></template>
