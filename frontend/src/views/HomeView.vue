<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PersonalAgenda from '../components/PersonalAgenda.vue'
import SeminarReminders from '../components/SeminarReminders.vue'
import SilentLizardButton from '../components/SilentLizardButton.vue'
import NoticeMarquee from '../components/NoticeMarquee.vue'

import { arxivApi, libraryApi, resourceApi, seminarApi, talkApi } from '../api/client'
import { refreshArxivUnread, getCachedArxivUnread, clearArxivUnread, markArxivFeedViewed, ARXIV_UNREAD_EVENT } from '../utils/arxivUnread'
import { addDays, monday, nextSeminar, shanghaiToday, sortSeminars } from '../utils/schedule'
import { getHoliday } from '../utils/holidays'
import { isMidAutumnFestival } from '../utils/midAutumn'
import { LiquidGlass } from '../libs/liquidglass'
import { useWeekDrag } from '../composables/useWeekDrag'
import { currentBgType, currentColorScheme, currentGlassStyle } from '../composables/useThemeStyle'
import { useSiteConfig } from '../composables/useSiteConfig'
const router = useRouter()
const { siteConfig } = useSiteConfig()
const isMidAutumn = computed(() => isMidAutumnFestival())
const weatherLocation = computed(() => siteConfig.institution ? siteConfig.institution : '学术园区')
const today = ref(shanghaiToday()), focus = ref(today.value), now = ref(Date.now())
const forecastDashboardRef = ref(null)
const forecastRightRef = ref(null)
const liquidGlassActive = ref(false)
let liquidGlassInstance = null

const homeWeekDrag = useWeekDrag({
  onPrev: () => { focus.value = addDays(focus.value, -7) },
  onNext: () => { focus.value = addDays(focus.value, 7) },
  threshold: 45
})

let focusTimer = null
function goToThisWeek() {
  const todayVal = today.value
  const todayMon = monday(todayVal)
  const currentMon = monday(focus.value)
  if (todayMon === currentMon) {
    selectedRailDay.value = todayVal
    focusedDay.value = todayVal
    if (focusTimer) clearTimeout(focusTimer)
    focusTimer = setTimeout(() => { focusedDay.value = null }, 1500)
    nextTick(() => {
      const el = document.getElementById(`forecast-day-${todayVal}`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    return
  }
  const diff = new Date(`${todayMon}T00:00:00Z`).getTime() - new Date(`${currentMon}T00:00:00Z`).getTime()
  homeWeekDrag.slideTransition(diff > 0 ? 1 : -1, () => {
    focus.value = todayVal
    selectedRailDay.value = todayVal
  })
}
const weather = ref({ loading: true, temperature: null, high: null, low: null, feels: null, humidity: null, wind: null, rain: null, label: '正在获取实时天气' })
const weatherLabel = code => ({ 0:'晴', 1:'大部晴朗', 2:'局部多云', 3:'阴', 45:'雾', 48:'雾凇', 51:'小毛毛雨', 53:'毛毛雨', 55:'大毛毛雨', 61:'小雨', 63:'中雨', 65:'大雨', 71:'小雪', 73:'中雪', 75:'大雪', 80:'阵雨', 81:'中阵雨', 82:'强阵雨', 95:'雷雨', 96:'雷雨伴冰雹', 99:'强雷雨伴冰雹' }[code] || '天气观测')
const data = reactive({ papers: [], seminars: [], library: [], books: [], talks: [] })
const state = reactive(Object.fromEntries(Object.keys(data).map(key => [key, 'loading'])))
const api = { papers: () => arxivApi.getFeed('all'), seminars: seminarApi.getSeminars, library: () => libraryApi.list('', 'all'), books: resourceApi.getBooks, talks: talkApi.list }
let alive = true, clock
async function load() {
  await Promise.all(Object.keys(api).map(async key => {
    state[key] = 'loading'
    try {
      const res = await api[key]()
      if (!alive) return
      if (!Array.isArray(res)) throw new Error('Invalid response')
      data[key] = res; state[key] = 'ready'
    } catch { if (alive) state[key] = 'error' }
  }))
  nextTick(() => {
    liquidGlassInstance?.markChanged()
  })
}
// Initialize ybouane/liquidglass: Desktop gets full WebGL liquid glass, mobile uses hardware-accelerated CSS glass
const setupLiquidGlass = () => {
  if (currentGlassStyle.value !== 'liquid' || window.innerWidth <= 768) {
    if (liquidGlassInstance) {
      try { liquidGlassInstance.destroy() } catch (e) {}
      liquidGlassInstance = null
      liquidGlassActive.value = false
    }
    return
  }
  if (!forecastDashboardRef.value) return
  const glassCards = forecastDashboardRef.value.querySelectorAll('.liquid-glass-card')
  if (liquidGlassInstance && liquidGlassInstance.glassSet.size === glassCards.length) {
    liquidGlassInstance.markChanged()
    return
  }
  if (liquidGlassInstance) {
    try { liquidGlassInstance.destroy() } catch (e) {}
    liquidGlassInstance = null
  }
  if (glassCards.length) {
    LiquidGlass.init({
      root: forecastDashboardRef.value,
      glassElements: glassCards,
      defaults: {
        blurAmount: 0.28,
        cornerRadius: 20,
        zRadius: 20,
        refraction: 0.35,
        chromAberration: 0.05,
        edgeHighlight: 0.08,
        specular: 0.0,
        fresnel: 1.0,
        brightness: -0.05,
        shadowOpacity: 0.0,
        shadowSpread: 0,
        shadowOffsetY: 0,
        button: true
      }
    }).then(inst => {
      liquidGlassInstance = inst
      liquidGlassActive.value = true
    }).catch(err => {
      console.warn('LiquidGlass init failed, falling back to CSS glass:', err)
    })
  }
}

const onAgendaUpdated = () => {
  nextTick(() => {
    setupLiquidGlass()
    liquidGlassInstance?.markChanged()
  })
}

const onLocalBgChanged = () => {
  nextTick(() => {
    liquidGlassInstance?.markChanged()
  })
}

const onAtmosphereMediaReady = () => {
  nextTick(() => {
    liquidGlassInstance?.markChanged()
  })
}

const onBgDimChanged = () => {
  nextTick(() => {
    liquidGlassInstance?.markChanged()
  })
}

watch([currentBgType, currentColorScheme], () => {
  nextTick(() => {
    liquidGlassInstance?.markChanged()
  })
})

const onGlassStyleChanged = (e) => {
  const style = e?.detail?.style || currentGlassStyle.value
  if (style === 'liquid') {
    nextTick(() => {
      setupLiquidGlass()
    })
  } else {
    if (liquidGlassInstance) {
      try { liquidGlassInstance.destroy() } catch (e) {}
      liquidGlassInstance = null
      liquidGlassActive.value = false
    }
  }
}

watch(currentGlassStyle, (val) => {
  if (val === 'liquid') {
    nextTick(() => {
      setupLiquidGlass()
    })
  } else {
    if (liquidGlassInstance) {
      try { liquidGlassInstance.destroy() } catch (e) {}
      liquidGlassInstance = null
      liquidGlassActive.value = false
    }
  }
})

const unreadArxivCount = ref(0)
const hasDirectArxiv = ref(false)

function handleArxivUnreadState(e) {
  const summary = e?.detail || getCachedArxivUnread()
  unreadArxivCount.value = Number(summary.unreadCount || 0)
  hasDirectArxiv.value = Boolean(summary.hasDirect)
}

onMounted(() => {
  load()
  const initialArxiv = getCachedArxivUnread()
  unreadArxivCount.value = initialArxiv.unreadCount
  hasDirectArxiv.value = initialArxiv.hasDirect
  window.addEventListener(ARXIV_UNREAD_EVENT, handleArxivUnreadState)
  refreshArxivUnread().then(s => {
    unreadArxivCount.value = s.unreadCount
    hasDirectArxiv.value = s.hasDirect
  })

  const weatherCtrl = new AbortController()
  const weatherTimeout = setTimeout(() => weatherCtrl.abort(), 1500)
  fetch('https://api.open-meteo.com/v1/forecast?latitude=32.12&longitude=118.96&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=1&timezone=Asia%2FShanghai', { signal: weatherCtrl.signal })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(({ current, daily }) => {
      weather.value = { loading:false, temperature:Math.round(current.temperature_2m), high:Math.round(daily?.temperature_2m_max?.[0]), low:Math.round(daily?.temperature_2m_min?.[0]), feels:Math.round(current.apparent_temperature), humidity:current.relative_humidity_2m, wind:current.wind_speed_10m, rain:daily?.precipitation_probability_max?.[0] ?? null, label:weatherLabel(current.weather_code) }
      nextTick(() => {
        liquidGlassInstance?.markChanged()
      })
    })
    .catch(() => {
      weather.value = { loading:false, temperature:24, high:28, low:19, feels:25, humidity:62, wind:12, rain:10, label: siteConfig.institution ? `晴朗 · ${siteConfig.institution}` : '晴朗 · 园区' }
    })
    .finally(() => clearTimeout(weatherTimeout))
  clock = setInterval(() => { now.value = Date.now(); today.value = shanghaiToday() }, 60000)

  nextTick(() => {
    setupLiquidGlass()
  })
  window.addEventListener('resize', setupLiquidGlass)
  window.addEventListener('agenda-updated', onAgendaUpdated)
  window.addEventListener('local-bg-changed', onLocalBgChanged)
  window.addEventListener('atmosphere-media-ready', onAtmosphereMediaReady)
  window.addEventListener('glass-style-changed', onGlassStyleChanged)
  window.addEventListener('bg-dim-changed', onBgDimChanged)
})
onBeforeUnmount(() => {
  alive = false
  clearInterval(clock)
  if (focusTimer) clearTimeout(focusTimer)
  window.removeEventListener('resize', setupLiquidGlass)
  window.removeEventListener(ARXIV_UNREAD_EVENT, handleArxivUnreadState)
  window.removeEventListener('agenda-updated', onAgendaUpdated)
  window.removeEventListener('local-bg-changed', onLocalBgChanged)
  window.removeEventListener('atmosphere-media-ready', onAtmosphereMediaReady)
  window.removeEventListener('glass-style-changed', onGlassStyleChanged)
  window.removeEventListener('bg-dim-changed', onBgDimChanged)
  if (liquidGlassInstance) {
    try {
      liquidGlassInstance.destroy()
    } catch (e) {}
    liquidGlassInstance = null
  }
})
const hasError = computed(() => Object.values(state).includes('error'))
const loading = computed(() => Object.values(state).includes('loading'))
const next = computed(() => nextSeminar(data.seminars, now.value))
const week = computed(() => Array.from({ length: 7 }, (_, i) => addDays(monday(focus.value), i)))
const weekReady = computed(() => state.seminars === 'ready' && state.talks === 'ready')
const deduplicatedTalks = computed(() => {
  const result = []
  const seen = []
  for (const t of (data.talks || [])) {
    const isConference = t.event_type === 'conference' || (t.end_date && t.end_date !== t.date)
    const normTitle = (t.title || '').replace(/^[【\[](?:学术报告|通知|讲座|报告|天体物理中心)[\]】]\s*/i, '').replace(/[\s\W_]/g, '').toLowerCase()
    const normSpeaker = (t.speaker || '').replace(/[\s\W_]/g, '').toLowerCase()
    const isDup = seen.some(st => {
      if (st.date !== t.date) return false
      if (st.isConference !== isConference) return false
      if (normTitle && st.normTitle && (normTitle === st.normTitle || normTitle.includes(st.normTitle) || st.normTitle.includes(normTitle))) return true
      if (normSpeaker && st.normSpeaker && (normSpeaker === st.normSpeaker || (normSpeaker.length >= 2 && (normSpeaker.includes(st.normSpeaker) || st.normSpeaker.includes(normSpeaker))))) return true
      return false
    })
    if (!isDup) {
      seen.push({ date: t.date, isConference, normTitle, normSpeaker })
      result.push({
        ...t,
        type: isConference ? 'conference' : 'talk',
        is_conference: isConference
      })
    }
  }
  return result
})
const daysEvents = day => {
  const daySeminars = (data.seminars || []).filter(s => s.status !== 'cancelled' && s.date === day).map(s => ({ ...s, type: 'seminar', title: s.topic }))
  const dayTalks = deduplicatedTalks.value.filter(t => {
    const start = t.date
    const end = t.end_date || t.date
    return day >= start && day <= end
  })
  return [...daySeminars, ...dayTalks].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
}
const events = computed(() => [
  ...(data.seminars || []).filter(s => s.status !== 'cancelled').map(s => ({ ...s, type: 'seminar', title: s.topic })),
  ...deduplicatedTalks.value
])
/**
 * 某项会议存在 3 个时间节点：摘要投递截止时间、注册报名截止时间（含早鸟）和会议开始时间。
 * 一项会议是否出现在首页，以及在首页出现的顺序，按这三个日期中未过期的最早时间计算。
 * （这三项日期任意一项已过时之后就不再用以作为在首页显示的依据）
 */
function getConferencePriorityInfo(conf, todayVal) {
  const candidates = []

  // 1. 摘要投递截止时间（未过时）
  if (conf.abstract_deadline && conf.abstract_deadline >= todayVal) {
    candidates.push({
      date: conf.abstract_deadline,
      type: 'abstract',
      label: '摘要投递',
      badgeLabel: '摘要'
    })
  }

  // 2. 注册报名截止时间 / 早鸟优惠截止时间（未过时）
  const regDates = []
  if (conf.early_bird_deadline && conf.early_bird_deadline >= todayVal) {
    regDates.push({
      date: conf.early_bird_deadline,
      type: 'early_bird',
      label: '早鸟优惠',
      badgeLabel: '早鸟'
    })
  }
  if (conf.registration_deadline && conf.registration_deadline >= todayVal) {
    regDates.push({
      date: conf.registration_deadline,
      type: 'registration',
      label: '注册报名',
      badgeLabel: '报名'
    })
  }
  if (regDates.length > 0) {
    regDates.sort((a, b) => a.date.localeCompare(b.date))
    candidates.push(regDates[0])
  }

  // 3. 会议开始时间（未过时）
  if (conf.date && conf.date >= todayVal) {
    candidates.push({
      date: conf.date,
      type: 'start',
      label: '会议开幕',
      badgeLabel: '开幕'
    })
  } else if ((conf.end_date || conf.date) && (conf.end_date || conf.date) >= todayVal) {
    candidates.push({
      date: conf.end_date || conf.date,
      type: 'ongoing',
      label: '进行中',
      badgeLabel: '进行中'
    })
  }

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date))
  const earliest = candidates[0]

  return {
    priorityDate: earliest.date,
    priorityType: earliest.type,
    priorityLabel: earliest.label,
    badgeLabel: earliest.badgeLabel
  }
}

const upcomingConferences = computed(() => {
  const todayVal = today.value || shanghaiToday()
  const list = []

  for (const t of deduplicatedTalks.value) {
    const isConf = t.event_type === 'conference' || (t.end_date && t.end_date !== t.date)
    if (!isConf) continue

    const priorityInfo = getConferencePriorityInfo(t, todayVal)
    if (!priorityInfo) continue

    list.push({
      ...t,
      _priority: priorityInfo
    })
  }

  // 优先级高的排在左边（最早的有效时间节点在前）
  list.sort((a, b) => {
    const pComp = a._priority.priorityDate.localeCompare(b._priority.priorityDate)
    if (pComp !== 0) return pComp
    const dComp = (a.date || '').localeCompare(b.date || '')
    if (dComp !== 0) return dComp
    return a.id - b.id
  })

  // 首页最多展示 4 张会议卡片
  return list.slice(0, 4)
})

function formatHomeConfDate(conf) {
  if (!conf?.date) return ''
  const todayYear = (today.value || shanghaiToday()).slice(0, 4)
  const start = conf.date
  const end = conf.end_date || conf.date
  const [sy, sm, sd] = start.split('-')
  const [ey, em, ed] = end.split('-')

  // 若不是本年度会议，加上两位年份前缀（如 '27.01.15）
  const yearPrefix = sy !== todayYear ? `'${sy.slice(2)}.` : ''

  if (start === end) {
    return `${yearPrefix}${sm}.${sd}`
  }
  if (sy === ey && sm === em) {
    return `${yearPrefix}${sm}.${sd} - ${ed}`
  }
  return `${yearPrefix}${sm}.${sd} - ${em}.${ed}`
}

function getHomeConfDeadlineBadge(conf) {
  const todayVal = today.value || shanghaiToday()
  const priority = conf._priority || getConferencePriorityInfo(conf, todayVal)
  if (!priority) return null

  const targetDate = priority.priorityDate
  const [y1, m1, d1] = targetDate.split('-').map(Number)
  const [y2, m2, d2] = todayVal.split('-').map(Number)
  const diff = Math.round((Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / (1000 * 60 * 60 * 24))

  // 如果优先级依据是截止日期（摘要或报名）
  if (priority.priorityType === 'abstract' || priority.priorityType === 'early_bird' || priority.priorityType === 'registration') {
    const prefix = priority.badgeLabel
    if (diff <= 7) {
      return {
        text: diff === 0 ? `${prefix}今天截止` : diff === 1 ? `${prefix}明天截止` : `${prefix}仅剩 ${diff} 天`,
        isUrgent: true
      }
    }
    const shortDate = `${targetDate.slice(5, 7)}.${targetDate.slice(8, 10)}`
    return {
      text: `${prefix} ${shortDate} 截止`,
      isUrgent: false
    }
  }

  // 如果优先级依据是会议开幕时间
  if (priority.priorityType === 'start') {
    if (diff <= 7) {
      return {
        text: diff === 0 ? '今天开幕' : diff === 1 ? '明天开幕' : `${diff} 天后开幕`,
        isUrgent: true
      }
    }
  } else if (priority.priorityType === 'ongoing') {
    return {
      text: '正在举行',
      isUrgent: true
    }
  }

  return null
}
const weekEvents = computed(() => week.value.flatMap(day => daysEvents(day)))
const weekTalks = computed(() => weekEvents.value.filter(e => e.type === 'talk' || e.type === 'conference').length)
const weekday = value => new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`))

const showPastDays = ref(false)
const selectedRailDay = ref(today.value)
const focusedDay = ref(null)

const isCurrentWeek = computed(() => monday(focus.value) === monday(today.value))
const pastDays = computed(() => isCurrentWeek.value ? week.value.filter(day => day < today.value) : [])
const pastDaysCount = computed(() => pastDays.value.length)
const pastEventsCount = computed(() => pastDays.value.reduce((sum, d) => sum + daysEvents(d).length, 0))
const pastDaysRangeText = computed(() => {
  if (!pastDaysCount.value) return ''
  const first = weekday(pastDays.value[0])
  const last = weekday(pastDays.value[pastDays.value.length - 1])
  const range = pastDaysCount.value === 1 ? first : `${first}至${last}`
  const eventText = pastEventsCount.value > 0 ? ` · 含 ${pastEventsCount.value} 场安排` : ''
  return `${range} · ${pastDaysCount.value}天${eventText}`
})

watch(focus, newFocus => {
  showPastDays.value = false
  focusedDay.value = null
  selectedRailDay.value = (monday(newFocus) === monday(today.value)) ? today.value : week.value[0]
})

function onRailDayClick(day) {
  selectedRailDay.value = day
  if (isCurrentWeek.value && day < today.value) {
    showPastDays.value = true
  }
  focusedDay.value = day
  if (focusTimer) clearTimeout(focusTimer)
  focusTimer = setTimeout(() => {
    focusedDay.value = null
  }, 1500)
  nextTick(() => {
    const el = document.getElementById(`forecast-day-${day}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

const prettyDate = computed(() => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'UTC' }).format(new Date(`${today.value}T12:00:00Z`)))
const count = (key, unit) => state[key] === 'ready' ? `${data[key].length} ${unit}` : state[key] === 'error' ? '暂不可用' : '读取中…'
const quickLinks = computed(() => [
  { to: '/arxiv', icon: 'file-text', label: '文献推荐', note: '发现值得一起读的论文', count: count('papers', '篇') },
  { to: '/mailbox', icon: 'envelope', label: '学术邮箱', note: '查收学术邮件与研讨通知', count: 'POP3 / IMAP' },
  { to: '/library', icon: 'book-open', label: '文献库', note: '让每次讨论留下记录', count: count('library', '篇') },
  { to: '/resources', icon: 'database', label: '教材与资料', note: '常用专著、讲义与代码', count: count('books', '册') },
])
const calendarLink = date => ({ path: '/seminars', query: { view: 'week', date } })
function onDayClick(e, day) {
  if (homeWeekDrag.isDragging.value || Math.abs(homeWeekDrag.dragOffset.value) > 12) {
    e.preventDefault()
    e.stopPropagation()
    return
  }
}
</script>
<template>
  <div class="forecast-home">
    <header class="forecast-topline">
      <NoticeMarquee />
      <span class="home-date">{{ prettyDate }}</span>
    </header>

    <p v-if="hasError" class="home-error" role="status">部分数据暂时无法读取。<button :disabled="loading" @click="load">重新加载</button></p>
    <div
      ref="forecastDashboardRef"
      class="forecast-dashboard"
      :class="{ 'liquid-glass-active': liquidGlassActive }"
    >
      <section class="forecast-main">
        <div class="forecast-intro">
          <h1 class="group-title-heading">
            <span>{{ siteConfig.labName || '科研协作平台' }}</span>
            <img
              v-if="isMidAutumn"
              src="/assets/icons/moon.svg"
              alt="中秋明月"
              class="mid-autumn-moon-badge"
              title="中秋快乐"
            />
          </h1>
          <p class="group-name-en">{{ siteConfig.siteSlogan || 'Frontier Interdisciplinary Science & Computing Workspace' }}</p>
          <div class="forecast-actions">
            <router-link :to="calendarLink(today)" class="perfect-goat-btn">
              <span class="goat-text">打开学术日程</span>
              <div class="goat-icon">
                <svg
                  height="16"
                  width="16"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M0 0h24v24H0z" fill="none"></path>
                  <path
                    d="M16.172 11l-5.364-5.364 1.414-1.414L20 12l-7.778 7.778-1.414-1.414L16.172 13H4v-2z"
                    fill="currentColor"
                  ></path>
                </svg>
              </div>
            </router-link>
            <SilentLizardButton label="推荐一篇文献" @click="router.push('/quick-share')" />
          </div>
        </div>
        <PersonalAgenda />
        <section class="home-week" aria-label="每周科研日程">
          <header class="home-section-heading">
            <div>
              <span class="eyebrow">YOUR WEEK, AT A GLANCE</span>
              <h2>{{ monday(focus) === monday(today) ? '本周日程' : '每周日程' }}<span>{{ weekReady ? `${weekEvents.length} 场安排 · ${weekTalks} 场报告` : '组会与报告' }}</span></h2>
            </div>
            <div class="home-week-controls">
              <SeminarReminders />
              <button class="icon-button" aria-label="上一周" title="上一周（亦可按住日程左右拖动）" @click="homeWeekDrag.slidePrev()"><AppIcon name="left" :size="17" /></button>
              <button class="button small ghost" @click="goToThisWeek">本周</button>
              <button class="icon-button" aria-label="下一周" title="下一周（亦可按住日程左右拖动）" @click="homeWeekDrag.slideNext()"><AppIcon name="right" :size="17" /></button>
            </div>
          </header>
          <p class="home-week-range">{{ week[0] }} — {{ week[6] }} · 北京时间</p>
          <div
            ref="homeWeekDrag.containerRef"
            class="home-week-slider-wrapper"
            :class="{ 'is-dragging': homeWeekDrag.isDragging.value }"
            @pointerdown="homeWeekDrag.onPointerDown"
            @wheel="homeWeekDrag.onWheel"
            @click.capture="homeWeekDrag.handleCaptureClick"
          >
            <div
              v-if="homeWeekDrag.isDragging.value"
              class="home-week-drag-indicator left"
              :class="{ active: homeWeekDrag.dragDirection.value === 'prev' && homeWeekDrag.isThresholdMet.value }"
              :style="{ opacity: Math.min(1, Math.max(0, homeWeekDrag.dragOffset.value / 35)) }"
            >
              <AppIcon name="left" :size="15" />
              <span>{{ homeWeekDrag.isThresholdMet.value && homeWeekDrag.dragDirection.value === 'prev' ? '释放查看上周' : '上一周' }}</span>
            </div>

            <div
              v-if="homeWeekDrag.isDragging.value"
              class="home-week-drag-indicator right"
              :class="{ active: homeWeekDrag.dragDirection.value === 'next' && homeWeekDrag.isThresholdMet.value }"
              :style="{ opacity: Math.min(1, Math.max(0, -homeWeekDrag.dragOffset.value / 35)) }"
            >
              <span>{{ homeWeekDrag.isThresholdMet.value && homeWeekDrag.dragDirection.value === 'next' ? '释放查看下周' : '下一周' }}</span>
              <AppIcon name="right" :size="15" />
            </div>

            <div
              ref="homeWeekDrag.trackRef"
              class="home-week-slider-track"
              :style="homeWeekDrag.trackStyle.value"
            >
              <!-- 手机端 7 日横向快速导航条 -->
              <div class="home-week-mobile-rail" aria-label="周日程快速跳转">
                <div class="mobile-rail-track">
                  <button
                    v-for="day in week"
                    :key="'rail-' + day"
                    type="button"
                    class="rail-item"
                    :class="{ 'is-today': day === today, active: selectedRailDay === day }"
                    :aria-label="`${day} ${weekday(day)}`"
                    @click="onRailDayClick(day)"
                  >
                    <span class="r-name">{{ weekday(day).slice(-1) }}</span>
                    <span class="r-num">{{ day.slice(8) }}</span>
                    <span v-if="daysEvents(day).length" class="r-dot"></span>
                  </button>
                </div>
              </div>

              <!-- 手机端 已过日程折叠开关（仅在本周且已过天数大于0时显示） -->
              <button
                v-if="isCurrentWeek && pastDaysCount > 0"
                type="button"
                class="past-days-toggle-btn"
                :class="{ expanded: showPastDays }"
                :aria-expanded="showPastDays"
                @click="showPastDays = !showPastDays"
              >
                <div class="toggle-left">
                  <AppIcon name="clock" :size="14" />
                  <span>{{ showPastDays ? '收起已过日程' : '查看已过日程' }} ({{ pastDaysRangeText }})</span>
                </div>
                <AppIcon name="down" :size="14" class="toggle-arrow" />
              </button>

              <div class="forecast-week-grid">
                <router-link
                  v-for="day in week"
                  :id="'forecast-day-' + day"
                  :key="day"
                  :to="calendarLink(day)"
                  class="forecast-day"
                  :class="{
                    today: day === today,
                    scheduled: daysEvents(day).length,
                    'is-past-day': isCurrentWeek && day < today,
                    'show-past': showPastDays,
                    'is-focused': focusedDay === day
                  }"
                  :aria-label="`${day} ${weekday(day)}，查看日程`"
                  @click="onDayClick($event, day)"
                >
                  <span class="day-name">{{ weekday(day) }}</span><span class="day-number">{{ day.slice(8) }}<span v-if="day === today" class="today-dot"></span></span>
                  <div class="day-markers" aria-hidden="true"><span v-for="e in daysEvents(day).slice(0, 3)" :key="`${e.type}-${e.id}`" :class="e.type"></span></div>
                  <span class="day-summary" :class="{ 'is-holiday': !daysEvents(day).length && getHoliday(day) }">{{ !weekReady ? '—' : daysEvents(day).length ? `${daysEvents(day).length} 场安排` : (getHoliday(day) || '暂无安排') }}</span>
                </router-link>
              </div>
            </div>
          </div>
        </section>

        <!-- 近期学术会议模块（置于本周日程下侧） -->
        <section
          class="glass-card home-conf-section liquid-glass-card"
          aria-label="近期学术会议"
        >
          <div class="home-conf-heading">
            <div class="heading-left">
              <AppIcon name="calendar" :size="18" />
              <span>近期学术会议</span>
            </div>
            <router-link to="/seminars?tab=conferences" class="conf-top-link" title="进入学术会议专区">
              <span>查看全部会议</span>
              <AppIcon name="right" :size="15" />
            </router-link>
          </div>

          <div v-if="upcomingConferences.length > 0" class="home-conf-grid" :class="`grid-cols-${upcomingConferences.length}`">
            <router-link
              v-for="conf in upcomingConferences"
              :key="conf.id"
              :to="{ path: '/seminars', query: { tab: 'conferences', conferenceId: conf.id } }"
              class="home-conf-card-item"
              :title="conf.title"
            >
              <div class="home-conf-item-top">
                <span class="conf-item-date mono">{{ formatHomeConfDate(conf) }}</span>
                <span v-if="conf.city" class="conf-item-city">{{ conf.city }}</span>
                <span v-else-if="conf.sub_type" class="conf-item-badge">{{ conf.sub_type }}</span>
                <span
                  v-if="getHomeConfDeadlineBadge(conf)"
                  class="conf-item-urgent"
                  :class="{ 'is-urgent': getHomeConfDeadlineBadge(conf).isUrgent }"
                >
                  <AppIcon :name="getHomeConfDeadlineBadge(conf).isUrgent ? 'warning' : 'clock'" :size="11" />
                  <span>{{ getHomeConfDeadlineBadge(conf).text }}</span>
                </span>
              </div>
              <h3 class="home-conf-item-title">{{ conf.title }}</h3>
              <div class="home-conf-item-location" v-if="conf.location || conf.organizer || conf.speaker">
                <AppIcon name="location" :size="12" />
                <span>{{ conf.location || conf.organizer || conf.speaker }}</span>
              </div>
            </router-link>
          </div>

          <div v-else class="conf-mini-empty">
            <p>近期暂无即将举行的学术会议</p>
          </div>
        </section>
      </section>
      <aside
        ref="forecastRightRef"
        class="forecast-right"
        :class="{ 'liquid-glass-active': liquidGlassActive }"
        aria-label="近期组会与工作区入口"
      >
        <router-link
          :to="next ? { path: '/seminars', query: { seminar: next.id } } : '/seminars'"
          class="glass-card next-meeting liquid-glass-card"
        >
          <div class="next-heading"><span><AppIcon name="calendar" :size="18" />最近一次组会</span><AppIcon name="external" :size="18" /></div>
          <template v-if="state.seminars === 'ready' && next">
            <div class="next-date"><span>{{ next.date.slice(8) }}</span><div>{{ Number(next.date.slice(5, 7)) }} 月<small>{{ weekday(next.date) }} · {{ next.time }}</small></div></div>
            <h2>{{ next.topic }}</h2><p class="next-presenter">主讲 · {{ next.presenter_name }}</p>
            <div class="next-meta"><p><AppIcon name="location" :size="16" />{{ next.location || '地点待补充' }}</p><p><AppIcon name="user" :size="16" />文献分享 · {{ next.presentations?.map(p => p.presenter_name).join('、') || '暂未安排' }}</p></div>
          </template>
          <div v-else class="next-empty"><AppIcon name="calendar" :size="36" /><h2>{{ state.seminars === 'loading' ? '正在读取排期' : state.seminars === 'error' ? '暂时无法读取' : '留一点时间，交流新想法。' }}</h2><p>{{ state.seminars === 'ready' ? '暂未安排下一次组会' : '可进入组会页面查看或重试' }}</p></div>
          <span class="next-bottom">查看组会议程<AppIcon name="right" :size="17" /></span>
        </router-link>
        <section
          class="glass-card weather-card liquid-glass-card"
          data-config='{"button":false}'
          aria-label="天气模块"
        >
          <div class="next-heading"><span>今日天气</span><span class="weather-place">{{ weatherLocation }} · {{ weather.label }}</span></div>
          <div class="weather-reading"><div><strong>{{ weather.temperature === null ? '—' : `${weather.temperature}°` }}</strong><span>{{ weather.temperature === null ? '无法获取实时数据' : `体感 ${weather.feels}°` }}</span></div><strong class="weather-range">{{ weather.low === null || weather.high === null ? '—' : `${weather.low}°—${weather.high}°` }}</strong></div>
          <div class="weather-meta"><span>湿度 {{ weather.humidity === null ? '—' : `${weather.humidity}%` }}</span><span>风速 {{ weather.wind === null ? '—' : `${weather.wind} km/h` }}</span><span>降水概率 {{ weather.rain === null ? '—' : `${weather.rain}%` }}</span></div>
        </section>
        <router-link
          v-for="item in quickLinks.slice(2)"
          :key="item.to"
          :to="item.to"
          class="glass-card quick-destination liquid-glass-card"
        >
          <div><span class="destination-label"><AppIcon :name="item.icon" :size="17" />{{ item.label }}</span><p>{{ item.note }}</p></div><span class="destination-count">{{ item.count }}<AppIcon name="external" :size="16" /></span>
        </router-link>
        <div class="secondary-quick-links">
          <router-link
            v-for="item in quickLinks.slice(0, 2)"
            :key="item.to"
            :to="item.to"
            class="glass-card quick-destination liquid-glass-card"
            @click="item.to === '/arxiv' && markArxivFeedViewed()"
          >
            <div><span class="destination-label"><AppIcon :name="item.icon" :size="17" />{{ item.label }}</span><p>{{ item.note }}</p></div><span class="destination-count"><span v-if="item.to === '/arxiv' && unreadArxivCount > 0" class="home-arxiv-badge" :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }">{{ unreadArxivCount > 99 ? '99+' : unreadArxivCount }}</span>{{ item.count }}<AppIcon name="external" :size="16" /></span>
          </router-link>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.group-title-heading {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
}
.mid-autumn-moon-badge {
  display: inline-block;
  width: clamp(34px, 3.8vw, 54px);
  height: clamp(34px, 3.8vw, 54px);
  flex-shrink: 0;
  vertical-align: middle;
  filter: drop-shadow(0 0 14px rgba(255, 240, 140, 0.65));
  animation: mid-autumn-moon-glow 4s ease-in-out infinite alternate;
  user-select: none;
  pointer-events: none;
}
@keyframes mid-autumn-moon-glow {
  0% {
    filter: drop-shadow(0 0 8px rgba(255, 230, 100, 0.45));
    transform: scale(1);
  }
  100% {
    filter: drop-shadow(0 0 18px rgba(255, 245, 160, 0.85));
    transform: scale(1.05);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mid-autumn-moon-badge {
    animation: none;
  }
}
.home-week-slider-wrapper {
  position: relative;
  overflow: hidden;
  touch-action: pan-y;
  cursor: grab;
  user-select: none;
  border-radius: 16px;
  padding: 4px 0;
}
.home-week-slider-wrapper.is-dragging {
  cursor: grabbing !important;
}
.home-week-slider-wrapper.is-dragging * {
  cursor: grabbing !important;
  user-select: none !important;
}
.home-week-slider-track {
  width: 100%;
}
.home-week-mobile-rail {
  display: none;
}
.past-days-toggle-btn {
  display: none;
}
.home-week-drag-indicator {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 20;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: var(--panel-solid, rgba(12, 10, 26, 0.94));
  border: 1.5px solid var(--line, rgba(184, 155, 248, 0.3));
  color: var(--soft);
  font-size: 12.5px;
  font-weight: 600;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  pointer-events: none;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  transition: border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
}
.home-week-drag-indicator.left {
  left: 20px;
}
.home-week-drag-indicator.right {
  right: 20px;
}
.home-week-drag-indicator.active {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--raised, rgba(18, 14, 38, 0.98));
  box-shadow: 0 0 20px var(--line, rgba(184, 155, 248, 0.45));
  transform: translateY(-50%) scale(1.08);
}

.home-conf-section {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  gap: 10px;
  margin-top: 0;
}

.home-conf-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.home-conf-heading .heading-left {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--text);
}

.conf-top-link {
  color: var(--soft);
  font-size: 12px;
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: color 0.2s ease;
}

.conf-top-link:hover {
  color: var(--accent);
}

.home-conf-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.home-conf-grid.grid-cols-1 {
  grid-template-columns: 1fr;
}

.home-conf-grid.grid-cols-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.home-conf-grid.grid-cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-conf-grid.grid-cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.home-conf-card-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 9px 11px;
  background: var(--surface, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 11px;
  text-decoration: none;
  color: inherit;
  min-width: 0;
  transition: all 0.2s ease;
}

.home-conf-card-item:hover {
  border-color: var(--accent);
  background: var(--surface-hover, rgba(255, 255, 255, 0.06));
  transform: translateY(-1px);
}

.home-conf-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
}

.conf-item-date {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}

.conf-item-city {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.12);
  color: #38bdf8;
  border: 1px solid rgba(56, 189, 248, 0.2);
  white-space: nowrap;
}

.conf-item-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--text-muted);
  white-space: nowrap;
}

.conf-item-urgent {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--soft);
  margin-left: auto;
  white-space: nowrap;
}

.conf-item-urgent.is-urgent {
  color: #f59e0b;
}

.home-conf-item-title {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.36;
  margin: 0;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 2.72em;
}

.home-conf-item-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: auto;
}

.conf-mini-empty {
  padding: 12px 0;
  color: var(--soft);
  font-size: 12.5px;
  text-align: center;
}

.conf-mini-empty p {
  margin: 0;
}

@media (max-width: 768px) {
  .home-conf-grid.grid-cols-3,
  .home-conf-grid.grid-cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .home-conf-grid,
  .home-conf-grid.grid-cols-2,
  .home-conf-grid.grid-cols-3,
  .home-conf-grid.grid-cols-4 {
    grid-template-columns: 1fr;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .forecast-dashboard {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .forecast-main,
  .forecast-right {
    display: contents;
  }

  /* 聚焦日程流顺序重排：导言 -> 最近组会 -> 个人待办 -> 今日天气 -> 本周日程瀑布流 -> 近期学术会议 -> 快捷入口 */
  .forecast-intro {
    order: 1;
  }
  .next-meeting {
    order: 2;
    width: 100%;
  }
  :deep(.personal-agenda) {
    order: 3;
    width: 100%;
  }
  .weather-card {
    order: 4;
    width: 100%;
  }
  .home-week {
    order: 5;
    width: 100%;
  }
  .home-conf-section {
    order: 6;
    width: 100%;
    margin-top: 0;
  }
  .quick-destination,
  .secondary-quick-links {
    order: 7;
    width: 100%;
  }
  .secondary-quick-links {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  /* 周日程单列瀑布流 */
  .home-week-drag-indicator {
    padding: 6px 12px;
    font-size: 11.5px;
  }
  .home-week-drag-indicator.left {
    left: 8px;
  }
  .home-week-drag-indicator.right {
    right: 8px;
  }

  /* 手机端 7 日快捷横向导航条 */
  .home-week-mobile-rail {
    display: block;
    margin: 0 0 10px;
    padding: 5px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 14px;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  .mobile-rail-track {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 4px;
  }
  .rail-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 7px 2px;
    border-radius: 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--soft);
    cursor: pointer;
    position: relative;
    font-family: inherit;
    transition: all 0.18s ease;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .rail-item:active {
    transform: scale(0.94);
  }
  .rail-item .r-name {
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1.2;
    margin-bottom: 3px;
  }
  .rail-item .r-num {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.1;
    color: var(--text);
  }
  .rail-item.is-today {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
  }
  .rail-item.is-today .r-name,
  .rail-item.is-today .r-num {
    color: var(--accent);
  }
  .rail-item.active:not(.is-today) {
    border-color: color-mix(in srgb, var(--accent) 35%, var(--line));
    background: color-mix(in srgb, var(--accent) 8%, var(--panel));
    color: var(--text);
  }
  .rail-item .r-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    margin-top: 3px;
  }

  /* 手机端 已过日程折叠按钮 */
  .past-days-toggle-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 10px 14px;
    background: color-mix(in srgb, var(--panel) 85%, transparent);
    border: 1px dashed var(--line);
    border-radius: 12px;
    color: var(--soft);
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.2s ease;
    margin-bottom: 8px;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
  }
  .past-days-toggle-btn:active {
    background: var(--panel);
    border-color: var(--accent);
  }
  .past-days-toggle-btn .toggle-left {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .past-days-toggle-btn .toggle-arrow {
    transition: transform 0.25s ease;
    display: inline-flex;
  }
  .past-days-toggle-btn.expanded .toggle-arrow {
    transform: rotate(180deg);
  }

  /* 手机端 已过日程折叠与聚焦高亮 */
  .forecast-day.is-past-day {
    display: none;
  }
  .forecast-day.is-past-day.show-past {
    display: flex;
  }
  .forecast-day.is-focused {
    border-color: var(--accent) !important;
    box-shadow: 0 0 0 1px var(--accent), 0 4px 16px rgba(0, 0, 0, 0.15);
  }

  .forecast-week-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .forecast-day {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--panel);
    border: 1px solid var(--line);
    min-height: 52px;
    text-decoration: none;
    transition: background 0.18s ease, border-color 0.18s ease;
  }
  .forecast-day:active {
    background: var(--raised);
  }
  .forecast-day.today {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 12%, var(--panel));
  }
  .forecast-day .day-name {
    font-size: 13.5px;
    font-weight: 600;
    min-width: 44px;
    color: var(--soft);
  }
  .forecast-day .day-number {
    font-size: 16px;
    font-weight: 700;
    margin-left: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--text);
  }
  .forecast-day .today-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 8px var(--accent);
  }
  .forecast-day .day-markers {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-left: auto;
    margin-right: 14px;
  }
  .forecast-day .day-summary {
    font-size: 12px;
    color: var(--soft);
    white-space: nowrap;
  }
  .forecast-day .day-summary.is-holiday {
    color: var(--accent);
    font-weight: 600;
  }

  /* 手机端专用：卡片边框与按钮质感深度适配 */
  .home-primary-links .glass-card,
  .forecast-right .glass-card,
  .personal-agenda .glass-card,
  .glass-card {
    border-color: var(--line) !important;
  }

  [data-color-scheme="obsidian-gray"] .forecast-actions .perfect-goat-btn,
  [data-color-scheme="obsidian-gray"] .forecast-actions :deep(.btn-silent-lizard) {
    background: linear-gradient(135deg, #a6b7cc 0%, #7d90a6 100%) !important;
    border-color: #b0c0d4 !important;
    color: #070e18 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 16px rgba(166, 183, 204, 0.35) !important;
    font-weight: 600;
  }
  [data-color-scheme="obsidian-gray"] .forecast-actions .perfect-goat-btn .goat-text {
    color: #070e18 !important;
  }
  [data-color-scheme="obsidian-gray"] .forecast-actions .perfect-goat-btn .goat-icon {
    background: rgba(7, 14, 24, 0.18) !important;
    color: #070e18 !important;
  }

  [data-color-scheme="nebula-purple"] .forecast-actions .perfect-goat-btn,
  [data-color-scheme="nebula-purple"] .forecast-actions :deep(.btn-silent-lizard) {
    background: linear-gradient(135deg, #c084fc 0%, #9333ea 100%) !important;
    border-color: #c084fc !important;
    color: #070314 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 18px rgba(192, 132, 252, 0.45) !important;
    font-weight: 600;
  }
  [data-color-scheme="nebula-purple"] .forecast-actions .perfect-goat-btn .goat-text {
    color: #070314 !important;
  }
  [data-color-scheme="nebula-purple"] .forecast-actions .perfect-goat-btn .goat-icon {
    background: rgba(7, 3, 20, 0.22) !important;
    color: #070314 !important;
  }

  [data-color-scheme="classic-cyan"] .forecast-actions .perfect-goat-btn,
  [data-color-scheme="classic-cyan"] .forecast-actions :deep(.btn-silent-lizard) {
    background: linear-gradient(135deg, #c5e6df 0%, #7dbfb3 100%) !important;
    border-color: #c5e6df !important;
    color: #081f28 !important;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 16px rgba(197, 230, 223, 0.35) !important;
    font-weight: 600;
  }
  [data-color-scheme="classic-cyan"] .forecast-actions .perfect-goat-btn .goat-text {
    color: #081f28 !important;
  }
  [data-color-scheme="classic-cyan"] .forecast-actions .perfect-goat-btn .goat-icon {
    background: rgba(8, 31, 40, 0.22) !important;
    color: #081f28 !important;
  }
}

/* perfect-goat-80 按钮方案 (From Uiverse.io by R1SH4BH81，未触发动效前与右侧推荐文献按钮外观保持一致) */
.perfect-goat-btn {
  background: var(--accent, #b89bf8);
  color: var(--accent-ink, #070314);
  font-family: inherit;
  border: 2px solid var(--accent, #b89bf8);
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  border-radius: 12px;
  letter-spacing: 0.02em;
  display: inline-flex;
  align-items: center;
  overflow: hidden;
  position: relative;
  height: 46px;
  min-height: 46px;
  padding-left: 20px;
  padding-right: 48px;
  cursor: pointer;
  text-decoration: none;
  box-sizing: border-box;
  box-shadow: 0 0 14px color-mix(in srgb, var(--accent, #b89bf8) 35%, transparent);
  transition: all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
  user-select: none;
  white-space: nowrap;
}
.perfect-goat-btn .goat-text {
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--accent-ink, #070314);
  transition: color 0.3s ease;
}
.perfect-goat-btn .goat-icon {
  background: rgba(7, 3, 20, 0.16);
  color: var(--accent-ink, #070314);
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  width: 32px;
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.2, 0.9, 0.3, 1);
  will-change: transform;
}
.perfect-goat-btn:hover {
  background-color: color-mix(in srgb, var(--accent, #b89bf8) 16%, transparent);
  color: var(--accent, #b89bf8);
  border-color: var(--accent, #b89bf8);
  box-shadow: 0 0 24px color-mix(in srgb, var(--accent, #b89bf8) 50%, transparent);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.perfect-goat-btn:hover .goat-text {
  color: var(--accent, #b89bf8);
}
.perfect-goat-btn:hover .goat-icon {
  background: var(--accent, #b89bf8);
  color: var(--accent-ink, #070314);
}
.perfect-goat-btn .goat-icon svg {
  width: 15px;
  height: 15px;
  transition: transform 0.3s ease-out;
  will-change: transform;
}
.perfect-goat-btn:hover .goat-icon svg {
  transform: translateX(1.5px) rotate(-25deg);
}
.perfect-goat-btn:active {
  transform: scale(0.97);
}
.perfect-goat-btn:active .goat-icon {
  transform: translateY(-50%) scale(0.92);
}

/* ==========================================================================
   水波云雾风格还原 (Vanta Fog / Clouds Static)
   ========================================================================== */
[data-theme-style="vanta-fog"] .home-week-drag-indicator {
  background: rgba(14, 36, 44, 0.94) !important;
  border: 1.5px solid rgba(197, 230, 223, 0.3) !important;
}

[data-theme-style="vanta-fog"] .home-week-drag-indicator.active {
  background: rgba(18, 48, 56, 0.98) !important;
  box-shadow: 0 0 20px rgba(197, 230, 223, 0.45) !important;
}

[data-theme-style="vanta-fog"] .forecast-day.today {
  background: rgba(197, 230, 223, 0.08) !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn {
  background: var(--accent, #c5e6df) !important;
  color: #0e2b31 !important;
  border-color: var(--accent, #c5e6df) !important;
  box-shadow: 0 0 14px rgba(197, 230, 223, 0.3) !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn .goat-text {
  color: #0e2b31 !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn .goat-icon {
  background: rgba(14, 43, 49, 0.12) !important;
  color: #0e2b31 !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn:hover {
  background-color: rgba(197, 230, 223, 0.16) !important;
  color: var(--accent, #c5e6df) !important;
  border-color: var(--accent, #c5e6df) !important;
  box-shadow: 0 0 24px rgba(197, 230, 223, 0.5) !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn:hover .goat-text {
  color: var(--accent, #c5e6df) !important;
}

[data-theme-style="vanta-fog"] .perfect-goat-btn:hover .goat-icon {
  background: var(--accent, #c5e6df) !important;
  color: #0e2b31 !important;
}

.home-arxiv-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 17px;
  height: 17px;
  padding: 0 4px;
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  margin-right: 6px;
  vertical-align: middle;
}
.home-arxiv-badge.is-red {
  background: #ef4444;
  background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%);
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(225, 29, 72, 0.45);
}
.home-arxiv-badge.is-gold {
  background: #f59e0b;
  background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
  color: #1c1917;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.6), 0 0 10px rgba(251, 191, 36, 0.4);
}
</style>
