<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import BaseDialog from '../components/BaseDialog.vue'
import ThinHoundCheckbox from '../components/ThinHoundCheckbox.vue'
import { notify } from '../composables/feedback'
import { useThemeStyle } from '../composables/useThemeStyle'
import { useCustomFont } from '../composables/useCustomFont'
import { useHomeGridEngine } from '../composables/useHomeGridEngine'
import {
  saveLocalBackground,
  getLocalBackgroundMeta,
  removeLocalBackground
} from '../utils/localBgStorage'
import {
  saveLocalFont,
  getLocalFontMeta,
  removeLocalFont,
  removeAllLocalFonts,
  copyLocalFont,
  getFontMode,
  setFontMode
} from '../utils/localFontStorage'

const {
  currentColorScheme,
  currentBgType,
  isBgVideoPaused,
  setBgVideoPaused,
  toggleBgVideoPaused,
  colorSchemes,
  bgOptions,
  glassOptions,
  currentGlassStyle,
  setGlassStyle,
  customColorScheme,
  customPresetTemplates,
  setColorScheme,
  setBgType,
  currentBgDim,
  setBgDim,
  DEFAULT_BG_DIM,
  saveCustomColorScheme,
  deriveThemePalette,
  applyPreviewPaletteToDOM,
  applyThemeToDOM
} = useThemeStyle()

function handleToggleBgVideoPaused() {
  const nextVal = !isBgVideoPaused.value
  setBgVideoPaused(nextVal)
  notify(nextVal ? '已暂停视频背景并作为超清静态壁纸使用' : '已恢复动态视频背景播放')
}

function onBgDimInput(e) {
  const val = parseInt(e.target.value, 10)
  setBgDim(val)
}

function resetBgDim() {
  setBgDim(DEFAULT_BG_DIM)
  notify(`已恢复背景暗化程度为默认值（${DEFAULT_BG_DIM}%）`)
}

function handleColorSchemeSelect(scheme) {
  if (currentColorScheme.value === scheme.id) return
  setColorScheme(scheme.id)
  notify(`已切换为「${scheme.name}」配色`)
}

function handleGlassStyleSelect(style) {
  if (currentGlassStyle.value === style.id) return
  setGlassStyle(style.id)
  notify(`已切换为「${style.name}」`)
}

const showCustomThemeModal = ref(false)

const themeSnapshot = reactive({
  scheme: 'classic-cyan',
  customScheme: null,
  isSaved: false
})

const customThemeForm = reactive({
  name: customColorScheme.value?.name || '自定义配色',
  primaryColor: customColorScheme.value?.primaryColor || '#38bdf8',
  baseColor: customColorScheme.value?.baseColor || '#071326',
  panelColor: customColorScheme.value?.panelHex || '#0d203d',
  autoDerive: customColorScheme.value?.autoDerive !== false
})

function isValidHex(hex) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim())
}

const previewPalette = computed(() => {
  return deriveThemePalette(
    isValidHex(customThemeForm.primaryColor) ? customThemeForm.primaryColor : '#38bdf8',
    isValidHex(customThemeForm.baseColor) ? customThemeForm.baseColor : '#071326',
    customThemeForm.autoDerive ? null : (isValidHex(customThemeForm.panelColor) ? customThemeForm.panelColor : null)
  )
})

function openCustomThemeModal() {
  themeSnapshot.scheme = currentColorScheme.value
  themeSnapshot.customScheme = customColorScheme.value ? { ...customColorScheme.value } : null
  themeSnapshot.isSaved = false

  customThemeForm.name = customColorScheme.value?.name || '自定义配色'
  customThemeForm.primaryColor = customColorScheme.value?.primaryColor || '#38bdf8'
  customThemeForm.baseColor = customColorScheme.value?.baseColor || '#071326'
  customThemeForm.panelColor = customColorScheme.value?.panelHex || '#0d203d'
  customThemeForm.autoDerive = customColorScheme.value?.autoDerive !== false
  showCustomThemeModal.value = true

  if (previewPalette.value) {
    applyPreviewPaletteToDOM(previewPalette.value)
  }
}

function closeCustomThemeModal() {
  if (!themeSnapshot.isSaved) {
    if (themeSnapshot.scheme === 'custom' && themeSnapshot.customScheme) {
      saveCustomColorScheme(themeSnapshot.customScheme)
    }
    applyThemeToDOM(themeSnapshot.scheme, currentBgType.value)
  }
  showCustomThemeModal.value = false
}

function applyPresetTemplate(tpl) {
  customThemeForm.name = tpl.name
  customThemeForm.primaryColor = tpl.primaryColor
  customThemeForm.baseColor = tpl.baseColor
  customThemeForm.panelColor = tpl.panelHex || '#0d203d'
  customThemeForm.autoDerive = true
}

watch(previewPalette, (newVal) => {
  if (showCustomThemeModal.value && newVal) {
    applyPreviewPaletteToDOM(newVal)
  }
})

const previewDialogStyle = computed(() => {
  if (!previewPalette.value) return {}
  const p = previewPalette.value
  return {
    '--panel-solid': p.panelHex,
    '--panel': p.panelColor,
    '--surface': p.surfaceColor,
    '--line': p.lineColor,
    '--accent': p.primaryColor,
    '--accent-strong': p.accentStrong,
    '--accent-ink': p.accentInk,
    '--focus': p.primaryColor,
    '--raised': p.raised,
    '--glass': p.glass,
    '--bg': p.baseColor,
    backgroundColor: `${p.panelHex} !important`,
    borderColor: `${p.lineColor} !important`,
    boxShadow: `0 28px 80px rgba(0, 0, 0, 0.7), 0 0 28px ${p.lineColor}`
  }
})

watch(() => customThemeForm.autoDerive, (val) => {
  if (!val && (!customThemeForm.panelColor || !isValidHex(customThemeForm.panelColor))) {
    customThemeForm.panelColor = previewPalette.value?.panelHex || '#0d203d'
  }
})

function handleSelectCustomScheme() {
  if (currentColorScheme.value === 'custom') {
    openCustomThemeModal()
    return
  }
  setColorScheme('custom')
  notify(`已切换为「${customColorScheme.value?.name || '自定义'}」配色`)
}

function handleSaveAndApplyCustomTheme() {
  const finalPrimary = customThemeForm.primaryColor.trim()
  const finalBase = customThemeForm.baseColor.trim()
  if (!isValidHex(finalPrimary) || !isValidHex(finalBase)) {
    notify('请输入有效的 16 进制颜色代码（如 #38bdf8）')
    return
  }
  if (!customThemeForm.autoDerive && !isValidHex(customThemeForm.panelColor.trim())) {
    notify('请输入有效的面板色 16 进制代码（如 #0d203d）')
    return
  }

  const ok = saveCustomColorScheme({
    name: customThemeForm.name.trim() || '自定义配色',
    primaryColor: finalPrimary,
    baseColor: finalBase,
    panelColor: customThemeForm.autoDerive ? null : customThemeForm.panelColor.trim(),
    panelHex: customThemeForm.autoDerive ? previewPalette.value.panelHex : customThemeForm.panelColor.trim(),
    autoDerive: customThemeForm.autoDerive
  })

  if (ok) {
    themeSnapshot.isSaved = true
    setColorScheme('custom')
    applyThemeToDOM('custom', currentBgType.value)
    notify(`自定义配色「${customThemeForm.name.trim() || '自定义配色'}」已保存并应用`)
    showCustomThemeModal.value = false
  } else {
    notify('保存配色方案失败')
  }
}

function handleResetCustomTheme() {
  const defaultTpl = customPresetTemplates?.[0]
  if (defaultTpl) {
    applyPresetTemplate(defaultTpl)
  }
}

function handleBgTypeSelect(bg) {
  if (currentBgType.value === bg.id) {
    if (bg.id === 'custom-local' && !localBgMeta.value) {
      triggerLocalFileInput()
    }
    return
  }
  setBgType(bg.id)
  notify(`已切换为「${bg.name}」背景`)
  if (bg.id === 'custom-local' && !localBgMeta.value) {
    triggerLocalFileInput()
  }
}

const localBgMeta = ref(null)
const localBgUploading = ref(false)
const localFileInputRef = ref(null)

async function loadLocalBgInfo() {
  localBgMeta.value = await getLocalBackgroundMeta()
}

function triggerLocalFileInput() {
  localFileInputRef.value?.click()
}

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
}

async function onLocalFileSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  localBgUploading.value = true
  try {
    const meta = await saveLocalBackground(file)
    localBgMeta.value = meta
    setBgType('custom-local')
    notify(`本地${meta.type === 'video' ? '视频' : '图片'}背景「${meta.name}」已加载${meta.isConvertedTiff ? '（TIFF 科学图像已优化转码）' : ''}`)
  } catch (err) {
    notify(err.message || '加载本地文件失败', 'error')
  } finally {
    localBgUploading.value = false
    if (e.target) e.target.value = ''
  }
}

async function onRemoveLocalBg() {
  if (!confirm('确定要清除已保存的本地背景媒体吗？')) return
  await removeLocalBackground()
  localBgMeta.value = null
  setBgType('clouds-static')
  notify('已清除本地背景，恢复为云山日光背景')
}

const {
  currentFontInfo,
  fontConfig,
  isFontLoading,
  clearCustomFont
} = useCustomFont()

const currentFontMode = ref(getFontMode())
const unifiedFontMeta = ref(null)
const enFontMeta = ref(null)
const zhFontMeta = ref(null)
const targetUploadSlot = ref('unified')
const localFontUploading = ref(false)
const localFontInputRef = ref(null)

const hasAnyCustomFont = computed(() => {
  if (currentFontMode.value === 'unified') {
    return Boolean(unifiedFontMeta.value)
  }
  return Boolean(enFontMeta.value || zhFontMeta.value)
})

async function loadLocalFontInfo() {
  currentFontMode.value = getFontMode()
  const [unified, en, zh] = await Promise.all([
    getLocalFontMeta('unified'),
    getLocalFontMeta('en'),
    getLocalFontMeta('zh')
  ])
  unifiedFontMeta.value = unified
  enFontMeta.value = en
  zhFontMeta.value = zh
}

function switchFontMode(mode) {
  setFontMode(mode)
  currentFontMode.value = mode
  notify(mode === 'split' ? '已切换为中英分离模式，可分别配置西文与中文字体' : '已切换为统一模式，中英文采用同一字体')
}

function triggerSlotUpload(slot = 'unified') {
  targetUploadSlot.value = slot
  localFontInputRef.value?.click()
}

async function onLocalFontSelected(e) {
  const file = e.target.files?.[0]
  if (!file) return
  localFontUploading.value = true
  const slot = targetUploadSlot.value || 'unified'
  try {
    const meta = await saveLocalFont(file, slot)
    if (slot === 'unified') unifiedFontMeta.value = meta
    else if (slot === 'en') enFontMeta.value = meta
    else if (slot === 'zh') zhFontMeta.value = meta
    const slotName = slot === 'en' ? '英文字体' : (slot === 'zh' ? '中文字体' : '统一字体')
    notify(`本地${slotName}「${meta.name}」已载入并即刻生效`)
  } catch (err) {
    notify(err.message || '载入本地字体失败', 'error')
  } finally {
    localFontUploading.value = false
    if (e.target) e.target.value = ''
  }
}

async function onCopyFont(fromSlot, toSlot) {
  localFontUploading.value = true
  try {
    const ok = await copyLocalFont(fromSlot, toSlot)
    if (ok) {
      const meta = await getLocalFontMeta(toSlot)
      if (toSlot === 'en') enFontMeta.value = meta
      else if (toSlot === 'zh') zhFontMeta.value = meta
      else if (toSlot === 'unified') unifiedFontMeta.value = meta
      notify('已成功同步为相同字体文件！')
    }
  } catch (err) {
    notify(err.message || '同步字体失败', 'error')
  } finally {
    localFontUploading.value = false
  }
}

async function onRemoveSlotFont(slot) {
  await removeLocalFont(slot)
  if (slot === 'unified') unifiedFontMeta.value = null
  else if (slot === 'en') enFontMeta.value = null
  else if (slot === 'zh') zhFontMeta.value = null
  const slotName = slot === 'en' ? '英文字体' : (slot === 'zh' ? '中文字体' : '统一字体')
  notify(`已清除${slotName}，恢复系统默认`)
}

async function onRestoreAllDefaultFonts() {
  if (hasAnyCustomFont.value) {
    if (!confirm('确定要恢复系统默认字体方案并清除所有本地自定义字体吗？')) return
  }
  await removeAllLocalFonts()
  clearCustomFont()
  unifiedFontMeta.value = null
  enFontMeta.value = null
  zhFontMeta.value = null
  notify('已恢复为系统默认字体方案')
}

const router = useRouter()
const {
  isHomeEditMode,
  hasCustomLayout,
  setHomeEditMode,
  resetHomeGridLayout
} = useHomeGridEngine()

function handleSwitchHomeEdit(checked) {
  setHomeEditMode(checked)
  if (checked) {
    notify('已开启首页排版设置，正在返回首页编辑…')
    router.push('/')
  } else {
    notify('已关闭首页排版编辑模式')
  }
}

function goToHomeEdit() {
  setHomeEditMode(true)
  router.push('/')
}

function onResetHomeLayout() {
  resetHomeGridLayout()
  notify('已恢复首页为 34be100 经典原生排版')
}

onMounted(() => {
  loadLocalBgInfo()
  loadLocalFontInfo()
})
</script>

<template>
  <div class="personal-page style-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">VISUAL IDENTITY & THEME</p>
        <h1>个性风格</h1>
      </div>
      <div class="style-nav-anchors">
        <a href="#section-color" class="button secondary small anchor-pill">界面配色</a>
        <a href="#section-glass" class="button secondary small anchor-pill highlight-glass">卡片玻璃质感</a>
        <a href="#section-bg" class="button secondary small anchor-pill">背景效果</a>
        <a href="#section-font" class="button secondary small anchor-pill">字体方案</a>
        <a href="#section-home-layout" class="button secondary small anchor-pill highlight-glass">首页小组件排版</a>
      </div>
    </header>

    <!-- 1. 界面配色方案 -->
    <section id="section-color" class="panel style-section theme-settings-section">
      <div class="section-title-row">
        <div>
          <h2>界面配色方案</h2>
        </div>
      </div>
      <div class="theme-cards-grid">
        <div
          v-for="scheme in colorSchemes"
          :key="scheme.id"
          class="theme-card"
          :class="{ 'is-active': currentColorScheme === scheme.id }"
          @click="handleColorSchemeSelect(scheme)"
          tabindex="0"
          role="button"
          :aria-pressed="currentColorScheme === scheme.id"
          @keydown.enter="handleColorSchemeSelect(scheme)"
          @keydown.space.prevent="handleColorSchemeSelect(scheme)"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <h3 class="theme-title">{{ scheme.name }}</h3>
              <p class="theme-subtitle">{{ scheme.subtitle }}</p>
            </div>
            <div class="theme-active-indicator" v-if="currentColorScheme === scheme.id">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">{{ scheme.description }}</p>
          <div class="theme-card-footer">
            <div class="theme-palette-preview" title="配色基准色标：底色、主交互高亮、卡片暗调">
              <span
                v-for="(c, idx) in scheme.colors"
                :key="idx"
                class="color-dot"
                :style="{ backgroundColor: c }"
                :title="c"
              ></span>
            </div>
            <button
              type="button"
              class="button select-theme-btn"
              :class="currentColorScheme === scheme.id ? 'primary' : 'secondary'"
              @click.stop="handleColorSchemeSelect(scheme)"
            >
              {{ currentColorScheme === scheme.id ? '使用中' : '应用配色' }}
            </button>
          </div>
        </div>

        <!-- 自定义配色卡片 -->
        <div
          class="theme-card custom-theme-card"
          :class="{ 'is-active': currentColorScheme === 'custom' }"
          @click="handleSelectCustomScheme"
          tabindex="0"
          role="button"
          :aria-pressed="currentColorScheme === 'custom'"
          @keydown.enter="handleSelectCustomScheme"
          @keydown.space.prevent="handleSelectCustomScheme"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <h3 class="theme-title">{{ customColorScheme?.name || '自定义配色' }}</h3>
              <p class="theme-subtitle">个性化色调与暗色智能推导</p>
            </div>
            <div class="theme-active-indicator" v-if="currentColorScheme === 'custom'">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">自主定制高亮强调色与背景深色，系统智能推导文字对比度与面板半透明质感。</p>
          <div class="theme-card-footer">
            <div class="theme-palette-preview" title="当前自定义主色、底色与面板色">
              <span
                class="color-dot"
                :style="{ backgroundColor: customColorScheme?.baseColor || '#071326' }"
                :title="customColorScheme?.baseColor"
              ></span>
              <span
                class="color-dot"
                :style="{ backgroundColor: customColorScheme?.primaryColor || '#38bdf8' }"
                :title="customColorScheme?.primaryColor"
              ></span>
              <span
                class="color-dot"
                :style="{ backgroundColor: customColorScheme?.panelHex || customColorScheme?.panelColor || '#0d203d' }"
                :title="customColorScheme?.panelHex || customColorScheme?.panelColor"
              ></span>
            </div>
            <div class="custom-card-actions">
              <button
                type="button"
                class="button secondary edit-theme-btn"
                @click.stop="openCustomThemeModal"
              >
                编辑
              </button>
              <button
                type="button"
                class="button select-theme-btn"
                :class="currentColorScheme === 'custom' ? 'primary' : 'secondary'"
                @click.stop="handleSelectCustomScheme"
              >
                {{ currentColorScheme === 'custom' ? '使用中' : '应用配色' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. 卡片玻璃质感 -->
    <section id="section-glass" class="panel style-section theme-settings-section">
      <div class="section-title-row">
        <div>
          <h2>卡片玻璃质感</h2>
        </div>
      </div>
      <div class="theme-cards-grid">
        <div
          v-for="style in glassOptions"
          :key="style.id"
          class="theme-card"
          :class="{ 'is-active': currentGlassStyle === style.id }"
          @click="handleGlassStyleSelect(style)"
          tabindex="0"
          role="button"
          :aria-pressed="currentGlassStyle === style.id"
          @keydown.enter="handleGlassStyleSelect(style)"
          @keydown.space.prevent="handleGlassStyleSelect(style)"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <h3 class="theme-title">{{ style.name }}</h3>
              <p class="theme-subtitle">{{ style.subtitle }}</p>
            </div>
            <div class="theme-active-indicator" v-if="currentGlassStyle === style.id">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">{{ style.description }}</p>
          <div class="theme-card-footer">
            <div class="glass-tag-badge">
              <span class="badge" :class="style.id === 'liquid' ? 'cyan' : ''">{{ style.tag }}</span>
            </div>
            <button
              type="button"
              class="button select-theme-btn"
              :class="currentGlassStyle === style.id ? 'primary' : 'secondary'"
              @click.stop="handleGlassStyleSelect(style)"
            >
              {{ currentGlassStyle === style.id ? '使用中' : '应用质感' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. 背景效果 -->
    <section id="section-bg" class="panel style-section theme-settings-section">
      <div class="section-title-row">
        <div>
          <h2>界面背景效果</h2>
        </div>
      </div>
      <div class="theme-cards-grid">
        <div
          v-for="bg in bgOptions"
          :key="bg.id"
          class="theme-card"
          :class="{ 'is-active': currentBgType === bg.id }"
          @click="handleBgTypeSelect(bg)"
          tabindex="0"
          role="button"
          :aria-pressed="currentBgType === bg.id"
          @keydown.enter="handleBgTypeSelect(bg)"
          @keydown.space.prevent="handleBgTypeSelect(bg)"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <h3 class="theme-title">{{ bg.name }}</h3>
              <p class="theme-subtitle">{{ bg.subtitle }}</p>
            </div>
            <div class="theme-active-indicator" v-if="currentBgType === bg.id">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">{{ bg.description }}</p>
          <div class="theme-card-footer">
            <div class="bg-card-hint muted" style="font-size: 11px;">
              <template v-if="bg.id === 'custom-local'">
                {{ localBgMeta ? `已载入: ${localBgMeta.name}` : '未选择本地文件' }}
              </template>
            </div>
            <button
              type="button"
              class="button select-theme-btn"
              :class="currentBgType === bg.id ? 'primary' : 'secondary'"
              @click.stop="handleBgTypeSelect(bg)"
            >
              {{ currentBgType === bg.id ? '使用中' : '应用背景' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 动态视频背景定格控制卡片 -->
      <div class="bg-freeze-control-card">
        <div class="bg-freeze-header">
          <div class="bg-freeze-title-group">
            <div class="bg-freeze-title-row">
              <AppIcon name="clock" :size="18" />
              <h3 class="bg-freeze-title">暂停动态视频背景</h3>
              <span
                class="bg-freeze-badge"
                :class="{ 'is-paused': isBgVideoPaused }"
              >
                {{ isBgVideoPaused ? '已定格为静态壁纸' : '动态视频播放中' }}
              </span>
            </div>
            <p class="muted bg-freeze-desc">
              开启后，深空地球轨道或本地自定义视频将定格在当前帧，作为超清静态壁纸使用；有效释放 GPU 运算负担，大幅降低设备发热与能耗。
            </p>
          </div>
          <button
            type="button"
            class="button small bg-freeze-toggle-btn"
            :class="isBgVideoPaused ? 'primary' : 'secondary'"
            @click="handleToggleBgVideoPaused"
          >
            {{ isBgVideoPaused ? '恢复动态播放' : '定格为静态壁纸' }}
          </button>
        </div>
      </div>

      <!-- 背景暗化程度调节卡片 -->
      <div class="bg-dim-control-card">
        <div class="bg-dim-header">
          <div class="bg-dim-title-group">
            <label for="bg-dim-slider" class="bg-dim-title">
              <span>背景遮罩暗化程度</span>
              <span class="bg-dim-value-badge mono">{{ currentBgDim }}%</span>
            </label>
            <p class="muted bg-dim-desc">
              调暗背景可衬托前景卡片与文字可读性。采用无色纯黑通透压暗，绝不改变壁纸原图色彩；各配色方案与液态玻璃实时同步。
            </p>
          </div>
          <button
            v-if="currentBgDim !== DEFAULT_BG_DIM"
            type="button"
            class="button small secondary bg-dim-reset-btn"
            @click="resetBgDim"
          >
            恢复默认 ({{ DEFAULT_BG_DIM }}%)
          </button>
        </div>
        <div class="bg-dim-slider-wrapper">
          <span class="dim-tick-label">0% 原图通透</span>
          <input
            id="bg-dim-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            :value="currentBgDim"
            :style="{ '--val': currentBgDim + '%' }"
            @input="onBgDimInput"
            class="bg-dim-slider"
            aria-label="背景遮罩暗化程度"
          />
          <span class="dim-tick-label">100% 深度暗化</span>
        </div>
      </div>

      <!-- 本地背景管理面板 -->
      <div class="local-bg-control-box">
        <input
          ref="localFileInputRef"
          type="file"
          accept="image/*,video/*,.mov,.mp4,.webm,.m4v,.mkv,.tif,.tiff,image/tiff"
          aria-label="选择本地背景图片或视频"
          style="display: none;"
          @change="onLocalFileSelected"
        />
        <div class="local-bg-header">
          <div class="action_has has_saved local-bg-icon" aria-hidden="true" title="本地持久化存储">
            <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" stroke-linejoin="round" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24" stroke="currentColor" fill="none">
              <path d="m19,21H5c-1.1,0-2-.9-2-2V5c0-1.1.9-2,2-2h11l5,5v11c0,1.1-.9,2-2,2Z" stroke-linejoin="round" stroke-linecap="round" data-path="box"></path>
              <path d="M7 3L7 8L15 8" stroke-linejoin="round" stroke-linecap="round" data-path="line-top"></path>
              <path d="M17 20L17 13L7 13L7 20" stroke-linejoin="round" stroke-linecap="round" data-path="line-bottom"></path>
            </svg>
          </div>
          <div class="local-bg-title-wrap">
            <strong>本地图片 / 视频背景（纯前端本地持久化）</strong>
            <p class="muted">所选媒体仅存储于当前浏览器 IndexedDB 本地数据库</p>
          </div>
        </div>

        <div v-if="localBgMeta" class="local-bg-status-card">
          <div class="local-bg-meta-info">
            <span class="badge" :class="localBgMeta.type === 'video' ? 'cyan' : 'amber'">
              {{ localBgMeta.type === 'video' ? '本地视频' : (localBgMeta.isConvertedTiff ? '本地TIFF图片' : '本地图片') }}
            </span>
            <span class="local-bg-filename mono" :title="localBgMeta.name">{{ localBgMeta.name }}</span>
            <span class="muted" style="font-size: 12px;">
              <template v-if="localBgMeta.isConvertedTiff && localBgMeta.originalSize && localBgMeta.originalSize !== localBgMeta.size">
                (占用: {{ formatFileSize(localBgMeta.size) }}，原图: {{ formatFileSize(localBgMeta.originalSize) }})
              </template>
              <template v-else>
                ({{ formatFileSize(localBgMeta.size) }})
              </template>
            </span>
          </div>
          <div class="local-bg-actions">
            <button
              type="button"
              class="button small secondary"
              :disabled="localBgUploading"
              @click="triggerLocalFileInput"
            >
              更换文件
            </button>
            <button
              type="button"
              class="button small danger"
              :disabled="localBgUploading"
              @click="onRemoveLocalBg"
            >
              清除
            </button>
          </div>
        </div>

        <div v-else class="local-bg-upload-zone" @click="triggerLocalFileInput">
          <div class="upload-zone-content">
            <div class="action_has has_saved upload-icon" aria-hidden="true">
              <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="20" height="20" stroke-linejoin="round" stroke-linecap="round" stroke-width="2" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                <path d="m19,21H5c-1.1,0-2-.9-2-2V5c0-1.1.9-2,2-2h11l5,5v11c0,1.1-.9,2-2,2Z" stroke-linejoin="round" stroke-linecap="round" data-path="box"></path>
                <path d="M7 3L7 8L15 8" stroke-linejoin="round" stroke-linecap="round" data-path="line-top"></path>
                <path d="M17 20L17 13L7 13L7 20" stroke-linejoin="round" stroke-linecap="round" data-path="line-bottom"></path>
              </svg>
            </div>
            <span class="upload-text">{{ localBgUploading ? '正在读取本地媒体...' : '点击选择本地图片或视频作为背景' }}</span>
            <span class="muted upload-tip">支持 MP4 / WebM / MOV 视频或 PNG / JPG / WebP / TIFF（支持天文/高位深科学图像自动转码）图片，自动适配满屏且静音循环播放</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 字体方案 -->
    <section id="section-font" class="panel style-section theme-settings-section">
      <div class="section-title-row font-section-title-row">
        <div>
          <h2>界面字体方案</h2>
        </div>
        <!-- 统一模式 / 分离模式 切换 -->
        <div class="font-mode-segmented" role="tablist" aria-label="字体模式选择">
          <button
            type="button"
            class="font-mode-pill"
            :class="{ active: currentFontMode === 'unified' }"
            role="tab"
            :aria-selected="currentFontMode === 'unified'"
            @click="switchFontMode('unified')"
          >
            <AppIcon name="font" :size="13" />
            <span>统一模式（中英相同）</span>
          </button>
          <button
            type="button"
            class="font-mode-pill"
            :class="{ active: currentFontMode === 'split' }"
            role="tab"
            :aria-selected="currentFontMode === 'split'"
            @click="switchFontMode('split')"
          >
            <AppIcon name="translate" :size="13" />
            <span>分离模式（中英各异）</span>
          </button>
        </div>
      </div>

      <input
        ref="localFontInputRef"
        type="file"
        accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
        aria-label="选择本地字体文件"
        style="display: none;"
        @change="onLocalFontSelected"
      />

      <!-- 实时排版渲染预览面板 -->
      <div class="font-preview-stage" :class="{ 'is-custom': hasAnyCustomFont }">
        <div class="font-preview-header">
          <span class="font-preview-label">实时字体排版渲染预览（整站即刻生效）</span>
          <div class="preview-badges">
            <template v-if="currentFontMode === 'unified'">
              <span class="badge" :class="unifiedFontMeta ? 'cyan' : ''">
                {{ unifiedFontMeta ? `统一字体: ${unifiedFontMeta.name}` : '系统默认黑体' }}
              </span>
            </template>
            <template v-else>
              <span class="badge" :class="enFontMeta ? 'blue' : ''">
                {{ enFontMeta ? `西文: ${enFontMeta.name}` : '西文: 系统默认' }}
              </span>
              <span class="badge" :class="zhFontMeta ? 'amber' : ''">
                {{ zhFontMeta ? `中文: ${zhFontMeta.name}` : '中文: 系统默认' }}
              </span>
            </template>
          </div>
        </div>
        <div class="font-preview-body">
          <div class="font-preview-row">
            <span class="preview-tag muted">中文排版</span>
            <p class="font-preview-line-title">天体物理与交叉科学课题组</p>
          </div>
          <div class="font-preview-row">
            <span class="preview-tag muted">西文排版</span>
            <p class="font-preview-line-en">Astrophysics and Interdisciplinary Science Research Group</p>
          </div>
          <div class="font-preview-row">
            <span class="preview-tag muted">科学数字与符号</span>
            <p class="font-preview-line-digits mono">0123456789 · Redshift z = 2.45 · Lambda-CDM Cosmology</p>
          </div>
        </div>
      </div>

      <!-- A. 统一模式视图 -->
      <div v-if="currentFontMode === 'unified'" class="theme-cards-grid font-cards-grid">
        <!-- 方案 1：系统现代黑体（默认方案） -->
        <div
          class="theme-card font-option-card"
          :class="{ 'is-active': !unifiedFontMeta }"
          @click="onRestoreAllDefaultFonts"
          tabindex="0"
          role="button"
          :aria-pressed="!unifiedFontMeta"
          @keydown.enter="onRestoreAllDefaultFonts"
          @keydown.space.prevent="onRestoreAllDefaultFonts"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="theme-title">系统默认黑体</h3>
                <span class="badge">系统内置</span>
              </div>
              <p class="theme-subtitle">Inter · 苹方 · 微软雅黑</p>
            </div>
            <div class="theme-active-indicator" v-if="!unifiedFontMeta">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">原生跨平台高品质无衬线字体栈，加载零延迟，兼容性最佳</p>
          <div class="theme-card-footer">
            <div class="bg-card-hint muted" style="font-size: 11px;">
              零额外开销 · 免下载
            </div>
            <button
              type="button"
              class="button select-theme-btn"
              :class="!unifiedFontMeta ? 'primary' : 'secondary'"
              @click.stop="onRestoreAllDefaultFonts"
            >
              {{ !unifiedFontMeta ? '使用中' : '恢复默认' }}
            </button>
          </div>
        </div>

        <!-- 方案 2：本地统一字体（中英相同） -->
        <div
          class="theme-card font-option-card"
          :class="{ 'is-active': !!unifiedFontMeta }"
          @click="triggerSlotUpload('unified')"
          tabindex="0"
          role="button"
          :aria-pressed="!!unifiedFontMeta"
          @keydown.enter="triggerSlotUpload('unified')"
          @keydown.space.prevent="triggerSlotUpload('unified')"
        >
          <div class="theme-card-header">
            <div class="theme-card-title-group">
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 class="theme-title">本地统一字体</h3>
                <span class="badge amber">中英相同</span>
              </div>
              <p class="theme-subtitle">{{ unifiedFontMeta ? unifiedFontMeta.name : '未载入本地字体文件' }}</p>
            </div>
            <div class="theme-active-indicator" v-if="!!unifiedFontMeta">
              <span class="active-dot"></span> 当前生效
            </div>
          </div>
          <p class="theme-card-desc">纯本地存储（IndexedDB），中英文使用同一字体文件，支持 WOFF2 / WOFF / TTF / OTF。</p>
          <div class="theme-card-footer">
            <div class="bg-card-hint muted" style="font-size: 11px;">
              {{ unifiedFontMeta ? `${unifiedFontMeta.format.toUpperCase()} · ${formatFileSize(unifiedFontMeta.size)}` : '点击选择字体文件' }}
            </div>
            <div style="display: flex; gap: 6px;">
              <button
                type="button"
                class="button select-theme-btn"
                :class="!!unifiedFontMeta ? 'primary' : 'secondary'"
                @click.stop="triggerSlotUpload('unified')"
              >
                {{ !!unifiedFontMeta ? '更换字体' : '选择字体' }}
              </button>
              <button
                v-if="unifiedFontMeta"
                type="button"
                class="button small danger"
                @click.stop="onRemoveSlotFont('unified')"
              >
                清除
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- B. 分离模式视图（中英各异） -->
      <div v-else class="split-font-grid">
        <!-- 槽位 1：英文字体 / 西文字体 -->
        <div class="split-font-card" :class="{ 'has-file': !!enFontMeta }">
          <div class="split-font-card-header">
            <div class="slot-badge-wrap">
              <span class="badge blue">西文 / 数字字体</span>
              <span v-if="enFontMeta" class="active-pill"><span class="active-dot"></span>已生效</span>
              <span v-else class="muted slot-fallback-hint">使用系统默认 (Inter)</span>
            </div>
            <h3 class="slot-title">{{ enFontMeta ? enFontMeta.name : '未设置英文字体' }}</h3>
            <p class="slot-desc">渲染英文、数字、拉丁字符及物理公式常量符号</p>
          </div>

          <div v-if="enFontMeta" class="slot-info-box">
            <div class="slot-file-meta mono">
              <span class="badge">{{ enFontMeta.format.toUpperCase() }}</span>
              <span class="muted">{{ formatFileSize(enFontMeta.size) }}</span>
            </div>
            <div class="slot-action-row">
              <button type="button" class="button small secondary" :disabled="localFontUploading" @click="triggerSlotUpload('en')">
                更换英文字体
              </button>
              <button
                v-if="zhFontMeta && zhFontMeta.name !== enFontMeta.name"
                type="button"
                class="button small secondary ghost"
                title="将当前英文字体同时应用为中文字体"
                :disabled="localFontUploading"
                @click="onCopyFont('en', 'zh')"
              >
                中英共用此字体
              </button>
              <button type="button" class="button small danger" :disabled="localFontUploading" @click="onRemoveSlotFont('en')">
                清除
              </button>
            </div>
          </div>
          <div v-else class="slot-empty-box" @click="triggerSlotUpload('en')">
            <span class="upload-text">{{ localFontUploading ? '载入中…' : '点击选择西文/数字字体文件' }}</span>
            <span class="muted" style="font-size: 11px;">如 JetBrains Mono、Roboto、Inter、Fira Code 等</span>
            <button
              v-if="zhFontMeta"
              type="button"
              class="button small secondary ghost sync-hint-btn"
              @click.stop="onCopyFont('zh', 'en')"
            >
              采用已有中文字体（{{ zhFontMeta.name }}）
            </button>
          </div>
        </div>

        <!-- 槽位 2：中文字体 -->
        <div class="split-font-card" :class="{ 'has-file': !!zhFontMeta }">
          <div class="split-font-card-header">
            <div class="slot-badge-wrap">
              <span class="badge amber">中文字体</span>
              <span v-if="zhFontMeta" class="active-pill"><span class="active-dot"></span>已生效</span>
              <span v-else class="muted slot-fallback-hint">使用系统默认 (苹方/微软雅黑)</span>
            </div>
            <h3 class="slot-title">{{ zhFontMeta ? zhFontMeta.name : '未设置中文字体' }}</h3>
            <p class="slot-desc">渲染中文字符与全角标点</p>
          </div>

          <div v-if="zhFontMeta" class="slot-info-box">
            <div class="slot-file-meta mono">
              <span class="badge">{{ zhFontMeta.format.toUpperCase() }}</span>
              <span class="muted">{{ formatFileSize(zhFontMeta.size) }}</span>
            </div>
            <div class="slot-action-row">
              <button type="button" class="button small secondary" :disabled="localFontUploading" @click="triggerSlotUpload('zh')">
                更换中文字体
              </button>
              <button
                v-if="enFontMeta && enFontMeta.name !== zhFontMeta.name"
                type="button"
                class="button small secondary ghost"
                title="将当前中文字体同时应用为英文字体"
                :disabled="localFontUploading"
                @click="onCopyFont('zh', 'en')"
              >
                中英共用此字体
              </button>
              <button type="button" class="button small danger" :disabled="localFontUploading" @click="onRemoveSlotFont('zh')">
                清除
              </button>
            </div>
          </div>
          <div v-else class="slot-empty-box" @click="triggerSlotUpload('zh')">
            <span class="upload-text">{{ localFontUploading ? '载入中…' : '点击选择中文字体文件' }}</span>
            <span class="muted" style="font-size: 11px;">如 思源黑体、霞鹜文楷、得意黑、鸿蒙黑体等</span>
            <button
              v-if="enFontMeta"
              type="button"
              class="button small secondary ghost sync-hint-btn"
              @click.stop="onCopyFont('en', 'zh')"
            >
              采用已有英文字体（{{ enFontMeta.name }}）
            </button>
          </div>
        </div>
      </div>

      <div v-if="hasAnyCustomFont" class="font-section-footer">
        <button type="button" class="button small ghost" @click="onRestoreAllDefaultFonts">
          <AppIcon name="undo" :size="12" /> 恢复系统默认字体方案
        </button>
      </div>
    </section>

    <!-- 5. 首页小组件与 Bento 排版 -->
    <section id="section-home-layout" class="panel style-section theme-settings-section">
      <div class="section-title-row">
        <div>
          <h2>首页小组件与 Bento 网格排版</h2>
          <p class="section-subtitle">
            支持 7 大科研业务卡片自由拖拽换位、6 级几何倍数比例缩放、负空间留白与随时恢复 34be100 最理想经典设计。
          </p>
        </div>
      </div>

      <!-- 首页排版设置 Switch 开关 -->
      <div class="home-layout-switch-bar">
        <div class="switch-left">
          <div class="switch-title-wrap">
            <span class="switch-title">首页排版设置 Switch 开关</span>
            <span class="badge" :class="isHomeEditMode ? 'emerald' : 'muted'">{{ isHomeEditMode ? '编辑排版状态中' : '未开启' }}</span>
          </div>
          <p class="switch-desc">开启此 Switch 开关后将立即回到首页面，直接进入编辑排版状态，进行自由拖拽对调、挤占与添加卡片。</p>
        </div>
        <div class="switch-control-wrap">
          <label class="apple-switch" title="开启后进入首页编辑排版状态">
            <input
              type="checkbox"
              :checked="isHomeEditMode"
              @change="handleSwitchHomeEdit($event.target.checked)"
            />
            <span class="apple-switch-slider"></span>
          </label>
        </div>
      </div>

      <div class="home-layout-status-card">
        <div class="status-left">
          <div class="status-icon-wrap" :class="{ 'is-custom': hasCustomLayout }">
            <AppIcon :name="hasCustomLayout ? 'layout' : 'check'" :size="24" />
          </div>
          <div class="status-texts">
            <div class="status-title-row">
              <h3>{{ hasCustomLayout ? '当前生效：自定义 Bento 网格排版' : '当前生效：经典原生排版（默认）' }}</h3>
              <span class="badge" :class="hasCustomLayout ? 'blue' : 'emerald'">
                {{ hasCustomLayout ? '已个性化定制' : '34be100 最理想尺寸' }}
              </span>
            </div>
            <p class="status-desc">
              {{ hasCustomLayout
                ? '已开启自定义排版，卡片在 68px 基准行高网格中按 1×1、2×1、2×2、2×4 几何比例精准对齐。'
                : '默认原生模板，100% 还原基准设计尺寸、LiquidGlass 液体玻璃质感与零白屏科研信息流。'
              }}
            </p>
          </div>
        </div>

        <div class="status-actions">
          <button
            type="button"
            class="button primary"
            @click="goToHomeEdit"
          >
            <AppIcon name="layout" :size="15" />
            <span>进入首页自由排版</span>
          </button>
          <button
            v-if="hasCustomLayout"
            type="button"
            class="button secondary danger"
            @click="onResetHomeLayout"
          >
            <AppIcon name="refresh" :size="14" />
            <span>恢复经典排版</span>
          </button>
        </div>
      </div>

      <!-- 6 级几何尺寸规格与 7 大小组件预览面板 -->
      <div class="layout-spec-overview">
        <h4 class="spec-heading">卡片几何倍数系统与支持业务（全卡片支持 6 级尺寸）</h4>
        <div class="spec-grid">
          <div class="spec-card">
            <span class="spec-tag">1×1 最小号 (Minimal)</span>
            <strong>宽半栏 × 高 68px</strong>
            <p>微缩指标方块，并排容纳 2 个，支持全 7 大组件快速查阅。</p>
          </div>
          <div class="spec-card">
            <span class="spec-tag">2×1 小号 (Small)</span>
            <strong>宽全栏 × 高 68px</strong>
            <p>单行信息卡，等同 2 个最小号卡片，轻量紧凑。</p>
          </div>
          <div class="spec-card">
            <span class="spec-tag">2×2 中号 (Medium)</span>
            <strong>宽全栏 × 高 146px</strong>
            <p>等同 2 个小号（4 个最小号），包含今日天气与精选摘要。</p>
          </div>
          <div class="spec-card">
            <span class="spec-tag">2×4 大号 (Large)</span>
            <strong>宽全栏 × 高 302px</strong>
            <p>等同 2 个中号（8 个最小号），最近组会专栏或日程瀑布流。</p>
          </div>
          <div class="spec-card">
            <span class="spec-tag">中宽 (Medium-Wide)</span>
            <strong>1 号位半宽 × 高 180px</strong>
            <p>1 号位专属 2 栏展台，精选会议或学术报告速览。</p>
          </div>
          <div class="spec-card">
            <span class="spec-tag">宽卡片 (Wide)</span>
            <strong>1 号位全宽 × 高 180px</strong>
            <p>1 号位专属 4 栏全景展台，与 34be100 近期学术会议完全一致。</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 自定义界面配色弹窗 -->
    <BaseDialog
      :open="showCustomThemeModal"
      title="自定义界面配色方案"
      :wide="true"
      :frame-style="previewDialogStyle"
      @close="closeCustomThemeModal"
    >
      <div class="custom-theme-dialog-content">
        <p class="muted" style="font-size: 13px; margin-bottom: 16px; line-height: 1.6;">
          选择或输入心仪的主强调色与背景基底色，系统将自动计算前景色对比度、悬停高亮、边框微光及层叠面板半透明质感，确保全界面无障碍可读与视觉和谐。
        </p>

        <!-- 灵感预设模板快选 -->
        <div class="custom-templates-section">
          <div class="custom-subheading">灵感预设模板</div>
          <div class="custom-templates-grid">
            <button
              v-for="tpl in customPresetTemplates"
              :key="tpl.id"
              type="button"
              class="custom-tpl-btn"
              :class="{ 'is-selected': customThemeForm.primaryColor.toLowerCase() === tpl.primaryColor.toLowerCase() && customThemeForm.baseColor.toLowerCase() === tpl.baseColor.toLowerCase() }"
              @click="applyPresetTemplate(tpl)"
            >
              <div class="custom-tpl-preview">
                <span class="custom-tpl-dot" :style="{ backgroundColor: tpl.baseColor }"></span>
                <span class="custom-tpl-dot" :style="{ backgroundColor: tpl.primaryColor }"></span>
              </div>
              <span class="custom-tpl-name">{{ tpl.name }}</span>
            </button>
          </div>
        </div>

        <!-- 配色表单与实时预览两列布局 -->
        <div class="custom-form-and-preview-grid">
          <!-- 左列：参数配置 -->
          <div class="custom-config-col">
            <div class="custom-subheading">调色参数配置</div>

            <label class="custom-input-label">
              <span>方案名称</span>
              <input
                v-model="customThemeForm.name"
                type="text"
                maxlength="20"
                placeholder="例如：极光深蓝"
                class="custom-name-input"
              />
            </label>

            <div class="color-picker-item">
              <label class="color-picker-label">
                <span class="color-picker-title">主交互强调色（Primary Accent）</span>
                <span class="color-picker-desc">用于按钮高亮、选中态、状态圆点、边框微光</span>
              </label>
              <div class="color-input-combo">
                <input
                  type="color"
                  class="native-color-picker"
                  :value="isValidHex(customThemeForm.primaryColor) ? customThemeForm.primaryColor : '#38bdf8'"
                  @input="customThemeForm.primaryColor = $event.target.value"
                />
                <input
                  type="text"
                  class="hex-text-input"
                  v-model="customThemeForm.primaryColor"
                  placeholder="#38bdf8"
                  maxlength="7"
                />
              </div>
            </div>

            <div class="color-picker-item">
              <label class="color-picker-label">
                <span class="color-picker-title">深色背景底色（Base Background）</span>
                <span class="color-picker-desc">全站最底层基底深色，建议使用低明度低饱和深色</span>
              </label>
              <div class="color-input-combo">
                <input
                  type="color"
                  class="native-color-picker"
                  :value="isValidHex(customThemeForm.baseColor) ? customThemeForm.baseColor : '#071326'"
                  @input="customThemeForm.baseColor = $event.target.value"
                />
                <input
                  type="text"
                  class="hex-text-input"
                  v-model="customThemeForm.baseColor"
                  placeholder="#071326"
                  maxlength="7"
                />
              </div>
            </div>

            <ThinHoundCheckbox
              v-model="customThemeForm.autoDerive"
              :size="18"
              class="custom-checkbox-row"
            >
              <span>智能推导卡片面板与浮层表面色（推荐开启）</span>
            </ThinHoundCheckbox>

            <div v-if="!customThemeForm.autoDerive" class="color-picker-item" style="margin-top: 6px;">
              <label class="color-picker-label">
                <span class="color-picker-title">容器卡片表面色（Panel Surface）</span>
                <span class="color-picker-desc">用于卡片容器、导航顶栏、输入框背景</span>
              </label>
              <div class="color-input-combo">
                <input
                  type="color"
                  class="native-color-picker"
                  :value="isValidHex(customThemeForm.panelColor) ? customThemeForm.panelColor : '#0d203d'"
                  @input="customThemeForm.panelColor = $event.target.value"
                />
                <input
                  type="text"
                  class="hex-text-input"
                  v-model="customThemeForm.panelColor"
                  placeholder="#0d203d"
                  maxlength="7"
                />
              </div>
            </div>
          </div>

          <!-- 右列：实时组件效果预览 -->
          <div class="custom-preview-col">
            <div class="custom-subheading">实时组件效果预览</div>
            <div
              class="custom-live-preview-box"
              :style="{
                backgroundColor: previewPalette.baseColor,
                borderColor: previewPalette.lineColor
              }"
            >
              <!-- 预览卡片 -->
              <div
                class="preview-mockup-panel"
                :style="{
                  backgroundColor: previewPalette.panelColor,
                  borderColor: previewPalette.lineColor
                }"
              >
                <div class="preview-mockup-header">
                  <span
                    class="preview-mockup-title"
                    :style="{ color: '#f8fafc' }"
                  >
                    {{ customThemeForm.name || '自定义配色' }}
                  </span>
                  <span
                    class="preview-mockup-badge"
                    :style="{
                      backgroundColor: previewPalette.raised,
                      borderColor: previewPalette.lineColor,
                      color: previewPalette.primaryColor
                    }"
                  >
                    实时演示
                  </span>
                </div>

                <p class="preview-mockup-desc" :style="{ color: '#94a3b8' }">
                  智能计算保证高亮元素上的文字具备极高对比度，面板半透明融合背景光影。
                </p>

                <div class="preview-mockup-elements">
                  <button
                    type="button"
                    class="preview-mockup-btn-primary"
                    :style="{
                      backgroundColor: previewPalette.primaryColor,
                      color: previewPalette.accentInk
                    }"
                  >
                    主要操作
                  </button>
                  <button
                    type="button"
                    class="preview-mockup-btn-secondary"
                    :style="{
                      backgroundColor: previewPalette.surfaceColor,
                      borderColor: previewPalette.lineColor,
                      color: previewPalette.primaryColor
                    }"
                  >
                    次要按钮
                  </button>
                </div>

                <div
                  class="preview-mockup-subbox"
                  :style="{
                    backgroundColor: previewPalette.surfaceColor,
                    borderColor: previewPalette.lineColor
                  }"
                >
                  <div
                    class="preview-subbox-indicator"
                    :style="{ backgroundColor: previewPalette.primaryColor }"
                  ></div>
                  <span :style="{ color: '#cbd5e1', fontSize: '12px' }">
                    对比度优化反色：{{ previewPalette.accentInk }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 弹窗底部操作栏 -->
        <div class="custom-dialog-actions">
          <button
            type="button"
            class="button secondary"
            @click="handleResetCustomTheme"
          >
            恢复推荐默认
          </button>
          <div class="dialog-action-right">
            <button
              type="button"
              class="button secondary"
              @click="closeCustomThemeModal"
            >
              取消
            </button>
            <button
              type="button"
              class="button primary"
              @click="handleSaveAndApplyCustomTheme"
            >
              保存并应用
            </button>
          </div>
        </div>
      </div>
    </BaseDialog>
  </div>
</template>

<style scoped>
.style-page {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
}

.style-section {
  padding: 24px;
  margin-top: 20px;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.style-nav-anchors {
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

.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

  background:
    linear-gradient(var(--light), var(--light)) 14px 2px / calc(max(0%, var(--val) - 24px)) 2.5px no-repeat,
    radial-gradient(circle at 8px 5px, var(--light) 2px, transparent 2.5px) no-repeat,
    linear-gradient(
      to bottom,
      var(--base) 0%,
      var(--base) 70%,
      var(--dark) 85%
    ) 0 0 / var(--val) 100% no-repeat,
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

.bg-dim-slider::-webkit-slider-runnable-track {
  -webkit-appearance: none;
  height: 100%;
  background: transparent;
  border: none;
}

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

.bg-dim-slider::-moz-range-track {
  height: 100%;
  background: transparent;
  border: none;
}

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

@media (max-width: 768px) {
  .style-page {
    width: 100%;
    max-width: 100%;
  }

  .style-section {
    padding: 16px 14px !important;
  }

  .section-title-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
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
}

/* 视频背景定格控制卡片 */
.bg-freeze-control-card {
  margin-top: 20px;
  padding: 18px 22px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 16px;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
.bg-freeze-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.bg-freeze-title-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bg-freeze-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.bg-freeze-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}
.bg-freeze-badge {
  font-size: 11.5px;
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--line);
  color: var(--soft);
}
.bg-freeze-badge.is-paused {
  background: rgba(56, 189, 248, 0.16);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}
.bg-freeze-desc {
  font-size: 13px;
  line-height: 1.55;
  margin: 0;
  max-width: 680px;
}
.bg-freeze-toggle-btn {
  white-space: nowrap;
  flex-shrink: 0;
}

/* 首页排版管理卡片与几何尺寸总览 */
.home-layout-switch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 20px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  margin-bottom: 20px;
}

.switch-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.switch-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.switch-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.switch-desc {
  margin: 0;
  font-size: 12.5px;
  color: var(--text-secondary, #94a3b8);
}

/* 经典 iOS / macOS 风格 Switch 开关 */
.apple-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 28px;
  flex-shrink: 0;
  cursor: pointer;
}

.apple-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.apple-switch-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.18);
  border: 1px solid rgba(255, 255, 255, 0.2);
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 34px;
}

.apple-switch-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.apple-switch input:checked + .apple-switch-slider {
  background-color: #10b981;
  border-color: #10b981;
  box-shadow: 0 0 14px rgba(16, 185, 129, 0.45);
}

.apple-switch input:checked + .apple-switch-slider:before {
  transform: translateX(22px);
}

.home-layout-status-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 24px;
  background: var(--bg-hover, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  margin-bottom: 24px;
}

.status-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.status-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  flex-shrink: 0;
}

.status-icon-wrap.is-custom {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
  border-color: rgba(99, 102, 241, 0.35);
}

.status-texts {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.status-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.status-title-row h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.status-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary, #94a3b8);
  max-width: 620px;
}

.status-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.layout-spec-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.spec-heading {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #f8fafc);
}

.spec-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.spec-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.06));
  border-radius: 10px;
}

.spec-tag {
  font-size: 11px;
  font-weight: 600;
  color: #818cf8;
  text-transform: uppercase;
}

.spec-card strong {
  font-size: 13px;
  color: var(--text-primary, #f8fafc);
}

.spec-card p {
  margin: 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--text-secondary, #94a3b8);
}

@media (max-width: 768px) {
  .home-layout-status-card {
    flex-direction: column;
    align-items: flex-start;
  }
  .status-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
