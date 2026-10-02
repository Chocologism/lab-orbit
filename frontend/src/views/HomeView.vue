<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import PersonalAgenda from '../components/PersonalAgenda.vue'
import SeminarReminders from '../components/SeminarReminders.vue'
import SilentLizardButton from '../components/SilentLizardButton.vue'
import NoticeMarquee from '../components/NoticeMarquee.vue'

import { arxivApi, libraryApi, mailboxApi, resourceApi, seminarApi, talkApi } from '../api/client'
import { refreshArxivUnread, getCachedArxivUnread, clearArxivUnread, markArxivFeedViewed, ARXIV_UNREAD_EVENT } from '../utils/arxivUnread'
import { addDays, monday, nextSeminar, shanghaiToday, sortSeminars } from '../utils/schedule'
import { getHoliday } from '../utils/holidays'
import { isMidAutumnFestival } from '../utils/midAutumn'
import { isNationalDayHoliday } from '../utils/nationalDay'
import { LiquidGlass } from '../libs/liquidglass'
import { useWeekDrag } from '../composables/useWeekDrag'
import { currentBgType, currentColorScheme, currentGlassStyle } from '../composables/useThemeStyle'
import HomeWidgetRenderer from '../components/widgets/HomeWidgetRenderer.vue'
import HomeWidgetAddDrawer from '../components/HomeWidgetAddDrawer.vue'
import { useHomeGridEngine } from '../composables/useHomeGridEngine'
import { useSiteConfig } from '../composables/useSiteConfig'
import { isDemoMode } from '../mock/isDemo'
import { DEMO_FROZEN_TIME_MS } from '../utils/schedule'

const router = useRouter()
const { siteConfig } = useSiteConfig()
const isMidAutumn = computed(() => isMidAutumnFestival())
const isNationalDay = computed(() => isNationalDayHoliday())
const weatherLocation = computed(() => siteConfig.institution ? siteConfig.institution : '学术园区')
const today = ref(shanghaiToday()), focus = ref(today.value), now = ref(isDemoMode() ? DEMO_FROZEN_TIME_MS : Date.now())
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
const weatherLabel = code => ({ 0:'晴', 1:'多云', 2:'多云', 3:'阴', 45:'雾', 48:'雾凇', 51:'毛毛雨', 53:'毛毛雨', 55:'毛毛雨', 61:'小雨', 63:'中雨', 65:'大雨', 71:'小雪', 73:'中雪', 75:'大雪', 80:'阵雨', 81:'中阵雨', 82:'强阵雨', 95:'雷雨', 96:'雷雨', 99:'强雷雨' }[code] || '天气观测')
const data = reactive({ papers: [], seminars: [], library: [], books: [], talks: [] })
const mailboxEmails = ref([])
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
  syncHomeGridLayoutFromCloud()
  const initialArxiv = getCachedArxivUnread()
  unreadArxivCount.value = initialArxiv.unreadCount
  hasDirectArxiv.value = initialArxiv.hasDirect
  window.addEventListener(ARXIV_UNREAD_EVENT, handleArxivUnreadState)
  refreshArxivUnread().then(s => {
    unreadArxivCount.value = s.unreadCount
    hasDirectArxiv.value = s.hasDirect
  })

  mailboxApi.getEmails({ refresh: false })
    .then(res => {
      if (Array.isArray(res)) mailboxEmails.value = res
    })
    .catch(() => {})

  const weatherCtrl = new AbortController()
  const weatherTimeout = setTimeout(() => weatherCtrl.abort(), 2500)
  fetch('https://api.open-meteo.com/v1/forecast?latitude=32.12&longitude=118.96&current=temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=4&timezone=Asia%2FShanghai', { signal: weatherCtrl.signal })
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(({ current, daily, hourly }) => {
      const processedDaily = (daily?.time || []).slice(0, 4).map((d, i) => {
        const m = Number(d.slice(5, 7))
        const dayNum = d.slice(8, 10)
        return {
          date: d,
          dateText: `${m}.${dayNum}`,
          dayName: i === 0 ? '今天' : i === 1 ? '明天' : i === 2 ? '后天' : '大后天',
          high: Math.round(daily.temperature_2m_max?.[i] ?? 26),
          low: Math.round(daily.temperature_2m_min?.[i] ?? 18),
          rain: daily.precipitation_probability_max?.[i] ?? 0,
          label: weatherLabel(daily.weather_code?.[i] ?? 0)
        }
      })

      let processedHourly = []
      if (hourly?.time?.length) {
        const shanghaiNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }))
        const nowHour = shanghaiNow.getHours()
        const todayStr = shanghaiToday()
        const startIdx = hourly.time.findIndex(t => t.startsWith(todayStr) && Number(t.slice(11, 13)) >= nowHour)
        const validIdx = startIdx >= 0 ? startIdx : 0
        processedHourly = hourly.time.slice(validIdx, validIdx + 8).map((t, idx) => {
          const realIdx = validIdx + idx
          return {
            time: t.slice(11, 16),
            temp: Math.round(hourly.temperature_2m?.[realIdx] ?? 22),
            rain: hourly.precipitation_probability?.[realIdx] ?? 0,
            label: weatherLabel(hourly.weather_code?.[realIdx] ?? 0)
          }
        })
      }

      weather.value = {
        loading: false,
        temperature: Math.round(current.temperature_2m),
        high: Math.round(daily?.temperature_2m_max?.[0] ?? 28),
        low: Math.round(daily?.temperature_2m_min?.[0] ?? 19),
        feels: Math.round(current.apparent_temperature),
        humidity: current.relative_humidity_2m,
        wind: current.wind_speed_10m,
        rain: daily?.precipitation_probability_max?.[0] ?? 0,
        label: weatherLabel(current.weather_code),
        daily: processedDaily,
        hourly: processedHourly
      }
      nextTick(() => {
        liquidGlassInstance?.markChanged()
      })
    })
    .catch(() => {
      weather.value = {
        loading: false,
        temperature: 24,
        high: 28,
        low: 19,
        feels: 25,
        humidity: 62,
        wind: 12,
        rain: 10,
        label: siteConfig.institution ? `晴朗 · ${siteConfig.institution}` : '晴朗 · 园区',
        daily: [
          { dayName: '今天', dateText: '今日', low: 19, high: 28, label: '晴朗', rain: 10 },
          { dayName: '明天', dateText: '明日', low: 18, high: 27, label: '多云', rain: 20 },
          { dayName: '后天', dateText: '后天', low: 17, high: 25, label: '阴天', rain: 35 },
          { dayName: '大后天', dateText: '大后天', low: 18, high: 26, label: '晴朗', rain: 5 }
        ],
        hourly: [
          { time: '现在', temp: 24, label: '晴朗', rain: 10 },
          { time: '21:00', temp: 23, label: '晴朗', rain: 10 },
          { time: '22:00', temp: 22, label: '晴朗', rain: 10 },
          { time: '23:00', temp: 21, label: '多云', rain: 15 },
          { time: '00:00', temp: 20, label: '多云', rain: 15 },
          { time: '01:00', temp: 19, label: '晴朗', rain: 10 }
        ]
      }
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
  cleanupDragListeners()
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
const upcomingSeminars = computed(() => {
  const todayVal = today.value || shanghaiToday()
  return sortSeminars(data.seminars || [])
    .filter(item => item.status !== 'cancelled' && item.date >= todayVal)
    .slice(0, 4)
})
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

// 首页 7 大业务卡片与 6 级几何尺寸系统网格排布引擎
const {
  isHomeEditMode,
  hasCustomLayout,
  isCustomLayoutActive,
  slot1Config,
  rightGridConfig,
  totalGridRows,
  gridMatrixData,
  toggleHomeEditMode,
  resetHomeGridLayout,
  syncHomeGridLayoutFromCloud,
  moveGridWidget,
  removeWidgetFromLayout,
  addWidgetToLayout,
  saveHomeGridLayout,
  startDragSession,
  previewDragOver,
  commitDragSession,
  cancelDragSession,
  clearDragSnapshot
} = useHomeGridEngine()

const slot1LeftItem = computed(() => {
  if (slot1Config.value.type !== 'medium-wide') return null
  return slot1Config.value.items.find(it => (typeof it.slot1Index === 'number' ? it.slot1Index : slot1Config.value.items.indexOf(it)) === 0) || null
})

const slot1RightItem = computed(() => {
  if (slot1Config.value.type !== 'medium-wide') return null
  return slot1Config.value.items.find(it => (typeof it.slot1Index === 'number' ? it.slot1Index : slot1Config.value.items.indexOf(it)) === 1) || null
})

const showAddDrawer = ref(false)

// Pointer 真实跟手拖拽引擎与悬浮删除条状态
const isPointerDragging = ref(false)
const dragItem = ref(null)
const dragStartPos = ref({ x: 0, y: 0 })
const dragPointerPos = ref({ x: 0, y: 0 })
const dragCardRect = ref({ width: 0, height: 0, offsetX: 0, offsetY: 0 })
const isOverDeleteZone = ref(false)
const deleteZoneRef = ref(null)

function onCardPointerDown(e, item, isSlot1 = false) {
  if (!isHomeEditMode.value || e.button !== 0) return
  if (e.target.closest('button')) {
    return
  }

  // 防止意外选中文本并清除任何残留选区
  window.getSelection()?.removeAllRanges()
  e.preventDefault()

  const cardEl = e.currentTarget
  const rect = cardEl.getBoundingClientRect()

  dragItem.value = { ...item, isSlot1 }
  dragStartPos.value = { x: e.clientX, y: e.clientY }
  dragPointerPos.value = { x: e.clientX, y: e.clientY }
  dragCardRect.value = {
    width: rect.width,
    height: rect.height,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top
  }

  window.addEventListener('pointermove', onGlobalPointerMove, { passive: false })
  window.addEventListener('pointerup', onGlobalPointerUp)
  window.addEventListener('pointercancel', onGlobalPointerCancel)
  window.addEventListener('keydown', onGlobalKeyDown)
}

function onGlobalPointerMove(e) {
  if (!dragItem.value) return

  if (!isPointerDragging.value) {
    const dist = Math.hypot(e.clientX - dragStartPos.value.x, e.clientY - dragStartPos.value.y)
    if (dist > 4) {
      window.getSelection()?.removeAllRanges()
      isPointerDragging.value = true
      if (!dragItem.value.isSlot1) {
        startDragSession(dragItem.value.id)
      }
    }
  }

  if (isPointerDragging.value) {
    e.preventDefault()
    window.getSelection()?.removeAllRanges()
    dragPointerPos.value = { x: e.clientX, y: e.clientY }

    // 1. 双重检测屏幕底部“移到此处删除”碰撞
    let inDz = false
    if (deleteZoneRef.value) {
      const dzRect = deleteZoneRef.value.getBoundingClientRect()
      inDz = (
        e.clientX >= dzRect.left - 45 &&
        e.clientX <= dzRect.right + 45 &&
        e.clientY >= dzRect.top - 45 &&
        e.clientY <= dzRect.bottom + 45
      )
    }
    // 视口底部兜底：光标接近屏幕底部中央时自动激活删除区
    if (!inDz && e.clientY >= window.innerHeight - 100 && Math.abs(e.clientX - window.innerWidth / 2) < 220) {
      inDz = true
    }
    isOverDeleteZone.value = inDz
    if (inDz) {
      return
    }

    // 2. 检测右侧 Bento 网格碰撞并灵敏磁吸（仅当拖拽的不是 1 号位时）
    if (!dragItem.value.isSlot1) {
      const gridEl = forecastRightRef.value?.$el || forecastRightRef.value
      if (gridEl) {
        const gridRect = gridEl.getBoundingClientRect()
        // 扩展灵敏磁吸感应边界
        if (
          e.clientX >= gridRect.left - 60 &&
          e.clientX <= gridRect.right + 60 &&
          e.clientY >= gridRect.top - 60 &&
          e.clientY <= gridRect.bottom + 60
        ) {
          // 双栏卡片（Small / Medium / Large）强制锁定为第 1 列，单栏卡片按卡片水平中心检测
          let targetCol = 1
          if (dragItem.value.colSpan === 1) {
            const cardCenterX = (e.clientX - dragCardRect.value.offsetX + dragCardRect.value.width / 2) - gridRect.left
            targetCol = cardCenterX < gridRect.width / 2 ? 1 : 2
          }

          // 行号计算：基于拖拽卡片顶边相对于网格顶边的垂直距离，保证提起卡片瞬间行号精准不变
          const cardTopY = (e.clientY - dragCardRect.value.offsetY) - gridRect.top
          const rowStride = gridRect.height / totalGridRows.value
          const maxTargetRow = Math.max(1, totalGridRows.value - (dragItem.value.rowSpan || 1) + 1)
          const targetRow = Math.min(
            maxTargetRow,
            Math.max(1, Math.round(cardTopY / rowStride) + 1)
          )

          previewDragOver(dragItem.value.id, targetCol, targetRow)
        }
      }
    } else if (dragItem.value.isSlot1 && slot1Config.value.type === 'medium-wide') {
      // 检测 1 号位中宽卡片位置切换或互换
      const slot1El = document.querySelector('.home-custom-slot1-wrapper')
      if (slot1El) {
        const rect = slot1El.getBoundingClientRect()
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const hoveredIdx = e.clientX < rect.left + rect.width / 2 ? 0 : 1
          if (slot1Config.value.items.length === 2) {
            const curIdx = slot1Config.value.items.findIndex(it => it.id === dragItem.value.id)
            if (curIdx !== -1) {
              const curSlotIdx = typeof slot1Config.value.items[curIdx].slot1Index === 'number' ? slot1Config.value.items[curIdx].slot1Index : curIdx
              if (curSlotIdx !== hoveredIdx) {
                const otherIdx = curIdx === 0 ? 1 : 0
                slot1Config.value.items[curIdx].slot1Index = hoveredIdx
                slot1Config.value.items[otherIdx].slot1Index = curSlotIdx
                slot1Config.value.items.sort((a, b) => (a.slot1Index ?? 0) - (b.slot1Index ?? 0))
                slot1Config.value = {
                  type: 'medium-wide',
                  items: [...slot1Config.value.items]
                }
              }
            }
          } else if (slot1Config.value.items.length === 1) {
            const singleItem = slot1Config.value.items[0]
            const curSlotIdx = typeof singleItem.slot1Index === 'number' ? singleItem.slot1Index : 0
            if (curSlotIdx !== hoveredIdx) {
              singleItem.slot1Index = hoveredIdx
              slot1Config.value = {
                type: 'medium-wide',
                items: [{ ...singleItem, slot1Index: hoveredIdx }]
              }
            }
          }
        }
      }
    }
  }
}

function onGlobalPointerUp(e) {
  cleanupDragListeners()

  if (isPointerDragging.value && dragItem.value) {
    if (isOverDeleteZone.value) {
      // 彻底删除，并清空快照防止覆盖回滚
      removeWidgetFromLayout(dragItem.value.id, !!dragItem.value.isSlot1)
      clearDragSnapshot()
    } else {
      if (!dragItem.value.isSlot1) {
        commitDragSession()
      } else {
        saveHomeGridLayout(slot1Config.value, rightGridConfig.value)
        cancelDragSession()
      }
    }
    nextTick(() => {
      setupLiquidGlass()
      liquidGlassInstance?.markChanged()
    })
  }

  isPointerDragging.value = false
  dragItem.value = null
  isOverDeleteZone.value = false
}

function onGlobalPointerCancel() {
  cleanupDragListeners()
  if (isPointerDragging.value) {
    cancelDragSession()
    nextTick(() => {
      setupLiquidGlass()
      liquidGlassInstance?.markChanged()
    })
  }
  isPointerDragging.value = false
  dragItem.value = null
  isOverDeleteZone.value = false
}

function onGlobalKeyDown(e) {
  if (e.key === 'Escape') {
    onGlobalPointerCancel()
  }
}

function cleanupDragListeners() {
  window.removeEventListener('pointermove', onGlobalPointerMove)
  window.removeEventListener('pointerup', onGlobalPointerUp)
  window.removeEventListener('pointercancel', onGlobalPointerCancel)
  window.removeEventListener('keydown', onGlobalKeyDown)
  document.body.classList.remove('is-bento-dragging')
}

watch(isPointerDragging, (val) => {
  if (val) {
    document.body.classList.add('is-bento-dragging')
  } else {
    document.body.classList.remove('is-bento-dragging')
  }
})

const targetPlacementCell = ref(null)
const targetSlot1Index = ref(null)
const drawerInitialWidgetId = ref(null)
const drawerInitialSize = ref(null)

function openAddDrawerForSlot1(idx = 0) {
  targetSlot1Index.value = idx
  targetPlacementCell.value = null
  drawerInitialWidgetId.value = 'conferences'
  drawerInitialSize.value = slot1Config.value.type === 'medium-wide' ? 'medium-wide' : 'wide'
  showAddDrawer.value = true
}

function onEmptyCellClick(col, row) {
  if (!isHomeEditMode.value) return
  targetSlot1Index.value = null
  drawerInitialWidgetId.value = null
  drawerInitialSize.value = null
  targetPlacementCell.value = { col, row }
  showAddDrawer.value = true
}

function handleAddWidget({ widgetId, size }) {
  let preferredPos = null
  if (size === 'medium-wide') {
    preferredPos = { slot1Index: targetSlot1Index.value ?? 1 }
  } else if (targetPlacementCell.value) {
    preferredPos = targetPlacementCell.value
  }
  addWidgetToLayout(widgetId, size, preferredPos)
  targetPlacementCell.value = null
  targetSlot1Index.value = null
  nextTick(() => {
    setupLiquidGlass()
    liquidGlassInstance?.markChanged()
  })
}

function handleResetLayout() {
  resetHomeGridLayout()
  nextTick(() => {
    setupLiquidGlass()
    liquidGlassInstance?.markChanged()
  })
}

watch([isCustomLayoutActive, isHomeEditMode], () => {
  nextTick(() => {
    setupLiquidGlass()
    liquidGlassInstance?.markChanged()
  })
})
</script>
<template>
  <div class="forecast-home">
    <header class="forecast-topline">
      <NoticeMarquee />
      <div class="topline-right-group">
        <button
          type="button"
          class="home-layout-btn"
          :class="{ 'is-active': isHomeEditMode }"
          :title="isHomeEditMode ? '完成并保存排版' : '自定义桌面卡片与排版'"
          @click="toggleHomeEditMode"
        >
          <AppIcon :name="isHomeEditMode ? 'check' : 'layout'" :size="14" />
          <span>{{ isHomeEditMode ? '完成排版' : '自定义排版' }}</span>
        </button>
        <span class="home-date">{{ prettyDate }}</span>
      </div>
    </header>

    <!-- 桌面排版编辑工具栏 (浮动居顶) -->
    <transition name="edit-bar-slide">
      <div v-if="isHomeEditMode" class="home-edit-mode-bar">
        <div class="edit-bar-info">
          <span class="edit-pill">桌面排版编辑模式</span>
          <span class="edit-hint">按住卡片可自由拖拽换位</span>
        </div>
        <div class="edit-bar-actions">
          <button type="button" class="edit-btn add-btn" @click="showAddDrawer = true">
            <AppIcon name="plus" :size="15" />
            <span>添加卡片</span>
          </button>
          <button type="button" class="edit-btn reset-btn" title="一键清除自定义，恢复最理想的经典尺寸与排版" @click="handleResetLayout">
            <AppIcon name="refresh" :size="14" />
            <span>恢复经典排版</span>
          </button>
          <button type="button" class="edit-btn finish-btn" @click="toggleHomeEditMode">
            <AppIcon name="check" :size="15" />
            <span>完成</span>
          </button>
        </div>
      </div>
    </transition>

    <p v-if="hasError" class="home-error" role="status">部分数据暂时无法读取。<button :disabled="loading" @click="load">重新加载</button></p>
    <div
      ref="forecastDashboardRef"
      class="forecast-dashboard"
      :class="{ 'liquid-glass-active': liquidGlassActive }"
    >
      <section class="forecast-main">
        <div class="forecast-intro">
          <h1 class="group-title-heading">
            <span>{{ siteConfig.labName || '天体物理与交叉科学课题组' }}</span>
            <img
              v-if="isMidAutumn"
              src="/assets/icons/moon.svg"
              alt="中秋明月"
              class="mid-autumn-moon-badge"
              title="中秋快乐"
            />
            <img
              v-else-if="isNationalDay"
              src="/assets/icons/national-flag.svg"
              alt="国庆红旗"
              class="national-day-flag-badge"
              title="国庆快乐"
            />
          </h1>
          <p class="group-name-en">{{ siteConfig.siteSlogan || 'Astrophysics and Interdisciplinary Science Research Group' }}</p>
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
        <!-- 模式 A：原生经典 1 号位 (34be100 近期学术会议) -->
        <section
          v-if="!isCustomLayoutActive"
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

        <!-- 模式 B：自定义 Bento 网格 1 号位 (Slot 1) -->
        <div
          v-else
          class="home-custom-slot1-wrapper"
          :class="{
            'is-medium-wide-layout': slot1Config.type === 'medium-wide',
            'is-wide-layout': slot1Config.type === 'wide'
          }"
        >
          <!-- 全宽卡片 (Wide) -->
          <template v-if="slot1Config.type === 'wide' && slot1Config.items.length > 0">
            <div
              v-for="item in slot1Config.items"
              :key="item.id"
              class="custom-slot1-item slot1-wide"
              :class="{
                'is-draggable': isHomeEditMode,
                'is-currently-dragged': isPointerDragging && dragItem?.id === item.id
              }"
              @pointerdown="onCardPointerDown($event, item, true)"
            >
              <HomeWidgetRenderer
                :widget-id="item.widgetId"
                :size="item.size"
                :is-edit-mode="isHomeEditMode"
                :conferences="upcomingConferences"
                :format-conf-date="formatHomeConfDate"
                :get-conf-badge="getHomeConfDeadlineBadge"
                :next-seminar="next"
                :upcoming-seminars="upcomingSeminars"
                :seminars-state="state.seminars"
                :weekday-fn="weekday"
                :weather-data="weather"
                :weather-location="weatherLocation"
                :library-count="count('library', '篇')"
                :library-items="data.library"
                :resources-count="count('books', '册')"
                :resources-items="data.books"
                :arxiv-count="count('papers', '篇')"
                :unread-arxiv-count="unreadArxivCount"
                :has-direct-arxiv="hasDirectArxiv"
                :arxiv-items="data.papers"
                :mailbox-emails="mailboxEmails"
                @mark-arxiv="markArxivFeedViewed"
              />
            </div>
          </template>

          <!-- 中宽双位排布 (Medium-Wide) -->
          <template v-else-if="slot1Config.type === 'medium-wide' && (slot1LeftItem || slot1RightItem)">
            <!-- 槽位 0 (左侧中宽) -->
            <div
              v-if="slot1LeftItem"
              :key="slot1LeftItem.id"
              class="custom-slot1-item slot1-medium-wide slot1-col-1"
              :class="{
                'is-draggable': isHomeEditMode,
                'is-currently-dragged': isPointerDragging && dragItem?.id === slot1LeftItem.id
              }"
              @pointerdown="onCardPointerDown($event, slot1LeftItem, true)"
            >
              <HomeWidgetRenderer
                :widget-id="slot1LeftItem.widgetId"
                :size="slot1LeftItem.size"
                :is-edit-mode="isHomeEditMode"
                :conferences="upcomingConferences"
                :format-conf-date="formatHomeConfDate"
                :get-conf-badge="getHomeConfDeadlineBadge"
                :next-seminar="next"
                :upcoming-seminars="upcomingSeminars"
                :seminars-state="state.seminars"
                :weekday-fn="weekday"
                :weather-data="weather"
                :weather-location="weatherLocation"
                :library-count="count('library', '篇')"
                :library-items="data.library"
                :resources-count="count('books', '册')"
                :resources-items="data.books"
                :arxiv-count="count('papers', '篇')"
                :unread-arxiv-count="unreadArxivCount"
                :has-direct-arxiv="hasDirectArxiv"
                :arxiv-items="data.papers"
                :mailbox-emails="mailboxEmails"
                @mark-arxiv="markArxivFeedViewed"
              />
            </div>
            <div
              v-else-if="isHomeEditMode"
              class="slot1-empty-half-slot slot1-col-1"
              @click="openAddDrawerForSlot1(0)"
              title="点击添加第 1 个中宽小组件"
            >
              <span class="empty-cell-plus">+</span>
              <span class="empty-cell-label">添加中宽小组件</span>
            </div>
            <div
              v-else
              class="slot1-empty-spacer slot1-col-1"
            ></div>

            <!-- 槽位 1 (右侧中宽) -->
            <div
              v-if="slot1RightItem"
              :key="slot1RightItem.id"
              class="custom-slot1-item slot1-medium-wide slot1-col-2"
              :class="{
                'is-draggable': isHomeEditMode,
                'is-currently-dragged': isPointerDragging && dragItem?.id === slot1RightItem.id
              }"
              @pointerdown="onCardPointerDown($event, slot1RightItem, true)"
            >
              <HomeWidgetRenderer
                :widget-id="slot1RightItem.widgetId"
                :size="slot1RightItem.size"
                :is-edit-mode="isHomeEditMode"
                :conferences="upcomingConferences"
                :format-conf-date="formatHomeConfDate"
                :get-conf-badge="getHomeConfDeadlineBadge"
                :next-seminar="next"
                :upcoming-seminars="upcomingSeminars"
                :seminars-state="state.seminars"
                :weekday-fn="weekday"
                :weather-data="weather"
                :weather-location="weatherLocation"
                :library-count="count('library', '篇')"
                :library-items="data.library"
                :resources-count="count('books', '册')"
                :resources-items="data.books"
                :arxiv-count="count('papers', '篇')"
                :unread-arxiv-count="unreadArxivCount"
                :has-direct-arxiv="hasDirectArxiv"
                :arxiv-items="data.papers"
                :mailbox-emails="mailboxEmails"
                @mark-arxiv="markArxivFeedViewed"
              />
            </div>
            <div
              v-else-if="isHomeEditMode"
              class="slot1-empty-half-slot slot1-col-2"
              @click="openAddDrawerForSlot1(1)"
              title="点击添加第 2 个中宽小组件"
            >
              <span class="empty-cell-plus">+</span>
              <span class="empty-cell-label">添加中宽小组件</span>
            </div>
          </template>

          <div v-else-if="isHomeEditMode" class="slot1-empty-state">
            <span class="empty-hint">1 号位已留白（可添加全宽或两个半宽卡片）</span>
            <button type="button" class="btn-slot1-add" @click="openAddDrawerForSlot1(0)">添加 1 号位小组件</button>
          </div>
        </div>
      </section>

      <!-- 模式 A：原生经典右栏 (34be100 静态 DOM) -->
      <aside
        v-if="!isCustomLayoutActive"
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

      <!-- 模式 B：自定义 Bento 网格右栏 -->
      <TransitionGroup
        v-else
        tag="aside"
        name="bento-reorder"
        ref="forecastRightRef"
        class="forecast-right custom-bento-grid"
        :class="{ 'liquid-glass-active': liquidGlassActive, 'is-in-edit-mode': isHomeEditMode }"
        :style="{ '--grid-total-rows': totalGridRows }"
        aria-label="自定义工作区网格"
      >
        <!-- 编辑模式下的留空单元格背景插槽（辅助拖拽投放） -->
        <div
          v-for="cell in (isHomeEditMode ? gridMatrixData.emptyCells : [])"
          :key="`cell-${cell.col}-${cell.row}`"
          class="grid-empty-cell-slot"
          :style="{
            gridColumn: `${cell.col} / span 1`,
            gridRow: `${cell.row} / span 1`
          }"
          title="空位：按最小尺寸 1×1 绘制，可拖拽卡片至此处或点击添加"
          @click="onEmptyCellClick(cell.col, cell.row)"
        >
          <span class="empty-cell-plus">+</span>
        </div>

        <!-- 业务卡片项 -->
        <div
          v-for="item in rightGridConfig"
          :key="item.id"
          class="bento-grid-item"
          :class="[
            `grid-item-${item.widgetId}`,
            `size-${item.size}`,
            {
              'is-draggable': isHomeEditMode,
              'is-currently-dragged': isPointerDragging && dragItem?.id === item.id
            }
          ]"
          :style="{
            gridColumn: `${item.col} / span ${item.colSpan}`,
            gridRow: `${item.row} / span ${item.rowSpan}`
          }"
          @pointerdown="onCardPointerDown($event, item)"
        >
          <HomeWidgetRenderer
            :widget-id="item.widgetId"
            :size="item.size"
            :is-edit-mode="isHomeEditMode"
            :conferences="upcomingConferences"
            :format-conf-date="formatHomeConfDate"
            :get-conf-badge="getHomeConfDeadlineBadge"
            :next-seminar="next"
            :upcoming-seminars="upcomingSeminars"
            :seminars-state="state.seminars"
            :weekday-fn="weekday"
            :weather-data="weather"
            :weather-location="weatherLocation"
            :library-count="count('library', '篇')"
            :library-items="data.library"
            :resources-count="count('books', '册')"
            :resources-items="data.books"
            :arxiv-count="count('papers', '篇')"
            :unread-arxiv-count="unreadArxivCount"
            :has-direct-arxiv="hasDirectArxiv"
            :arxiv-items="data.papers"
            :mailbox-emails="mailboxEmails"
            @mark-arxiv="markArxivFeedViewed"
          />
        </div>
      </TransitionGroup>
    </div>

    <!-- 拖拽浮动跟手卡片 (Ghost Element) -->
    <Teleport to="body">
      <div
        v-if="isPointerDragging && dragItem"
        class="bento-drag-floating-card"
        :class="[`widget-kind-${dragItem.widgetId}`, `widget-size-${dragItem.size}`]"
        :style="{
          left: `${dragPointerPos.x - dragCardRect.offsetX}px`,
          top: `${dragPointerPos.y - dragCardRect.offsetY}px`,
          width: `${dragCardRect.width}px`,
          height: `${dragCardRect.height}px`
        }"
      >
        <HomeWidgetRenderer
          :widget-id="dragItem.widgetId"
          :size="dragItem.size"
          :is-edit-mode="false"
          :conferences="upcomingConferences"
          :format-conf-date="formatHomeConfDate"
          :get-conf-badge="getHomeConfDeadlineBadge"
          :next-seminar="next"
          :upcoming-seminars="upcomingSeminars"
          :seminars-state="state.seminars"
          :weekday-fn="weekday"
          :weather-data="weather"
          :library-count="count('library', '篇')"
          :library-items="data.library"
          :resources-count="count('books', '册')"
          :resources-items="data.books"
          :arxiv-count="count('papers', '篇')"
          :unread-arxiv-count="unreadArxivCount"
          :has-direct-arxiv="hasDirectArxiv"
          :arxiv-items="data.papers"
          :mailbox-emails="mailboxEmails"
        />
      </div>
    </Teleport>

    <!-- 屏幕底部“移到此处删除”悬浮胶囊区 -->
    <Teleport to="body">
      <Transition name="delete-zone-slide">
        <div
          v-if="isPointerDragging"
          ref="deleteZoneRef"
          class="home-drag-delete-zone"
          :class="{ 'is-active': isOverDeleteZone }"
        >
          <span class="delete-icon">
            <AppIcon name="trash" :size="20" />
          </span>
          <span>{{ isOverDeleteZone ? '松开即删除此小组件' : '移到此处删除' }}</span>
        </div>
      </Transition>
    </Teleport>

    <!-- 类似手机系统的添加小组件悬浮按钮 -->
    <transition name="fade">
      <button
        v-if="isHomeEditMode"
        type="button"
        class="floating-add-widget-fab"
        title="添加小组件至首页"
        @click="targetPlacementCell = null; targetSlot1Index = null; drawerInitialWidgetId = null; drawerInitialSize = null; showAddDrawer = true"
      >
        <AppIcon name="plus" :size="18" />
        <span>添加小组件</span>
      </button>
    </transition>

    <!-- 添加小组件抽屉 -->
    <HomeWidgetAddDrawer
      :open="showAddDrawer"
      :initial-widget-id="drawerInitialWidgetId"
      :initial-size="drawerInitialSize"
      @close="showAddDrawer = false"
      @add="handleAddWidget"
    />
  </div>
</template>

<style scoped>
/* 顶部右侧工具组与自定义排版按钮 */
.topline-right-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.home-layout-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  background: var(--bg-hover, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.home-layout-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  color: var(--text-primary, #f8fafc);
  transform: translateY(-1px);
}

.home-layout-btn.is-active {
  background: var(--accent);
  border-color: var(--accent);
  color: #ffffff;
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 45%, transparent);
}

/* 浮动排版编辑工具栏 */
.home-edit-mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  margin-bottom: 18px;
  background: rgba(15, 23, 42, 0.88);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 14px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35), 0 0 20px color-mix(in srgb, var(--accent) 20%, transparent);
  z-index: 40;
}

.edit-bar-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.edit-pill {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  color: var(--accent);
  border-radius: 20px;
}

.edit-hint {
  font-size: 12.5px;
  color: var(--text-secondary, #94a3b8);
}

.edit-bar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s ease;
}

.edit-btn.add-btn {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.15));
  color: var(--text-primary, #f8fafc);
}

.edit-btn.add-btn:hover {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
}

.edit-btn.reset-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #fca5a5;
}

.edit-btn.reset-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.edit-btn.finish-btn {
  background: linear-gradient(135deg, var(--accent) 0%, var(--accent-strong, var(--accent)) 100%);
  border: none;
  color: #ffffff;
  font-weight: 600;
  box-shadow: 0 2px 10px color-mix(in srgb, var(--accent) 35%, transparent);
}

.edit-btn.finish-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent);
}

/* 动效过渡 */
.edit-bar-slide-enter-active,
.edit-bar-slide-leave-active {
  transition: all 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

.edit-bar-slide-enter-from,
.edit-bar-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 自定义 Bento 网格容器：卡片尺寸严格复刻经典排版，通过间距自适应延展对齐左侧 1 号位底边 */
.forecast-right.custom-bento-grid {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  grid-template-rows: repeat(var(--grid-total-rows, 9), 70px) !important;
  row-gap: 12px !important;
  column-gap: 12px !important;
  align-content: space-between !important;
  height: 100% !important;
  min-height: 100% !important;
  box-sizing: border-box !important;
  position: relative !important;
}

.bento-grid-item {
  position: relative;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
}

.bento-grid-item.is-draggable {
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.bento-grid-item.is-draggable:active {
  cursor: grabbing;
}

.bento-grid-item.is-draggable :deep(*),
.custom-slot1-item.is-draggable :deep(*) {
  user-select: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
}

/* 正在被拖拽的卡片在原槽位中的半透明吸附占位框 */
.bento-grid-item.is-currently-dragged {
  opacity: 0.35 !important;
  filter: grayscale(0.6);
  pointer-events: none;
  outline: 2px dashed var(--accent, #b89bf8);
  outline-offset: -2px;
  border-radius: 16px;
}

/* 拖拽重排平滑过渡动画 (Vue TransitionGroup FLIP) */
.bento-reorder-move {
  transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1) !important;
  z-index: 10;
}

.grid-empty-cell-slot {
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.25);
  background: rgba(255, 255, 255, 0.015);
  transition: all 0.2s ease;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}

.grid-empty-cell-slot:hover {
  background: color-mix(in srgb, var(--accent, #b89bf8) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent, #b89bf8) 50%, transparent);
  color: var(--accent, #b89bf8);
}

.empty-cell-plus {
  font-size: 18px;
  font-weight: 300;
}

/* 浮动跟随指针的 3D 卡片 */
.bento-drag-floating-card {
  position: fixed !important;
  z-index: 99999 !important;
  pointer-events: none !important;
  transform: scale(1.04) rotate(1.2deg);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1.5px color-mix(in srgb, var(--accent, #b89bf8) 75%, transparent);
  border-radius: 16px;
  overflow: hidden;
  opacity: 0.95;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

/* 底部“移到此处删除”悬浮胶囊区 */
.home-drag-delete-zone {
  position: fixed;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99998;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 28px;
  border-radius: 999px;
  background: rgba(30, 20, 30, 0.85);
  border: 1.5px dashed rgba(239, 68, 68, 0.45);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  color: #fca5a5;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  transition: all 0.24s cubic-bezier(0.2, 0, 0, 1);
  pointer-events: auto;
  user-select: none;
}

.home-drag-delete-zone.is-active {
  background: rgba(220, 38, 38, 0.9);
  border-color: #ef4444;
  color: #ffffff;
  transform: translateX(-50%) scale(1.1);
  box-shadow: 0 16px 40px rgba(239, 68, 68, 0.5), 0 0 20px rgba(239, 68, 68, 0.35);
}

.home-drag-delete-zone .delete-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.home-drag-delete-zone.is-active .delete-icon {
  transform: rotate(-10deg) scale(1.15);
}

/* 底部删除条的进出动画 */
.delete-zone-slide-enter-active,
.delete-zone-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.2, 0, 0, 1);
}

.delete-zone-slide-enter-from,
.delete-zone-slide-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(40px);
}

.home-custom-slot1-wrapper {
  margin-top: 16px;
  width: 100%;
}

.home-custom-slot1-wrapper.is-medium-wide-layout {
  display: grid !important;
  grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  gap: 16px !important;
  align-items: stretch !important;
}

.home-custom-slot1-wrapper.is-wide-layout {
  display: block !important;
  width: 100% !important;
}

.custom-slot1-item {
  width: 100%;
  position: relative;
  transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, opacity 0.2s ease;
  user-select: none;
  -webkit-user-select: none;
}

.slot1-col-1 {
  grid-column: 1;
}

.slot1-col-2 {
  grid-column: 2;
}

.slot1-empty-spacer {
  min-height: 140px;
  visibility: hidden;
  pointer-events: none;
}

.slot1-empty-half-slot {
  border: 1.5px dashed rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  min-height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.02);
  color: var(--soft);
  transition: all 0.2s ease;
}

.slot1-empty-half-slot:hover {
  background: color-mix(in srgb, var(--accent, #b89bf8) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent, #b89bf8) 50%, transparent);
  color: var(--accent, #b89bf8);
}

.empty-cell-label {
  font-size: 13px;
  color: inherit;
}

.custom-slot1-item.is-draggable {
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.custom-slot1-item.is-draggable:active {
  cursor: grabbing;
}

.custom-slot1-item.is-currently-dragged {
  opacity: 0.35 !important;
  filter: grayscale(0.6);
  pointer-events: none;
  outline: 2px dashed var(--accent, #b89bf8);
  outline-offset: -2px;
  border-radius: 16px;
}

.slot1-empty-state {
  padding: 24px;
  border: 1px dashed rgba(255, 255, 255, 0.18);
  border-radius: 16px;
  text-align: center;
  color: var(--text-secondary, #94a3b8);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  background: rgba(255, 255, 255, 0.02);
}

.btn-slot1-add {
  padding: 6px 14px;
  font-size: 12.5px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent, #b89bf8) 20%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent, #b89bf8) 45%, transparent);
  color: var(--accent, #b89bf8);
  cursor: pointer;
  transition: background 0.18s ease;
}

.btn-slot1-add:hover {
  background: color-mix(in srgb, var(--accent, #b89bf8) 35%, transparent);
  color: #ffffff;
}

/* 类似手机桌面“添加小组件”的悬浮按钮 */
.floating-add-widget-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--accent, #b89bf8) 0%, var(--accent-strong, #8b5cf6) 100%);
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  border: none;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--accent, #b89bf8) 45%, transparent), 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.floating-add-widget-fab:hover {
  transform: translateY(-2px) scale(1.03);
  box-shadow: 0 6px 24px color-mix(in srgb, var(--accent, #b89bf8) 55%, transparent), 0 3px 10px rgba(0, 0, 0, 0.4);
}

.floating-add-widget-fab:active {
  transform: translateY(0) scale(0.98);
}

@media (max-width: 768px) {
  .home-edit-mode-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 12px;
  }
  .edit-bar-actions {
    width: 100%;
    justify-content: flex-end;
  }
  .forecast-right.custom-bento-grid {
    display: flex !important;
    flex-direction: column !important;
    gap: 12px !important;
  }
  .home-custom-slot1-wrapper.is-medium-wide-layout {
    grid-template-columns: 1fr !important;
  }
  .home-custom-slot1-wrapper.is-medium-wide-layout .slot1-col-1,
  .home-custom-slot1-wrapper.is-medium-wide-layout .slot1-col-2 {
    grid-column: auto !important;
  }
  .home-custom-slot1-wrapper.is-medium-wide-layout .slot1-empty-spacer {
    display: none !important;
  }
}

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
.national-day-flag-badge {
  display: inline-block;
  width: clamp(32px, 3.6vw, 50px);
  height: clamp(32px, 3.6vw, 50px);
  flex-shrink: 0;
  vertical-align: middle;
  filter: drop-shadow(0 0 12px rgba(222, 41, 16, 0.65));
  animation: national-day-flag-wave 3.5s ease-in-out infinite alternate;
  user-select: none;
  pointer-events: none;
}
@keyframes national-day-flag-wave {
  0% {
    filter: drop-shadow(0 0 8px rgba(222, 41, 16, 0.5));
    transform: scale(1) rotate(-3deg);
  }
  100% {
    filter: drop-shadow(0 0 16px rgba(255, 222, 0, 0.75));
    transform: scale(1.05) rotate(4deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .national-day-flag-badge {
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
  border: 1.5px solid var(--line, color-mix(in srgb, var(--accent, #b89bf8) 30%, transparent));
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
  box-shadow: 0 0 20px color-mix(in srgb, var(--accent, #b89bf8) 45%, transparent);
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
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
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

<style>
body.is-bento-dragging,
body.is-bento-dragging * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
  cursor: grabbing !important;
}
</style>
