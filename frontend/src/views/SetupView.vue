<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { systemApi } from '../api/client'
import { useSiteConfig } from '../composables/useSiteConfig'
import { useTutorial } from '../composables/useTutorial'
import AppIcon from '../components/AppIcon.vue'

const router = useRouter()
const { siteConfig, updateLocalConfig } = useSiteConfig()
const { closeTutorial } = useTutorial()

// 首次部署向导界面严禁显示新手教程
closeTutorial()
onMounted(() => {
  closeTutorial()
})

const currentStep = ref(1) // 1: 管理员账号, 2: 课题组品牌与配置
const submitting = ref(false)
const errorMessage = ref('')

const basePrefix = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
const formattedBase = basePrefix.endsWith('/') ? basePrefix : (basePrefix + '/')
const logoSrc = `${formattedBase}assets/LO_logo.svg`

const form = reactive({
  // Step 1: 管理员信息
  admin_name: '',
  admin_real_name: '',
  admin_email: '',
  admin_password: '',
  admin_password_confirm: '',
  // Step 2: 课题组与全站配置
  lab_name: '',
  lab_short_name: 'LabOrbit',
  site_slogan: '课题组内部科研协作与知识管理平台',
  site_title: 'LabOrbit',
  invite_code: 'LAB-2026',
  institution: '',
  default_location: '学院研讨室 / 腾讯会议',
})

function goToStep2() {
  errorMessage.value = ''
  if (!form.admin_name.trim()) {
    errorMessage.value = '请填写管理员姓名或昵称'
    return
  }
  if (!form.admin_email.trim() || !form.admin_email.includes('@')) {
    errorMessage.value = '请填写有效的管理员工作邮箱'
    return
  }
  if (!form.admin_password) {
    errorMessage.value = '请设定管理员登录密码'
    return
  }
  if (form.admin_password.length < 6) {
    errorMessage.value = '管理员密码长度不得少于 6 位'
    return
  }
  if (form.admin_password !== form.admin_password_confirm) {
    errorMessage.value = '两次输入的密码不一致，请核对'
    return
  }
  currentStep.value = 2
}

function backToStep1() {
  errorMessage.value = ''
  currentStep.value = 1
}

async function handleCompleteSetup() {
  errorMessage.value = ''
  if (!form.lab_name.trim()) {
    errorMessage.value = '请填写课题组/团队全称'
    return
  }
  if (!form.lab_short_name.trim()) {
    errorMessage.value = '请填写课题组英文缩写标识 (如 LabOrbit, AISYS, ASTRO)'
    return
  }
  if (!form.invite_code.trim()) {
    errorMessage.value = '请设定初始成员注册邀请码'
    return
  }

  submitting.value = true
  try {
    const payload = {
      admin_name: form.admin_name.trim(),
      admin_real_name: (form.admin_real_name || form.admin_name).trim(),
      admin_email: form.admin_email.trim().toLowerCase(),
      admin_password: form.admin_password,
      lab_name: form.lab_name.trim(),
      lab_short_name: form.lab_short_name.trim().toUpperCase(),
      site_slogan: form.site_slogan.trim(),
      site_title: form.site_title.trim() || 'LabOrbit',
      invite_code: form.invite_code.trim().toUpperCase(),
      institution: form.institution.trim(),
      default_location: form.default_location.trim(),
    }

    const res = await systemApi.setup(payload)
    if (res && res.access_token) {
      // 存储凭据
      localStorage.setItem('labhub_token', res.access_token)
      if (res.user) {
        localStorage.setItem('labhub_user', JSON.stringify(res.user))
      }
      siteConfig.initialized = true
      updateLocalConfig({
        lab_name: payload.lab_name,
        lab_short_name: payload.lab_short_name,
        site_slogan: payload.site_slogan,
        site_title: payload.site_title,
        institution: payload.institution,
        default_location: payload.default_location,
      })

      // 成功后直接前往首页，并触发新手交互式教程
      router.push('/')
    }
  } catch (err) {
    console.error('初始化失败:', err)
    errorMessage.value = err.message || err.detail || '初始化设置失败，请稍后重试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="setup-container">
    <div class="setup-card">
      <!-- 头部介绍 -->
      <div class="setup-header">
        <a
          href="https://github.com/Chocologism/lab-orbit"
          target="_blank"
          rel="noopener noreferrer"
          class="setup-logo-wrap"
          title="访问 GitHub 开源仓库 (LabOrbit)"
          aria-label="访问 GitHub 开源仓库 (LabOrbit)"
        >
          <img :src="logoSrc" alt="LabOrbit Logo" class="setup-logo-img" />
        </a>
        <div class="setup-badge">
          <AppIcon name="sparkles" class="badge-icon" />
          <span>首次部署向导</span>
        </div>
        <h1 class="setup-title">欢迎使用 LabOrbit</h1>
        <p class="setup-subtitle">
          检测到系统尚未初始化。仅需 2 步即可完成超级管理员配置与课题组平台定制。
        </p>
      </div>

      <!-- 步骤指示器 -->
      <div class="step-indicator">
        <div class="step-item" :class="{ active: currentStep === 1, completed: currentStep > 1 }">
          <div class="step-circle">1</div>
          <span class="step-text">超级管理员账号</span>
        </div>
        <div class="step-line" :class="{ active: currentStep > 1 }"></div>
        <div class="step-item" :class="{ active: currentStep === 2 }">
          <div class="step-circle">2</div>
          <span class="step-text">课题组品牌与配置</span>
        </div>
      </div>

      <!-- 错误警告条 -->
      <div v-if="errorMessage" class="error-banner">
        <AppIcon name="alert-circle" class="error-icon" />
        <span>{{ errorMessage }}</span>
      </div>

      <!-- 第一步表单：创建管理员 -->
      <form v-if="currentStep === 1" @submit.prevent="goToStep2" class="setup-form">
        <div class="form-row">
          <div class="form-group">
            <label>管理员姓名 / 昵称 <span class="required">*</span></label>
            <input 
              v-model="form.admin_name" 
              type="text" 
              class="input-field" 
              placeholder="如：张教授 / 李管理员" 
              required 
              autofocus
            />
          </div>
          <div class="form-group">
            <label>真实姓名 <span class="optional">(选填)</span></label>
            <input 
              v-model="form.admin_real_name" 
              type="text" 
              class="input-field" 
              placeholder="用于报告人实名匹配" 
            />
          </div>
        </div>

        <div class="form-group">
          <label>管理员工作邮箱 <span class="required">*</span></label>
          <input 
            v-model="form.admin_email" 
            type="email" 
            class="input-field" 
            placeholder="admin@your-university.edu.cn" 
            required 
          />
          <span class="field-hint">此邮箱将自动获得系统的超级管理员权限，具备成员授权与全站管控能力。</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>安全密码 <span class="required">*</span></label>
            <input 
              v-model="form.admin_password" 
              type="password" 
              class="input-field" 
              placeholder="不少于 6 位安全字符" 
              required 
            />
          </div>
          <div class="form-group">
            <label>确认密码 <span class="required">*</span></label>
            <input 
              v-model="form.admin_password_confirm" 
              type="password" 
              class="input-field" 
              placeholder="再次输入以确认" 
              required 
            />
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn btn-primary">
            <span>下一步：配置课题组信息</span>
            <AppIcon name="arrow-right" class="btn-icon" />
          </button>
        </div>
      </form>

      <!-- 第二步表单：配置课题组信息 -->
      <form v-else @submit.prevent="handleCompleteSetup" class="setup-form">
        <div class="form-row">
          <div class="form-group">
            <label>课题组 / 实验室全称 <span class="required">*</span></label>
            <input 
              v-model="form.lab_name" 
              type="text" 
              class="input-field" 
              placeholder="如：智能感知与计算科学研究组" 
              required 
              autofocus
            />
          </div>
          <div class="form-group">
            <label>缩写标识 / 短名称 <span class="required">*</span></label>
            <input 
              v-model="form.lab_short_name" 
              type="text" 
              class="input-field" 
              placeholder="如：LabOrbit / AISYS" 
              required 
            />
            <span class="field-hint">显示在导航栏 Brand 图标与移动端角标中。</span>
          </div>
        </div>

        <div class="form-group">
          <label>网站标语 Slogan</label>
          <input 
            v-model="form.site_slogan" 
            type="text" 
            class="input-field" 
            placeholder="课题组内部科研协作与知识管理平台" 
          />
        </div>

        <div class="form-group">
          <label>初始成员注册邀请码 <span class="required">*</span></label>
          <input 
            v-model="form.invite_code" 
            type="text" 
            class="input-field" 
            placeholder="如：LAB-2026" 
            required 
          />
          <span class="field-hint">全站实行私有化保护，组员必须凭此邀请码方可注册账号（后续管理员可随时生成更多邀请码）。</span>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>所属科研院所 / 高校 <span class="optional">(选填)</span></label>
            <input 
              v-model="form.institution" 
              type="text" 
              class="input-field" 
              placeholder="如：清华大学计算机系 / 前沿交叉科学研究院" 
            />
          </div>
          <div class="form-group">
            <label>默认组会研讨地点 <span class="optional">(选填)</span></label>
            <input 
              v-model="form.default_location" 
              type="text" 
              class="input-field" 
              placeholder="如：理科楼 302 / 腾讯会议" 
            />
          </div>
        </div>

        <div class="form-actions space-between">
          <button type="button" class="btn btn-secondary" @click="backToStep1" :disabled="submitting">
            <AppIcon name="arrow-left" class="btn-icon" />
            <span>返回上一步</span>
          </button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <span v-if="submitting">正在初始化平台...</span>
            <span v-else>完成配置，进入平台</span>
            <AppIcon v-if="!submitting" name="check" class="btn-icon" />
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.setup-container {
  position: relative;
  z-index: 10;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  box-sizing: border-box;
  background: transparent;
}

.setup-card {
  width: 100%;
  max-width: 620px;
  background: var(--panel);
  backdrop-filter: blur(28px) saturate(190%);
  -webkit-backdrop-filter: blur(28px) saturate(190%);
  border: 1px solid var(--line);
  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.65), 0 0 0 1px var(--raised, rgba(255, 255, 255, 0.05)) inset;
  border-radius: 24px;
  padding: 40px;
  box-sizing: border-box;
  animation: cardEnter 0.45s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes cardEnter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.setup-header {
  text-align: center;
  margin-bottom: 28px;
}

.setup-logo-wrap {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 25%, #ffffff) 0%, var(--accent) 100%);
  border: 2px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 0 28px color-mix(in srgb, var(--accent) 45%, transparent), 0 4px 14px rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  box-sizing: border-box;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.28s ease, border-color 0.28s ease;
}

.setup-logo-wrap:hover {
  transform: scale(1.08) rotate(5deg);
  box-shadow: 0 0 36px color-mix(in srgb, var(--accent) 65%, transparent), 0 6px 18px rgba(0, 0, 0, 0.55);
}

.setup-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 0 6px color-mix(in srgb, var(--accent) 50%, transparent));
}

.setup-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  color: var(--accent);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.badge-icon {
  width: 15px;
  height: 15px;
}

.setup-title {
  font-size: 26px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--text);
  letter-spacing: -0.02em;
}

.setup-subtitle {
  font-size: 14px;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

/* 步骤指示器 */
.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  gap: 12px;
}

.step-item {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.6;
  transition: all 0.2s ease;
}

.step-item.active {
  opacity: 1;
}

.step-item.completed {
  opacity: 0.95;
}

.step-circle {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--muted);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.25s ease;
}

.step-item.active .step-circle {
  background: var(--accent);
  color: var(--accent-ink, #081f28);
  border-color: var(--accent);
  box-shadow: 0 0 16px color-mix(in srgb, var(--accent) 45%, transparent);
}

.step-item.completed .step-circle {
  background: #10b981;
  color: #ffffff;
  border-color: #10b981;
}

.step-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.step-line {
  width: 48px;
  height: 2px;
  background: var(--line);
  transition: all 0.3s ease;
}

.step-line.active {
  background: #10b981;
}

/* 错误提示 */
.error-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 24px;
}

.error-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #ef4444;
}

/* 表单 */
.setup-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

@media (max-width: 580px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}

.required {
  color: #ef4444;
}

.optional {
  font-size: 12px;
  font-weight: 400;
  color: var(--muted);
}

.input-field {
  width: 100%;
  padding: 11px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  transition: all 0.2s ease;
}

.input-field::placeholder {
  color: var(--muted);
  opacity: 0.6;
}

.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.field-hint {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.4;
}

.form-actions {
  display: flex;
  align-items: center;
  margin-top: 12px;
}

.form-actions.space-between {
  justify-content: space-between;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  outline: none;
}

.btn-primary {
  background: var(--accent);
  color: var(--accent-ink, #081f28);
  width: 100%;
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent);
}

.form-actions.space-between .btn-primary {
  width: auto;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.08);
  box-shadow: 0 6px 20px color-mix(in srgb, var(--accent) 45%, transparent);
}

.btn-secondary {
  background: var(--surface);
  border: 1px solid var(--line);
  color: var(--text);
}

.btn-secondary:hover:not(:disabled) {
  background: color-mix(in srgb, var(--surface) 80%, #ffffff);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 16px;
  height: 16px;
}
</style>
