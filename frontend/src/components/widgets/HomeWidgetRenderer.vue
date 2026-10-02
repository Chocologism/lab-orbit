<script setup>
import { computed, onMounted } from 'vue'
import AppIcon from '../AppIcon.vue'
import { useFavorites } from '../../composables/favorites'

const props = defineProps({
  widgetId: {
    type: String,
    required: true
  },
  size: {
    type: String,
    required: true,
    validator: (val) => ['minimal', 'small', 'medium', 'large', 'wide', 'medium-wide'].includes(val)
  },
  isEditMode: {
    type: Boolean,
    default: false
  },
  // 业务数据
  conferences: {
    type: Array,
    default: () => []
  },
  formatConfDate: {
    type: Function,
    default: (c) => c?.date || ''
  },
  getConfBadge: {
    type: Function,
    default: () => null
  },
  nextSeminar: {
    type: Object,
    default: null
  },
  upcomingSeminars: {
    type: Array,
    default: () => []
  },
  seminarsState: {
    type: String,
    default: 'ready'
  },
  weekdayFn: {
    type: Function,
    default: () => ''
  },
  weatherData: {
    type: Object,
    default: () => ({
      label: '晴朗',
      temperature: 24,
      feels: 25,
      low: 19,
      high: 28,
      humidity: 62,
      wind: 12,
      rain: 10
    })
  },
  weatherLocation: {
    type: String,
    default: '学术园区'
  },
  weatherAdvice: {
    type: String,
    default: '今夜园区云量极少，适合深度巡天数据标定与天文观测。'
  },
  libraryCount: {
    type: String,
    default: '20 篇'
  },
  libraryItems: {
    type: Array,
    default: () => []
  },
  resourcesCount: {
    type: String,
    default: '24 册'
  },
  resourcesItems: {
    type: Array,
    default: () => []
  },
  arxivCount: {
    type: String,
    default: '18 篇'
  },
  unreadArxivCount: {
    type: Number,
    default: 0
  },
  hasDirectArxiv: {
    type: Boolean,
    default: false
  },
  arxivItems: {
    type: Array,
    default: () => []
  },
  mailboxCount: {
    type: String,
    default: 'POP3 / IMAP'
  },
  mailboxEmails: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['mark-arxiv'])

const displaySeminars = computed(() => {
  if (props.upcomingSeminars && props.upcomingSeminars.length > 0) {
    return props.upcomingSeminars
  }
  if (props.nextSeminar) {
    return [props.nextSeminar]
  }
  return []
})

function formatSeminarDate(sem) {
  if (!sem?.date) return ''
  const m = Number(sem.date.slice(5, 7))
  const d = sem.date.slice(8, 10)
  return `${m}.${d}`
}

function getRankingReason(conf) {
  if (!conf) return ''
  const badge = props.getConfBadge(conf)
  if (badge?.text) return badge.text
  if (conf._priority) {
    if (conf._priority.priorityType === 'start') {
      return `${props.formatConfDate(conf)} 开幕`
    }
    if (conf._priority.badgeLabel) {
      return `${conf._priority.badgeLabel} ${conf._priority.priorityDate.slice(5)} 截止`
    }
  }
  return `${props.formatConfDate(conf)} 举办`
}

const { saved, load: loadFavorites } = useFavorites()
onMounted(() => {
  loadFavorites().catch(() => {})
})

function formatAuthors(item) {
  if (!item) return ''
  if (Array.isArray(item.authors) && item.authors.length > 0) {
    return item.authors.join(' · ')
  }
  if (typeof item.authors === 'string' && item.authors.trim()) {
    return item.authors
  }
  if (item.author) return item.author
  return ''
}

function formatRecommender(item) {
  if (!item) return ''
  if (typeof item.recommender === 'string' && item.recommender.trim()) return item.recommender
  if (item.recommender?.real_name) return item.recommender.real_name
  if (item.recommender?.name) return item.recommender.name
  if (typeof item.recommender_name === 'string' && item.recommender_name.trim()) return item.recommender_name
  if (item.rec && typeof item.rec === 'string') return item.rec
  return ''
}

function formatHourlyLabel(label) {
  if (!label) return ''
  const clean = String(label).trim()
  const map = {
    '小毛毛雨': '毛毛雨',
    '大毛毛雨': '毛毛雨',
    '局部多云': '多云',
    '大部晴朗': '多云',
    '雷雨伴冰雹': '雷雨',
    '强雷雨伴冰雹': '强雷雨'
  }
  return map[clean] || clean
}

function getWindMain(wind) {
  if (wind === null || wind === undefined) return '—'
  const str = String(wind).trim()
  if (str.includes('km/h')) {
    return str.replace('km/h', '').trim()
  }
  if (str.includes('m/s')) {
    return str.replace('m/s', '').trim()
  }
  if (str.includes('风') || str.includes('级')) {
    return str
  }
  const num = parseFloat(str)
  return isNaN(num) ? str : String(num)
}

function getWindUnit(wind) {
  if (wind === null || wind === undefined) return ''
  const str = String(wind).trim()
  if (str.includes('km/h')) return 'km/h'
  if (str.includes('m/s')) return 'm/s'
  if (str.includes('风') || str.includes('级')) return ''
  const num = parseFloat(str)
  return isNaN(num) ? '' : 'km/h'
}

function formatWindDisplay(wind) {
  if (wind === null || wind === undefined) return '—'
  const str = String(wind)
  if (str.includes('风') || str.includes('级') || str.includes('km/h') || str.includes('m/s')) {
    return str
  }
  return `${wind} km/h`
}

function getHumidityHint(val) {
  if (val === null || val === undefined) return ''
  const num = Number(val)
  if (isNaN(num)) return ''
  if (num < 35) return '干燥'
  if (num <= 65) return '适宜'
  if (num <= 80) return '湿润'
  return '潮湿'
}

function getWindHint(val) {
  if (val === null || val === undefined) return ''
  const str = String(val)
  if (str.includes('微风') || str.includes('1级') || str.includes('2级')) return '微风徐徐'
  if (str.includes('和风') || str.includes('3级') || str.includes('4级')) return '和风拂面'
  if (str.includes('清风') || str.includes('5级') || str.includes('强风')) return '风力稍强'
  const num = parseFloat(str)
  if (isNaN(num)) return '平稳'
  if (num < 12) return '微风徐徐'
  if (num < 25) return '和风拂面'
  return '风力稍强'
}

function getRainHint(val) {
  if (val === null || val === undefined) return ''
  const num = Number(val)
  if (isNaN(num)) return ''
  if (num === 0) return '无降水'
  if (num <= 20) return '概率低'
  if (num <= 50) return '或有微雨'
  return '降水明显'
}

function getWeatherIconType(label) {
  if (!label) return 'sun'
  const str = String(label)
  if (str.includes('雨') || str.includes('雪') || str.includes('雹')) return 'rain'
  if (str.includes('云') || str.includes('阴') || str.includes('雾')) return 'cloud'
  return 'sun'
}

function normalizeUrl(url) {
  if (!url) return ''
  url = url.trim()
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:') || url.startsWith('ftp://') || url.startsWith('/')) {
    return url
  }
  return 'https://' + url
}

function getWebsiteUrl(book) {
  if (!book) return ''
  let url = book.download_url || book.tutorial_url || book.github_url || ''
  if (!url && book.title && (book.title.includes('http://') || book.title.includes('https://') || book.title.includes('.org') || book.title.includes('.com') || book.title.includes('.cn') || book.title.includes('.net') || book.title.includes('.edu'))) {
    url = book.title
  }
  if (!url) return ''
  return normalizeUrl(url)
}

function isWebsiteResource(item) {
  if (!item) return false
  return item.category === '网站' || item.type === '网站'
}

function getResourceFirstLink(book) {
  if (!book) return ''
  // 1. 若为「网站」类型，优先进入该网站
  if (isWebsiteResource(book)) {
    const siteUrl = getWebsiteUrl(book)
    if (siteUrl) return siteUrl
  }
  // 2. 对应书籍/资料卡片：若填写了“资料PDF/下载链接（可选）”，点击卡片优先跳转该链接
  if (book.download_url && book.download_url.trim()) {
    return normalizeUrl(book.download_url)
  }
  // 3. 其次按备用顺位查找可用链接：讲义 -> 习题 -> 代码
  if (book.tutorial_url && book.tutorial_url.trim()) {
    return normalizeUrl(book.tutorial_url)
  }
  if (book.exercise_url && book.exercise_url.trim()) {
    return normalizeUrl(book.exercise_url)
  }
  if (book.github_url && book.github_url.trim()) {
    return normalizeUrl(book.github_url)
  }
  // 4. 兜底网站网址识别
  const fallbackSite = getWebsiteUrl(book)
  if (fallbackSite) return fallbackSite
  return ''
}

function getResourceSubcardLabel(item) {
  if (isWebsiteResource(item)) {
    return '访问'
  }
  return formatAuthors(item) || '下载资料'
}

function handleResourceItemClick(item, event) {
  if (props.isEditMode) return
  if (event) {
    event.preventDefault()
  }
  const link = getResourceFirstLink(item)
  if (link) {
    if (typeof window !== 'undefined' && window.open) {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  } else if (router) {
    router.push({ path: '/resources', query: { q: item.title } })
  }
}

function goToConference(conf, event) {
  if (props.isEditMode) return
  if (event) event.stopPropagation()
  if (router) {
    router.push({ path: '/seminars', query: { tab: 'conferences', conferenceId: conf.id } })
  }
}

function goToLibraryPaper(item, event) {
  if (props.isEditMode) return
  if (event) event.stopPropagation()
  if (router) {
    router.push({ path: '/library', query: { q: item.arxiv_id || item.title } })
  }
}

function goToArxivPaper(item, event) {
  if (props.isEditMode) return
  if (event) event.stopPropagation()
  emit('mark-arxiv')
  if (router) {
    router.push({ path: '/arxiv', query: { paper_id: item.id, arxiv_id: item.arxiv_id, highlight: '1' } })
  }
}

function goToMail(mail, event) {
  if (props.isEditMode) return
  if (event) event.stopPropagation()
  if (router) {
    router.push({ path: '/mailbox', query: { email_id: mail.id } })
  }
}

const sortedLibraryItems = computed(() => {
  const list = [...(props.libraryItems || [])]
  return list.sort((a, b) => {
    const aFav = (saved('paper', a.arxiv_id || a.id) || a.is_favorite) ? 1 : 0
    const bFav = (saved('paper', b.arxiv_id || b.id) || b.is_favorite) ? 1 : 0
    if (aFav !== bFav) return bFav - aFav
    if (a.created_at && b.created_at) {
      const c = b.created_at.localeCompare(a.created_at)
      if (c !== 0) return c
    }
    return (b.id || 0) - (a.id || 0)
  })
})

const sortedResourcesItems = computed(() => {
  const list = [...(props.resourcesItems || [])]
  return list.sort((a, b) => {
    const aFav = (saved('book', String(a.id)) || a.is_favorite) ? 1 : 0
    const bFav = (saved('book', String(b.id)) || b.is_favorite) ? 1 : 0
    if (aFav !== bFav) return bFav - aFav
    if (a.created_at && b.created_at) {
      const c = b.created_at.localeCompare(a.created_at)
      if (c !== 0) return c
    }
    return (b.id || 0) - (a.id || 0)
  })
})

const sortedArxivItems = computed(() => {
  const list = [...(props.arxivItems || [])]
  return list.sort((a, b) => {
    if (a.created_at && b.created_at) {
      const c = b.created_at.localeCompare(a.created_at)
      if (c !== 0) return c
    }
    return (b.id || 0) - (a.id || 0)
  })
})

function formatMailSender(mail) {
  if (!mail) return ''
  const name = mail.from_name || mail.from || mail.from_address || ''
  if (!name) return ''
  const clean = name.replace(/^["'\s]+|["'\s]+$/g, '')
  const match = clean.match(/^([^<]+)<.+>$/)
  if (match) return match[1].trim()
  return clean
}

function formatMailDate(mail) {
  if (!mail) return ''
  const dStr = mail.date_str || mail.date || mail.created_at || mail.fetched_at || ''
  if (!dStr) return ''
  const d = new Date(dStr)
  if (!isNaN(d.getTime())) {
    const m = d.getMonth() + 1
    const day = String(d.getDate()).padStart(2, '0')
    return `${m}.${day}`
  }
  const isoMatch = dStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) return `${Number(isoMatch[2])}.${isoMatch[3]}`
  return dStr.slice(0, 10)
}

function formatPaperMeta(item) {
  if (!item) return ''
  if (item.arxiv_id) return `arXiv:${item.arxiv_id}`
  if (item.published_date) return String(item.published_date)
  if (item.created_at) return item.created_at.slice(0, 10)
  return ''
}

function formatMailAddress(mail) {
  if (!mail) return ''
  const addr = mail.sender_email || mail.from_address || ''
  if (addr) return addr.replace(/<|>/g, '').trim()
  const raw = mail.from_name || mail.from || ''
  const match = raw.match(/<([^>]+)>/)
  return match ? match[1] : ''
}

function formatMailSnippet(mail) {
  if (!mail?.snippet) return ''
  return mail.snippet.replace(/\s+/g, ' ').trim()
}

const weatherDailyList = computed(() => {
  if (props.weatherData?.daily && props.weatherData.daily.length > 0) {
    return props.weatherData.daily
  }
  return [
    { dayName: '今天', dateText: '今日', low: props.weatherData?.low ?? 19, high: props.weatherData?.high ?? 28, label: props.weatherData?.label ?? '晴朗', rain: props.weatherData?.rain ?? 10 },
    { dayName: '明天', dateText: '明日', low: 18, high: 27, label: '多云', rain: 20 },
    { dayName: '后天', dateText: '后天', low: 17, high: 25, label: '阴天', rain: 35 },
    { dayName: '大后天', dateText: '大后天', low: 18, high: 26, label: '晴朗', rain: 5 }
  ]
})

const weatherHourlyList = computed(() => {
  if (props.weatherData?.hourly && props.weatherData.hourly.length > 0) {
    return props.weatherData.hourly
  }
  return [
    { time: '现在', temp: props.weatherData?.temperature ?? 24, label: props.weatherData?.label ?? '晴朗' },
    { time: '21:00', temp: 23, label: '晴朗' },
    { time: '22:00', temp: 22, label: '晴朗' },
    { time: '23:00', temp: 21, label: '多云' },
    { time: '00:00', temp: 20, label: '多云' },
    { time: '01:00', temp: 19, label: '晴朗' }
  ]
})
</script>

<template>
  <div
    class="home-widget-card-wrapper"
    :class="[
      `widget-kind-${widgetId}`,
      `widget-size-${size}`,
      { 'is-in-edit-mode': isEditMode }
    ]"
  >

    <!-- =========================================================================
         1. 近期学术会议 (conferences)
         ========================================================================= -->
    <template v-if="widgetId === 'conferences'">
      <!-- 宽 (Wide - 1号位专属全宽，内含4个标准子卡片，与 34be100 100% 一致) -->
      <section
        v-if="size === 'wide'"
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
        <div v-if="conferences.length > 0" class="home-conf-grid" :class="`grid-cols-${Math.min(conferences.length, 4)}`">
          <router-link
            v-for="conf in conferences.slice(0, 4)"
            :key="conf.id"
            :to="{ path: '/seminars', query: { tab: 'conferences', conferenceId: conf.id } }"
            class="home-conf-card-item"
            :title="conf.title"
          >
            <div class="home-conf-item-top">
              <span class="conf-item-date mono">{{ formatConfDate(conf) }}</span>
              <span v-if="conf.city" class="conf-item-city">{{ conf.city }}</span>
              <span v-else-if="conf.sub_type" class="conf-item-badge">{{ conf.sub_type }}</span>
              <span
                v-if="getConfBadge(conf)"
                class="conf-item-urgent"
                :class="{ 'is-urgent': getConfBadge(conf).isUrgent }"
              >
                <AppIcon :name="getConfBadge(conf).isUrgent ? 'warning' : 'clock'" :size="11" />
                <span>{{ getConfBadge(conf).text }}</span>
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

      <!-- 中宽 (Medium-Wide - 1号位专属半宽，2个子卡片) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
        aria-label="学术会议精选"
      >
        <div class="home-conf-heading">
          <div class="heading-left">
            <AppIcon name="calendar" :size="17" />
            <span>学术会议</span>
          </div>
          <router-link to="/seminars?tab=conferences" class="conf-top-link">
            <span>全部</span>
            <AppIcon name="right" :size="14" />
          </router-link>
        </div>
        <div v-if="conferences.length > 0" class="home-conf-grid grid-cols-2">
          <router-link
            v-for="conf in conferences.slice(0, 2)"
            :key="conf.id"
            :to="{ path: '/seminars', query: { tab: 'conferences', conferenceId: conf.id } }"
            class="home-conf-card-item"
            :title="conf.title"
          >
            <div class="home-conf-item-top">
              <span class="conf-item-date mono">{{ formatConfDate(conf) }}</span>
              <span v-if="conf.city" class="conf-item-city">{{ conf.city }}</span>
              <span v-if="getConfBadge(conf)" class="conf-item-urgent" :class="{ 'is-urgent': getConfBadge(conf).isUrgent }">
                {{ getConfBadge(conf).text }}
              </span>
            </div>
            <h3 class="home-conf-item-title">{{ conf.title }}</h3>
            <div class="home-conf-item-location" v-if="conf.location || conf.organizer">
              <AppIcon name="location" :size="11" />
              <span>{{ conf.location || conf.organizer }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="conf-mini-empty"><p>暂无近期会议</p></div>
      </section>

      <!-- 大 (Large - 2列 x 4行，纵向 3 项会议日程) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large list-widget-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left">
            <AppIcon name="calendar" :size="17" />
            <span>学术会议 ({{ conferences.length }})</span>
          </div>
          <router-link to="/seminars?tab=conferences" class="v-head-link">全部 <AppIcon name="right" :size="13" /></router-link>
        </div>
        <div v-if="conferences.length > 0" class="conf-v-list">
          <router-link
            v-for="conf in conferences.slice(0, 3)"
            :key="conf.id"
            :to="{ path: '/seminars', query: { tab: 'conferences', conferenceId: conf.id } }"
            class="conf-v-item"
          >
            <div class="conf-v-item-top">
              <span class="conf-item-date mono">{{ formatConfDate(conf) }}</span>
              <span v-if="conf.city" class="conf-item-city">{{ conf.city }}</span>
              <span v-if="getConfBadge(conf)" class="conf-item-urgent" :class="{ 'is-urgent': getConfBadge(conf).isUrgent }">
                {{ getConfBadge(conf).text }}
              </span>
            </div>
            <h4 class="conf-v-title">{{ conf.title }}</h4>
            <div class="conf-v-location" v-if="conf.location || conf.organizer">
              <AppIcon name="location" :size="12" />
              <span>{{ conf.location || conf.organizer }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="widget-list-empty">近期暂无学术会议</div>
      </div>

      <!-- 中 (Medium - 2列 x 2行，显示前 3 项会议) -->
      <router-link
        v-else-if="size === 'medium'"
        to="/seminars?tab=conferences"
        class="glass-card widget-card-medium list-widget-card liquid-glass-card"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="calendar" :size="16" />
            <span>近期会议 ({{ conferences.length }})</span>
          </div>
          <span class="mini-head-link">查看 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="conferences.length > 0" class="widget-list-items">
          <div
            v-for="conf in conferences.slice(0, 3)"
            :key="conf.id"
            class="widget-list-row cursor-pointer"
            :title="conf.title"
            @click.stop="goToConference(conf, $event)"
          >
            <span class="row-bullet">·</span>
            <span class="row-title">{{ conf.title }}</span>
            <span v-if="getConfBadge(conf)" class="row-tag" :class="{ urgent: getConfBadge(conf).isUrgent }">{{ getConfBadge(conf).text }}</span>
          </div>
        </div>
        <div v-else class="widget-list-empty">暂无会议安排</div>
      </router-link>

      <!-- 小 (Small - 2列 x 1行，最近 1 项会议) -->
      <router-link
        v-else-if="size === 'small'"
        :to="conferences[0] ? { path: '/seminars', query: { tab: 'conferences', conferenceId: conferences[0].id } } : '/seminars?tab=conferences'"
        class="glass-card widget-card-small conf-small-row liquid-glass-card"
      >
        <div class="conf-s-left">
          <AppIcon name="calendar" :size="16" />
          <div class="conf-s-info">
            <span class="conf-s-title" :title="conferences[0]?.title">{{ conferences[0]?.title || '近期学术会议专区' }}</span>
            <div v-if="conferences[0]" class="conf-s-meta">
              <span
                class="conf-ranking-badge"
                :class="{ 'is-urgent': getConfBadge(conferences[0])?.isUrgent }"
              >
                {{ getRankingReason(conferences[0]) }}
              </span>
              <span class="conf-s-date mono">{{ formatConfDate(conferences[0]) }}</span>
            </div>
            <span v-else class="conf-s-date">查看学术研讨会</span>
          </div>
        </div>
        <AppIcon name="right" :size="14" />
      </router-link>

      <!-- 最小 (Minimal - 1列 x 1行，微缩方块) -->
      <router-link
        v-else-if="size === 'minimal'"
        to="/seminars?tab=conferences"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        title="进入学术会议专区"
      >
        <span class="destination-label"><AppIcon name="calendar" :size="17" />学术会议</span>
        <span class="destination-count">
          <span class="count-left">{{ conferences.length }} 场</span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>
    </template>

    <!-- =========================================================================
         2. 最近一次组会 (next-seminar)
         ========================================================================= -->
    <template v-else-if="widgetId === 'next-seminar'">
      <!-- 大 (Large - 2列 x 4行，与 34be100 next-meeting 100% 一致) -->
      <router-link
        v-if="size === 'large'"
        :to="nextSeminar ? { path: '/seminars', query: { seminar: nextSeminar.id } } : '/seminars'"
        class="glass-card next-meeting liquid-glass-card"
      >
        <div class="next-heading">
          <span><AppIcon name="calendar" :size="18" />最近一次组会</span>
          <AppIcon name="external" :size="18" />
        </div>
        <template v-if="seminarsState === 'ready' && nextSeminar">
          <div class="next-date">
            <span>{{ nextSeminar.date.slice(8) }}</span>
            <div>{{ Number(nextSeminar.date.slice(5, 7)) }} 月<small>{{ weekdayFn(nextSeminar.date) }} · {{ nextSeminar.time }}</small></div>
          </div>
          <h2>{{ nextSeminar.topic }}</h2>
          <p class="next-presenter">主讲 · {{ nextSeminar.presenter_name }}</p>
          <div class="next-meta">
            <p><AppIcon name="location" :size="16" />{{ nextSeminar.location || '地点待补充' }}</p>
            <p><AppIcon name="user" :size="16" />文献分享 · {{ nextSeminar.presentations?.map(p => p.presenter_name).join('、') || '暂未安排' }}</p>
          </div>
        </template>
        <div v-else class="next-empty">
          <AppIcon name="calendar" :size="36" />
          <h2>{{ seminarsState === 'loading' ? '正在读取排期' : seminarsState === 'error' ? '暂时无法读取' : '留一点时间，交流新想法。' }}</h2>
          <p>{{ seminarsState === 'ready' ? '暂未安排下一次组会' : '可进入组会页面查看或重试' }}</p>
        </div>
        <span class="next-bottom">查看组会议程<AppIcon name="right" :size="17" /></span>
      </router-link>

      <!-- 中 (Medium - 2列 x 2行) -->
      <router-link
        v-else-if="size === 'medium'"
        :to="nextSeminar ? { path: '/seminars', query: { seminar: nextSeminar.id } } : '/seminars'"
        class="glass-card widget-card-medium next-medium-card liquid-glass-card"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="calendar" :size="15" />
            <span>最近组会</span>
          </div>
          <span v-if="nextSeminar" class="next-medium-date-badge mono">
            {{ `${Number(nextSeminar.date.slice(5, 7))}月${nextSeminar.date.slice(8)}日` }}
          </span>
          <span v-else class="mini-head-link">议程 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="nextSeminar" class="next-medium-content">
          <h3 class="next-medium-topic" :title="nextSeminar.topic">{{ nextSeminar.topic }}</h3>
          <div class="next-medium-footer">
            <span class="next-medium-speaker">
              <AppIcon name="user" :size="12" />
              <span>主讲 · {{ nextSeminar.presenter_name || '待定' }}</span>
            </span>
            <span v-if="nextSeminar.presentations?.length" class="next-medium-arxiv" :title="'arXiv分享：' + nextSeminar.presentations.map(p => p.presenter_name).join('、')">
              <AppIcon name="article" :size="12" />
              <span>arXiv · {{ nextSeminar.presentations.map(p => p.presenter_name).join('、') }}</span>
            </span>
          </div>
        </div>
        <div v-else class="widget-list-empty">暂未安排下一次组会</div>
      </router-link>

      <!-- 小 (Small - 2列 x 1行) -->
      <router-link
        v-else-if="size === 'small'"
        :to="nextSeminar ? { path: '/seminars', query: { seminar: nextSeminar.id } } : '/seminars'"
        class="glass-card widget-card-small next-small-row liquid-glass-card"
      >
        <div class="next-s-left">
          <AppIcon name="calendar" :size="16" />
          <div class="next-s-info">
            <span class="next-s-topic">{{ nextSeminar ? nextSeminar.topic : '最近一次组会' }}</span>
            <span class="next-s-sub">{{ nextSeminar ? `${nextSeminar.date.slice(5)} · ${nextSeminar.presenter_name}` : '点击进入组会专区' }}</span>
          </div>
        </div>
        <AppIcon name="right" :size="14" />
      </router-link>

      <!-- 最小 (Minimal - 1列 x 1行) -->
      <router-link
        v-else-if="size === 'minimal'"
        :to="nextSeminar ? { path: '/seminars', query: { seminar: nextSeminar.id } } : '/seminars'"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        title="查看最近组会"
      >
        <span class="destination-label"><AppIcon name="calendar" :size="17" />最近组会</span>
        <span class="destination-count">
          <span class="count-left">{{ nextSeminar ? `${Number(nextSeminar.date.slice(5, 7))}.${nextSeminar.date.slice(8)}` : '待排期' }}</span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>

      <!-- 宽 (Wide - 1号位专属全宽) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
        aria-label="最近组会全宽展台"
      >
        <div class="home-conf-heading">
          <div class="heading-left">
            <AppIcon name="calendar" :size="18" />
            <span>近期组会议程与文献研讨</span>
          </div>
          <router-link to="/seminars" class="conf-top-link">
            <span>进入组会专区</span>
            <AppIcon name="right" :size="15" />
          </router-link>
        </div>
        <div v-if="displaySeminars.length > 0" class="home-conf-grid" :class="`grid-cols-${Math.min(displaySeminars.length, 4)}`">
          <router-link
            v-for="sem in displaySeminars.slice(0, 4)"
            :key="sem.id"
            :to="{ path: '/seminars', query: { seminar: sem.id } }"
            class="home-conf-card-item next-conf-subcard"
            :title="sem.topic"
          >
            <div class="home-conf-item-top next-conf-top-row">
              <span class="conf-item-date mono">{{ formatSeminarDate(sem) }}</span>
              <span v-if="sem.location" class="conf-item-city">{{ sem.location }}</span>
            </div>
            <h3 class="home-conf-item-title">{{ sem.topic || '组会议程待定' }}</h3>
            <div class="next-subcard-presenters">
              <div class="next-subcard-presenters-left">
                <span class="next-subcard-main">
                  <AppIcon name="user" :size="11" />
                  <span>主讲 · {{ sem.presenter_name || '待定' }}</span>
                </span>
                <span v-if="sem.presentations?.length" class="next-subcard-arxiv" :title="'arXiv文献分享：' + sem.presentations.map(p => p.presenter_name).join('、')">
                  <AppIcon name="article" :size="11" />
                  <span>arXiv · {{ sem.presentations.map(p => p.presenter_name).join('、') }}</span>
                </span>
              </div>
              <span v-if="sem.time" class="conf-item-badge next-conf-time-badge mono">{{ sem.time }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="conf-mini-empty"><p>暂无下一次组会安排</p></div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位半宽) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
        aria-label="近期组会精选"
      >
        <div class="home-conf-heading">
          <div class="heading-left">
            <AppIcon name="calendar" :size="17" />
            <span>近期组会</span>
          </div>
          <router-link to="/seminars" class="conf-top-link">
            <span>全部</span>
            <AppIcon name="right" :size="14" />
          </router-link>
        </div>
        <div v-if="displaySeminars.length > 0" class="home-conf-grid grid-cols-2">
          <router-link
            v-for="sem in displaySeminars.slice(0, 2)"
            :key="sem.id"
            :to="{ path: '/seminars', query: { seminar: sem.id } }"
            class="home-conf-card-item next-conf-subcard"
            :title="sem.topic"
          >
            <div class="home-conf-item-top next-conf-top-row">
              <span class="conf-item-date mono">{{ formatSeminarDate(sem) }}</span>
              <span v-if="sem.location" class="conf-item-city">{{ sem.location }}</span>
            </div>
            <h3 class="home-conf-item-title">{{ sem.topic || '组会议程待定' }}</h3>
            <div class="next-subcard-presenters">
              <div class="next-subcard-presenters-left">
                <span class="next-subcard-main">
                  <AppIcon name="user" :size="11" />
                  <span>主讲 · {{ sem.presenter_name || '待定' }}</span>
                </span>
                <span v-if="sem.presentations?.length" class="next-subcard-arxiv">
                  <AppIcon name="article" :size="11" />
                  <span>arXiv · {{ sem.presentations.map(p => p.presenter_name).join('、') }}</span>
                </span>
              </div>
              <span v-if="sem.time" class="conf-item-badge next-conf-time-badge mono">{{ sem.time }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="conf-mini-empty"><p>暂无组会安排</p></div>
      </section>
    </template>

    <!-- =========================================================================
         3. 今日天气 (weather)
         ========================================================================= -->
    <template v-else-if="widgetId === 'weather'">
      <!-- 中 (Medium - 2列 x 2行) -->
      <section
        v-if="size === 'medium'"
        class="glass-card weather-card liquid-glass-card"
        data-config='{"button":false}'
        aria-label="天气模块"
      >
        <div class="next-heading">
          <span>今日天气</span>
          <span class="weather-place">{{ weatherLocation }} · {{ weatherData.label }}</span>
        </div>
        <div class="weather-reading">
          <div>
            <strong>{{ weatherData.temperature === null ? '—' : `${weatherData.temperature}°` }}</strong>
            <span>{{ weatherData.temperature === null ? '无法获取实时数据' : `体感 ${weatherData.feels}°` }}</span>
          </div>
          <strong class="weather-range">{{ weatherData.low === null || weatherData.high === null ? '—' : `${weatherData.low}°—${weatherData.high}°` }}</strong>
        </div>
        <div class="weather-meta">
          <span>湿度 {{ weatherData.humidity === null ? '—' : `${weatherData.humidity}%` }}</span>
          <span>风速 {{ weatherData.wind === null ? '—' : `${weatherData.wind} km/h` }}</span>
          <span>降水概率 {{ weatherData.rain === null ? '—' : `${weatherData.rain}%` }}</span>
        </div>
      </section>

      <!-- 大 (Large - 2列 x 4行，今日天气参考中型卡片大小和布局 + 未来分时预测) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large weather-large-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left"><span>气象预报</span></div>
          <span class="weather-place">{{ weatherLocation }} · {{ weatherData.label }}</span>
        </div>
        <div class="weather-reading weather-large-today-reading">
          <div>
            <strong>{{ weatherData.temperature === null ? '—' : `${weatherData.temperature}°` }}</strong>
            <span class="weather-feels-tag">{{ weatherData.temperature === null ? '无法获取实时数据' : `体感 ${weatherData.feels}°` }}</span>
          </div>
          <strong class="weather-range">{{ weatherData.low === null || weatherData.high === null ? '—' : `${weatherData.low}°—${weatherData.high}°` }}</strong>
        </div>
        <!-- 三大气象指标 Bento 独立卡片 (湿度、风速、降水概率) -->
        <div class="weather-meta weather-large-today-meta weather-metrics-grid">
          <div class="weather-metric-card">
            <div class="w-metric-top">
              <span class="w-metric-icon humidity-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
                </svg>
              </span>
              <span class="w-metric-label">湿度</span>
            </div>
            <div class="w-metric-val">{{ weatherData.humidity === null ? '—' : `${weatherData.humidity}%` }}</div>
            <span class="w-metric-hint">{{ getHumidityHint(weatherData.humidity) }}</span>
          </div>

          <div class="weather-metric-card">
            <div class="w-metric-top">
              <span class="w-metric-icon wind-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
                </svg>
              </span>
              <span class="w-metric-label">风速</span>
            </div>
            <div class="w-metric-val wind-metric-val" :class="{ 'is-text-wind': !getWindUnit(weatherData.wind) }">
              <span class="w-metric-num">{{ getWindMain(weatherData.wind) }}</span>
              <span class="w-metric-unit" v-if="getWindUnit(weatherData.wind)">{{ getWindUnit(weatherData.wind) }}</span>
            </div>
            <span class="w-metric-hint">{{ getWindHint(weatherData.wind) }}</span>
          </div>

          <div class="weather-metric-card">
            <div class="w-metric-top">
              <span class="w-metric-icon rain-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                  <line x1="8" y1="21" x2="8" y2="23"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="16" y1="21" x2="16" y2="23"/>
                </svg>
              </span>
              <span class="w-metric-label">降水概率</span>
            </div>
            <div class="w-metric-val">{{ weatherData.rain === null ? '—' : `${weatherData.rain}%` }}</div>
            <span class="w-metric-hint">{{ getRainHint(weatherData.rain) }}</span>
          </div>
        </div>

        <div class="weather-hourly-section">
          <div class="weather-hourly-title-row">
            <span class="weather-hourly-title">未来分时气象</span>
            <span class="weather-hourly-sub">逐时预报</span>
          </div>
          <div class="weather-hourly-grid">
            <div v-for="(h, idx) in weatherHourlyList.slice(0, 6)" :key="idx" class="weather-hour-col">
              <span class="w-hour-time">{{ h.time }}</span>
              <span class="w-hour-icon" :class="`icon-${getWeatherIconType(h.label)}`">
                <svg v-if="getWeatherIconType(h.label) === 'rain'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                  <line x1="8" y1="21" x2="8" y2="23"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="16" y1="21" x2="16" y2="23"/>
                </svg>
                <svg v-else-if="getWeatherIconType(h.label) === 'cloud'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
                </svg>
              </span>
              <span class="w-hour-temp">{{ h.temp }}°</span>
              <span class="w-hour-rain-tag" v-if="h.rain > 0">{{ h.rain }}%</span>
              <span class="w-hour-label" :title="h.label">{{ formatHourlyLabel(h.label) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 小 (Small - 2列 x 1行) -->
      <div
        v-else-if="size === 'small'"
        class="glass-card widget-card-small weather-small-row liquid-glass-card"
      >
        <div class="weather-s-left">
          <div class="weather-s-info">
            <span class="weather-s-temp">{{ weatherData.temperature !== null ? `${weatherData.temperature}°C · ${weatherData.label}` : `${weatherLocation}天气` }}</span>
            <span class="weather-s-sub">{{ weatherLocation }} · 湿度 {{ weatherData.humidity }}% · 降水 {{ weatherData.rain }}%</span>
          </div>
        </div>
        <span class="weather-s-range">{{ weatherData.low }}°—{{ weatherData.high }}°</span>
      </div>

      <!-- 最小 (Minimal - 1列 x 1行) -->
      <div
        v-else-if="size === 'minimal'"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        title="今日天气"
      >
        <span class="destination-label">{{ weatherLocation }}天气</span>
        <span class="destination-count">
          <span class="count-left">{{ weatherData.temperature !== null ? `${weatherData.temperature}° · ${weatherData.label}` : '观测中' }}</span>
          <AppIcon name="external" :size="16" />
        </span>
      </div>

      <!-- 宽 (Wide - 1号位专属全宽，气温值放大显示在右侧，原区域显示日期) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><span>{{ weatherLocation }}气象预报</span></div>
          <span class="weather-place">{{ weatherData.label }} · 园区</span>
        </div>
        <div class="home-conf-grid grid-cols-4">
          <div
            v-for="(day, idx) in weatherDailyList.slice(0, 4)"
            :key="idx"
            class="home-conf-card-item weather-daily-card-item"
          >
            <div class="weather-daily-card-inner">
              <div class="weather-daily-main-col">
                <div class="home-conf-item-top">
                  <span class="conf-item-date mono">{{ day.dayName }}</span>
                  <span class="conf-item-city">{{ day.label }}</span>
                </div>
                <h3 class="home-conf-item-title weather-daily-date-title">{{ day.dateText || day.date || day.dayName }}</h3>
                <div class="home-conf-item-location">
                  <span>降水概率 {{ day.rain }}%</span>
                </div>
              </div>
              <div class="weather-daily-temp-side">
                <span class="weather-daily-temp-large">{{ day.low }}°—{{ day.high }}°</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位专属半宽，2个子卡片展示今天和明天) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><span>今日与明日天气</span></div>
          <span class="weather-place">{{ weatherData.temperature }}° · {{ weatherData.label }}</span>
        </div>
        <div class="home-conf-grid grid-cols-2">
          <div
            v-for="(day, idx) in weatherDailyList.slice(0, 2)"
            :key="idx"
            class="home-conf-card-item weather-daily-card-item"
          >
            <div class="weather-daily-card-inner">
              <div class="weather-daily-main-col">
                <div class="home-conf-item-top">
                  <span class="conf-item-date mono">{{ day.dayName }}</span>
                  <span class="conf-item-city">{{ day.label }}</span>
                </div>
                <h3 class="home-conf-item-title weather-daily-date-title">{{ day.dateText || day.date || day.dayName }}</h3>
                <div class="home-conf-item-location">
                  <span>降水概率 {{ day.rain }}%</span>
                </div>
              </div>
              <div class="weather-daily-temp-side">
                <span class="weather-daily-temp-large">{{ day.low }}°—{{ day.high }}°</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- =========================================================================
         4. 公共文献库 (library)
         ========================================================================= -->
    <template v-else-if="widgetId === 'library'">
      <!-- 小 (Small - 2列 x 1行) -->
      <router-link
        v-if="size === 'small'"
        to="/library"
        class="glass-card quick-destination liquid-glass-card"
      >
        <div>
          <span class="destination-label"><AppIcon name="paper-library" :size="17" />文献库</span>
          <p>让每次讨论留下记录</p>
        </div>
        <span class="destination-count">{{ libraryCount }}<AppIcon name="external" :size="16" /></span>
      </router-link>

      <!-- 最小 (Minimal - 1列 x 1行) -->
      <router-link
        v-else-if="size === 'minimal'"
        to="/library"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        title="进入文献库"
      >
        <span class="destination-label"><AppIcon name="paper-library" :size="17" />文献库</span>
        <span class="destination-count">
          <span class="count-left">{{ libraryCount }}</span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>

      <!-- 中 (Medium - 2列 x 2行，展示前 3 篇文献) -->
      <router-link
        v-else-if="size === 'medium'"
        to="/library"
        class="glass-card widget-card-medium list-widget-card liquid-glass-card"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="paper-library" :size="16" />
            <span>公共文献库 ({{ libraryCount }})</span>
          </div>
          <span class="mini-head-link">检索 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="sortedLibraryItems.length > 0" class="widget-list-items">
          <div
            v-for="item in sortedLibraryItems.slice(0, 3)"
            :key="item.id"
            class="widget-list-row cursor-pointer"
            :title="item.title"
            @click.stop="goToLibraryPaper(item, $event)"
          >
            <span class="row-bullet">·</span>
            <span class="row-title">{{ item.title }}</span>
            <span v-if="item.category" class="row-tag">{{ item.category }}</span>
          </div>
        </div>
        <div v-else class="widget-list-empty">记录团组研讨精选文献</div>
      </router-link>

      <!-- 大 (Large - 2列 x 4行，防折行标题、子卡片增高展示学术元数据、3 篇文献) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large list-widget-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left">
            <AppIcon name="paper-library" :size="17" />
            <span>文献库 ({{ libraryCount }})</span>
          </div>
          <router-link to="/library" class="v-head-link">全部 <AppIcon name="right" :size="13" /></router-link>
        </div>
        <div v-if="sortedLibraryItems.length > 0" class="conf-v-list library-v-list">
          <router-link
            v-for="item in sortedLibraryItems.slice(0, 3)"
            :key="item.id"
            :to="{ path: '/library', query: { q: item.arxiv_id || item.title } }"
            class="conf-v-item library-v-item"
            :title="item.title"
          >
            <div class="conf-v-item-top">
              <span v-if="item.primary_category || item.category" class="conf-item-city">{{ item.primary_category || item.category }}</span>
              <span v-if="formatPaperMeta(item)" class="conf-item-date mono">{{ formatPaperMeta(item) }}</span>
              <span v-if="item.journal" class="library-journal-tag">{{ item.journal }}</span>
            </div>
            <h4 class="conf-v-title library-v-title">{{ item.title }}</h4>
          </router-link>
        </div>
        <div v-else class="widget-list-empty">记录每次讨论与必读文献</div>
      </div>

      <!-- 宽 (Wide - 1号位专属全宽，收藏优先由新到旧，增高子卡片并展示学术元数据) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="paper-library" :size="18" /><span>公共文献库精选与研究积累</span></div>
          <router-link to="/library" class="conf-top-link">查看全部 ({{ libraryCount }}) <AppIcon name="right" :size="15" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-4">
          <router-link
            v-for="item in (sortedLibraryItems.length ? sortedLibraryItems.slice(0, 4) : [{ id: 1, title: '弱引力透镜宇宙学测量', authors: 'Bartelmann et al.', primary_category: 'astro-ph.CO', published_date: '2024' }, { id: 2, title: '星系团内介质 X 射线观测', authors: 'Sarazin et al.', primary_category: 'astro-ph.HE', published_date: '2023' }, { id: 3, title: '21cm 宇宙微波背景辐射分析', authors: 'Furlanetto et al.', primary_category: 'astro-ph.CO', published_date: '2024' }, { id: 4, title: '高红移类星体巡天搜寻', authors: 'Fan et al.', primary_category: 'astro-ph.GA', published_date: '2022' }])"
            :key="item.id"
            :to="{ path: '/library', query: { q: item.arxiv_id || item.title } }"
            class="home-conf-card-item library-subcard"
            :title="item.title"
          >
            <div class="home-conf-item-top">
              <span v-if="item.primary_category || item.category" class="conf-item-city">{{ item.primary_category || item.category }}</span>
              <span v-if="formatPaperMeta(item)" class="conf-item-date mono">{{ formatPaperMeta(item) }}</span>
            </div>
            <h3 class="home-conf-item-title library-subcard-title">{{ item.title }}</h3>
            <div class="home-conf-item-location">
              <div class="library-subcard-authors">
                <AppIcon name="user" :size="11" />
                <span>{{ formatAuthors(item) || '文献归档' }}</span>
              </div>
              <span v-if="item.journal" class="library-journal-tag">{{ item.journal }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位半宽，展示前2篇，增高子卡片并展示学术元数据) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="paper-library" :size="17" /><span>文献库精选</span></div>
          <router-link to="/library" class="conf-top-link">全部 <AppIcon name="right" :size="14" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-2">
          <router-link
            v-for="item in (sortedLibraryItems.length ? sortedLibraryItems.slice(0, 2) : [{ id: 1, title: '弱引力透镜测量', authors: 'Bartelmann et al.', primary_category: 'astro-ph.CO', published_date: '2024' }, { id: 2, title: '星系团 X 射线分析', authors: 'Sarazin et al.', primary_category: 'astro-ph.HE', published_date: '2023' }])"
            :key="item.id"
            :to="{ path: '/library', query: { q: item.arxiv_id || item.title } }"
            class="home-conf-card-item library-subcard"
            :title="item.title"
          >
            <div class="home-conf-item-top">
              <span v-if="item.primary_category || item.category" class="conf-item-city">{{ item.primary_category || item.category }}</span>
              <span v-if="formatPaperMeta(item)" class="conf-item-date mono">{{ formatPaperMeta(item) }}</span>
            </div>
            <h3 class="home-conf-item-title library-subcard-title">{{ item.title }}</h3>
            <div class="home-conf-item-location">
              <div class="library-subcard-authors">
                <AppIcon name="user" :size="11" />
                <span>{{ formatAuthors(item) || '文献归档' }}</span>
              </div>
              <span v-if="item.journal" class="library-journal-tag">{{ item.journal }}</span>
            </div>
          </router-link>
        </div>
      </section>
    </template>

    <!-- =========================================================================
         5. 教材与资料 (resources)
         ========================================================================= -->
    <template v-else-if="widgetId === 'resources'">
      <!-- 小 (Small - 2列 x 1行) -->
      <router-link
        v-if="size === 'small'"
        to="/resources"
        class="glass-card quick-destination liquid-glass-card"
      >
        <div>
          <span class="destination-label"><AppIcon name="resource-db" :size="17" />教材与资料</span>
          <p>常用专著、讲义与代码</p>
        </div>
        <span class="destination-count">{{ resourcesCount }}<AppIcon name="external" :size="16" /></span>
      </router-link>

      <!-- 最小 (Minimal - 1列 x 1行) -->
      <router-link
        v-else-if="size === 'minimal'"
        to="/resources"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        title="进入教材与资料"
      >
        <span class="destination-label"><AppIcon name="resource-db" :size="17" />教材资料</span>
        <span class="destination-count">
          <span class="count-left">{{ resourcesCount }}</span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>

      <!-- 中 (Medium - 2列 x 2行，展示前 3 个资料) -->
      <router-link
        v-else-if="size === 'medium'"
        to="/resources"
        class="glass-card widget-card-medium list-widget-card liquid-glass-card"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="resource-db" :size="16" />
            <span>教材与资料 ({{ resourcesCount }})</span>
          </div>
          <span class="mini-head-link">浏览 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="sortedResourcesItems.length > 0" class="widget-list-items">
          <div
            v-for="item in sortedResourcesItems.slice(0, 3)"
            :key="item.id"
            class="widget-list-row cursor-pointer"
            :title="item.title"
            @click.stop.prevent="handleResourceItemClick(item, $event)"
          >
            <span class="row-bullet">·</span>
            <span class="row-title">{{ item.title }}</span>
            <span v-if="item.category || item.type" class="row-tag">{{ item.category || item.type }}</span>
          </div>
        </div>
        <div v-else class="widget-list-empty">常用专著、讲义与代码</div>
      </router-link>

      <!-- 大 (Large - 2列 x 4行，防折行标题、带分类tag、展示 4 个资料与作者/外链) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large list-widget-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left">
            <AppIcon name="resource-db" :size="17" />
            <span>资料库 ({{ resourcesCount }})</span>
          </div>
          <router-link to="/resources" class="v-head-link">全部 <AppIcon name="right" :size="13" /></router-link>
        </div>
        <div v-if="sortedResourcesItems.length > 0" class="conf-v-list resources-v-list">
          <a
            v-for="item in sortedResourcesItems.slice(0, 4)"
            :key="item.id"
            :href="getResourceFirstLink(item) || '/resources'"
            :target="getResourceFirstLink(item) ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="conf-v-item resources-v-item cursor-pointer"
            :title="item.title"
            @click="handleResourceItemClick(item, $event)"
          >
            <div class="conf-v-item-top">
              <span v-if="item.category || item.type" class="conf-item-city resources-type-tag">{{ item.category || item.type }}</span>
            </div>
            <h4 class="conf-v-title resources-v-title">{{ item.title }}</h4>
            <div class="conf-v-location" v-if="formatAuthors(item) || isWebsiteResource(item)">
              <AppIcon :name="isWebsiteResource(item) ? 'external' : 'user'" :size="11" />
              <span>{{ isWebsiteResource(item) ? '访问' : formatAuthors(item) }}</span>
            </div>
          </a>
        </div>
        <div v-else class="widget-list-empty">常用专著与代码资料</div>
      </div>

      <!-- 宽 (Wide - 1号位专属全宽) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="resource-db" :size="18" /><span>教材、讲义与科学计算代码库</span></div>
          <router-link to="/resources" class="conf-top-link">全部资料 ({{ resourcesCount }}) <AppIcon name="right" :size="15" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-4">
          <a
            v-for="item in (sortedResourcesItems.length ? sortedResourcesItems.slice(0, 4) : [{ id: 1, title: 'Cosmology (Dodelson)', category: '经典教材', authors: 'Dodelson' }, { id: 2, title: 'Gravitational Lenses (Schneider)', category: '引力透镜', authors: 'Schneider' }, { id: 3, title: 'Astropy 数据处理讲义与实战', category: '代码讲义', authors: 'Astropy Team' }, { id: 4, title: 'MCMC 巡天参数拟合代码库', category: '算法代码', authors: 'Foreman-Mackey' }])"
            :key="item.id"
            :href="getResourceFirstLink(item) || '/resources'"
            :target="getResourceFirstLink(item) ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="home-conf-card-item cursor-pointer"
            :title="item.title"
            @click="handleResourceItemClick(item, $event)"
          >
            <h3 class="home-conf-item-title">{{ item.title }}</h3>
            <div class="home-conf-item-location resources-subcard-bottom">
              <div class="resources-bottom-left">
                <AppIcon :name="isWebsiteResource(item) ? 'external' : 'user'" :size="12" />
                <span>{{ getResourceSubcardLabel(item) }}</span>
              </div>
              <span v-if="item.category || item.type" class="conf-item-city resources-type-tag">{{ item.category || item.type }}</span>
            </div>
          </a>
        </div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位半宽) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="resource-db" :size="17" /><span>核心教材与代码</span></div>
          <router-link to="/resources" class="conf-top-link">全部 <AppIcon name="right" :size="14" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-2">
          <a
            v-for="item in (sortedResourcesItems.length ? sortedResourcesItems.slice(0, 2) : [{ id: 1, title: 'Dodelson 现代宇宙学教材', category: '专著', authors: 'Dodelson' }, { id: 2, title: 'Astropy 巡天数据分析指南', category: '代码', authors: 'Astropy Team' }])"
            :key="item.id"
            :href="getResourceFirstLink(item) || '/resources'"
            :target="getResourceFirstLink(item) ? '_blank' : undefined"
            rel="noopener noreferrer"
            class="home-conf-card-item cursor-pointer"
            :title="item.title"
            @click="handleResourceItemClick(item, $event)"
          >
            <h3 class="home-conf-item-title">{{ item.title }}</h3>
            <div class="home-conf-item-location resources-subcard-bottom">
              <div class="resources-bottom-left">
                <AppIcon :name="isWebsiteResource(item) ? 'external' : 'user'" :size="11" />
                <span>{{ getResourceSubcardLabel(item) }}</span>
              </div>
              <span v-if="item.category || item.type" class="conf-item-city resources-type-tag">{{ item.category || item.type }}</span>
            </div>
          </a>
        </div>
      </section>
    </template>

    <!-- =========================================================================
         6. 文献推荐 (arxiv)
         ========================================================================= -->
    <template v-else-if="widgetId === 'arxiv'">
      <!-- 最小 (Minimal - 1列 x 1行) -->
      <router-link
        v-if="size === 'minimal'"
        to="/arxiv"
        class="glass-card secondary-quick-link-card liquid-glass-card"
        @click="$emit('mark-arxiv')"
      >
        <span class="destination-label">
          <AppIcon name="feed-paper" :size="17" />文献推荐
        </span>
        <span class="destination-count">
          <span class="count-left">
            <span v-if="unreadArxivCount > 0" class="home-arxiv-badge" :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }">
              {{ unreadArxivCount > 99 ? '99+' : unreadArxivCount }}
            </span>
            <span>{{ arxivCount }}</span>
          </span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>

      <!-- 小 (Small - 2列 x 1行，展示最近1篇推荐文献标题，字体小) -->
      <router-link
        v-else-if="size === 'small'"
        :to="sortedArxivItems[0] ? { path: '/arxiv', query: { paper_id: sortedArxivItems[0].id, arxiv_id: sortedArxivItems[0].arxiv_id, highlight: '1' } } : '/arxiv'"
        class="glass-card widget-card-small arxiv-small-row liquid-glass-card"
        @click="$emit('mark-arxiv')"
      >
        <div class="arxiv-s-left">
          <AppIcon name="feed-paper" :size="16" />
          <div class="arxiv-s-info">
            <div class="arxiv-s-top-line">
              <span class="arxiv-s-label">文献推荐</span>
              <span v-if="unreadArxivCount > 0" class="home-arxiv-badge" :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }">
                {{ unreadArxivCount > 99 ? '99+' : unreadArxivCount }}
              </span>
            </div>
            <p class="arxiv-s-paper-title">{{ sortedArxivItems[0]?.title || '发现与研读最新学术论文' }}</p>
          </div>
        </div>
        <div class="arxiv-s-right">
          <AppIcon name="right" :size="13" />
        </div>
      </router-link>

      <!-- 中 (Medium - 2列 x 2行，展示前 3 篇文献，修复推荐人显示) -->
      <router-link
        v-else-if="size === 'medium'"
        to="/arxiv"
        class="glass-card widget-card-medium list-widget-card liquid-glass-card"
        @click="$emit('mark-arxiv')"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="feed-paper" :size="16" />
            <span>文献推荐流 ({{ arxivCount }})</span>
            <span v-if="unreadArxivCount > 0" class="home-arxiv-badge" :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }">
              {{ unreadArxivCount }}
            </span>
          </div>
          <span class="mini-head-link">发现最新 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="sortedArxivItems.length > 0" class="widget-list-items">
          <div
            v-for="item in sortedArxivItems.slice(0, 3)"
            :key="item.id"
            class="widget-list-row cursor-pointer"
            :title="item.title"
            @click.stop="goToArxivPaper(item, $event)"
          >
            <span class="row-bullet">·</span>
            <span class="row-title">{{ item.title }}</span>
            <span v-if="formatRecommender(item)" class="row-tag">{{ formatRecommender(item) }}</span>
          </div>
        </div>
        <div v-else class="widget-list-empty">发现值得一起读的论文</div>
      </router-link>

      <!-- 大 (Large - 2列 x 4行，防折行标题、子卡片展示 3 篇文献与推荐人，仅英文标题) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large list-widget-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left">
            <AppIcon name="feed-paper" :size="17" />
            <span>文献推荐 ({{ arxivCount }})</span>
            <span v-if="unreadArxivCount > 0" class="home-arxiv-badge" :class="{ 'is-gold': hasDirectArxiv, 'is-red': !hasDirectArxiv }">
              {{ unreadArxivCount }}
            </span>
          </div>
          <router-link to="/arxiv" class="v-head-link">全部 <AppIcon name="right" :size="13" /></router-link>
        </div>
        <div v-if="sortedArxivItems.length > 0" class="conf-v-list arxiv-v-list">
          <router-link
            v-for="item in sortedArxivItems.slice(0, 3)"
            :key="item.id"
            :to="{ path: '/arxiv', query: { paper_id: item.id, arxiv_id: item.arxiv_id, highlight: '1' } }"
            class="conf-v-item arxiv-v-item"
            :title="item.title"
            @click="$emit('mark-arxiv')"
          >
            <h4 class="conf-v-title arxiv-v-title">{{ item.title }}</h4>
            <div class="conf-v-location" v-if="formatRecommender(item)">
              <AppIcon name="user" :size="11" />
              <span>{{ formatRecommender(item) }} 推荐</span>
            </div>
          </router-link>
        </div>
        <div v-else class="widget-list-empty">发现值得一起读的论文</div>
      </div>

      <!-- 宽 (Wide - 1号位专属全宽，由新到旧排序，去掉顶栏与标记，展示推荐人) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="feed-paper" :size="18" /><span>arXiv 文献前沿速递与导读专栏</span></div>
          <router-link to="/arxiv" class="conf-top-link">进入推荐流 ({{ arxivCount }}) <AppIcon name="right" :size="15" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-4">
          <router-link
            v-for="item in (sortedArxivItems.length ? sortedArxivItems.slice(0, 4) : [
              { id: 1, title: 'Weak lensing shear measurement systematics with Roman Telescope', recommender: '导师' },
              { id: 2, title: 'Galaxy clustering tomography and neutrino mass constraint', recommender: '前沿速递' },
              { id: 3, title: 'JWST Cycle 3 Early Results on strongly lensed galaxies', recommender: '重点研读' },
              { id: 4, title: 'Machine learning for cosmological simulation emulators', recommender: '算法工具' }
            ])"
            :key="item.id"
            :to="{ path: '/arxiv', query: { paper_id: item.id, arxiv_id: item.arxiv_id, highlight: '1' } }"
            class="home-conf-card-item"
            :title="item.title"
            @click="$emit('mark-arxiv')"
          >
            <h3 class="home-conf-item-title">{{ item.title }}</h3>
            <div class="home-conf-item-location">
              <AppIcon name="user" :size="12" />
              <span>{{ formatRecommender(item) || '导师推荐' }}</span>
            </div>
          </router-link>
        </div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位半宽，展示前2篇，展示推荐人) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="feed-paper" :size="17" /><span>文献前沿与导读</span></div>
          <router-link to="/arxiv" class="conf-top-link">全部 <AppIcon name="right" :size="14" /></router-link>
        </div>
        <div class="home-conf-grid grid-cols-2">
          <router-link
            v-for="item in (sortedArxivItems.length ? sortedArxivItems.slice(0, 2) : [
              { id: 1, title: 'Weak lensing shear measurement with Roman Telescope', recommender: '导师' },
              { id: 2, title: 'Galaxy clustering tomography and neutrino mass', recommender: '重点研读' }
            ])"
            :key="item.id"
            :to="{ path: '/arxiv', query: { paper_id: item.id, arxiv_id: item.arxiv_id, highlight: '1' } }"
            class="home-conf-card-item"
            :title="item.title"
            @click="$emit('mark-arxiv')"
          >
            <h3 class="home-conf-item-title">{{ item.title }}</h3>
            <div class="home-conf-item-location">
              <AppIcon name="user" :size="11" />
              <span>{{ formatRecommender(item) || '导师推荐' }}</span>
            </div>
          </router-link>
        </div>
      </section>
    </template>

    <!-- =========================================================================
         7. 学术邮箱 (mailbox)
         ========================================================================= -->
    <template v-else-if="widgetId === 'mailbox'">
      <!-- 最小 (Minimal - 1列 x 1行) -->
      <router-link
        v-if="size === 'minimal'"
        to="/mailbox"
        class="glass-card secondary-quick-link-card liquid-glass-card"
      >
        <span class="destination-label">
          <AppIcon name="envelope" :size="17" />学术邮箱
        </span>
        <span class="destination-count">
          <span class="count-left">{{ mailboxEmails.length ? `${mailboxEmails.length} 封` : mailboxCount }}</span>
          <AppIcon name="external" :size="16" />
        </span>
      </router-link>

      <!-- 小 (Small - 2列 x 1行，仅显示邮箱入口) -->
      <router-link
        v-else-if="size === 'small'"
        :to="mailboxEmails[0] ? { path: '/mailbox', query: { email_id: mailboxEmails[0].id } } : '/mailbox'"
        class="glass-card widget-card-small mailbox-small-row liquid-glass-card"
      >
        <div class="mailbox-s-left">
          <AppIcon name="envelope" :size="16" />
          <div class="mailbox-s-info">
            <span class="mailbox-s-label">学术邮箱</span>
            <span class="mailbox-s-status">POP3 / IMAP 邮件直通 ({{ mailboxEmails.length ? `${mailboxEmails.length} 封` : mailboxCount }})</span>
          </div>
        </div>
        <span class="mailbox-s-link">进入邮箱 <AppIcon name="external" :size="14" /></span>
      </router-link>

      <!-- 中 (Medium - 2列 x 2行，展示前 3 条邮件) -->
      <router-link
        v-else-if="size === 'medium'"
        to="/mailbox"
        class="glass-card widget-card-medium list-widget-card liquid-glass-card"
      >
        <div class="card-mini-head">
          <div class="mini-head-left">
            <AppIcon name="envelope" :size="16" />
            <span>学术邮箱 ({{ mailboxEmails.length ? `${mailboxEmails.length} 封` : mailboxCount }})</span>
          </div>
          <span class="mini-head-link">收件箱 <AppIcon name="right" :size="12" /></span>
        </div>
        <div v-if="mailboxEmails.length > 0" class="widget-list-items">
          <div
            v-for="mail in mailboxEmails.slice(0, 3)"
            :key="mail.id"
            class="widget-list-row cursor-pointer"
            :title="mail.subject"
            @click.stop="goToMail(mail, $event)"
          >
            <span class="row-bullet">·</span>
            <span class="row-title">{{ mail.subject || '无主题邮件' }}</span>
            <span v-if="formatMailSender(mail)" class="row-tag">{{ formatMailSender(mail) }}</span>
          </div>
        </div>
        <div v-else class="widget-list-items">
          <div class="widget-list-row">
            <span class="row-bullet">·</span>
            <span class="row-title">智能提取学术讲座通知</span>
            <span class="row-tag">通知</span>
          </div>
          <div class="widget-list-row">
            <span class="row-bullet">·</span>
            <span class="row-title">高校与机构 POP3/IMAP 直通</span>
            <span class="row-tag">邮箱</span>
          </div>
          <div class="widget-list-row">
            <span class="row-bullet">·</span>
            <span class="row-title">自动关联本周学术研讨日程</span>
            <span class="row-tag">日程</span>
          </div>
        </div>
      </router-link>

      <!-- 大 (Large - 2列 x 4行，防折行标题、3 条子卡片展示邮件) -->
      <div
        v-else-if="size === 'large'"
        class="glass-card widget-vertical-large list-widget-card liquid-glass-card"
      >
        <div class="widget-v-head">
          <div class="v-head-left">
            <AppIcon name="envelope" :size="17" />
            <span>学术邮箱 ({{ mailboxEmails.length ? `${mailboxEmails.length} 封` : mailboxCount }})</span>
          </div>
          <router-link to="/mailbox" class="v-head-link">进入 <AppIcon name="right" :size="13" /></router-link>
        </div>
        <div v-if="mailboxEmails.length > 0" class="conf-v-list mailbox-v-list">
          <router-link
            v-for="mail in mailboxEmails.slice(0, 3)"
            :key="mail.id"
            :to="{ path: '/mailbox', query: { email_id: mail.id } }"
            class="conf-v-item mailbox-v-item"
            :title="mail.subject"
          >
            <div class="conf-v-item-top">
              <span class="conf-item-date mono">{{ formatMailDate(mail) }}</span>
              <span v-if="formatMailSender(mail)" class="conf-item-city">{{ formatMailSender(mail) }}</span>
              <span v-if="formatMailAddress(mail)" class="mailbox-sender-chip mono">{{ formatMailAddress(mail) }}</span>
              <span v-if="mail.has_attachments || mail.attachments?.length" class="mailbox-att-pill">
                <AppIcon name="paperclip" :size="10" /> 附件
              </span>
            </div>
            <h4 class="conf-v-title mailbox-v-title">{{ mail.subject || '无主题邮件' }}</h4>
            <p v-if="formatMailSnippet(mail)" class="mailbox-v-snippet">{{ formatMailSnippet(mail) }}</p>
          </router-link>
        </div>
        <div v-else class="conf-v-list mailbox-v-list">
          <div class="conf-v-item mailbox-v-item">
            <div class="conf-v-item-top"><span class="conf-item-date mono">邮件同步</span><span class="conf-item-city">POP3 / IMAP</span></div>
            <h4 class="conf-v-title mailbox-v-title">智能扫描校内通知与报告邀约</h4>
            <p class="mailbox-v-snippet">自动提取会议、组会与讲座时间线，快速沉淀为科研日程</p>
          </div>
          <div class="conf-v-item mailbox-v-item">
            <div class="conf-v-item-top"><span class="conf-item-date mono">服务支持</span><span class="conf-item-city">直通收件箱</span></div>
            <h4 class="conf-v-title mailbox-v-title">配置机构邮箱以开启实时同步</h4>
            <p class="mailbox-v-snippet">支持各类科研机构、大学与学术单位机构邮箱</p>
          </div>
          <div class="conf-v-item mailbox-v-item">
            <div class="conf-v-item-top"><span class="conf-item-date mono">安全防护</span><span class="conf-item-city">本地存储</span></div>
            <h4 class="conf-v-title mailbox-v-title">端到端凭据保护与私密浏览</h4>
            <p class="mailbox-v-snippet">密码凭据加密保存，随时可一键清空本地缓存</p>
          </div>
        </div>
      </div>

      <!-- 宽 (Wide - 1号位专属全宽，4 条邮件子卡片) -->
      <section
        v-else-if="size === 'wide'"
        class="glass-card home-conf-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="envelope" :size="18" /><span>学术邮箱直通</span></div>
          <router-link to="/mailbox" class="conf-top-link">全部邮件 ({{ mailboxEmails.length ? `${mailboxEmails.length} 封` : mailboxCount }}) <AppIcon name="right" :size="15" /></router-link>
        </div>
        <div v-if="mailboxEmails.length > 0" class="home-conf-grid grid-cols-4">
          <router-link
            v-for="mail in mailboxEmails.slice(0, 4)"
            :key="mail.id"
            :to="{ path: '/mailbox', query: { email_id: mail.id } }"
            class="home-conf-card-item"
            :title="mail.subject"
          >
            <div class="home-conf-item-top">
              <span class="conf-item-date mono">{{ formatMailDate(mail) }}</span>
              <span v-if="mail.has_attachments || mail.attachments?.length" class="mailbox-att-pill">
                <AppIcon name="paperclip" :size="10" /> 附件
              </span>
            </div>
            <h3 class="home-conf-item-title">{{ mail.subject || '无主题邮件' }}</h3>
            <div v-if="formatMailSender(mail) || formatMailAddress(mail)" class="home-conf-item-location mailbox-subcard-bottom">
              <AppIcon name="user" :size="11" />
              <span v-if="formatMailSender(mail)" class="mailbox-sub-sender">{{ formatMailSender(mail) }}</span>
              <span v-if="formatMailAddress(mail) && formatMailAddress(mail) !== formatMailSender(mail)" class="mailbox-sub-email mono">{{ formatMailAddress(mail) }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="home-conf-grid grid-cols-2">
          <div class="home-conf-card-item">
            <div class="home-conf-item-top"><span class="conf-item-date mono">服务状态</span><span class="conf-item-city">正常直通</span></div>
            <h3 class="home-conf-item-title">POP3 / IMAP 高速收信协议支持</h3>
            <div class="home-conf-item-location">支持各类高校与学术科研机构邮箱</div>
          </div>
          <div class="home-conf-card-item">
            <div class="home-conf-item-top"><span class="conf-item-date mono">AI 提取</span><span class="conf-item-city">已启用</span></div>
            <h3 class="home-conf-item-title">学术报告与组会通知一键添加到日历</h3>
            <div class="home-conf-item-location">避免遗漏重要学术交流与线上报告</div>
          </div>
        </div>
      </section>

      <!-- 中宽 (Medium-Wide - 1号位半宽，2 条邮件子卡片) -->
      <section
        v-else-if="size === 'medium-wide'"
        class="glass-card home-conf-section conf-medium-wide-section liquid-glass-card"
      >
        <div class="home-conf-heading">
          <div class="heading-left"><AppIcon name="envelope" :size="17" /><span>学术邮箱直通</span></div>
          <router-link to="/mailbox" class="conf-top-link">全部 <AppIcon name="right" :size="14" /></router-link>
        </div>
        <div v-if="mailboxEmails.length > 0" class="home-conf-grid grid-cols-2">
          <router-link
            v-for="mail in mailboxEmails.slice(0, 2)"
            :key="mail.id"
            :to="{ path: '/mailbox', query: { email_id: mail.id } }"
            class="home-conf-card-item"
            :title="mail.subject"
          >
            <div class="home-conf-item-top">
              <span class="conf-item-date mono">{{ formatMailDate(mail) }}</span>
              <span v-if="mail.has_attachments || mail.attachments?.length" class="mailbox-att-pill">
                <AppIcon name="paperclip" :size="10" /> 附件
              </span>
            </div>
            <h3 class="home-conf-item-title">{{ mail.subject || '无主题邮件' }}</h3>
            <div v-if="formatMailSender(mail) || formatMailAddress(mail)" class="home-conf-item-location mailbox-subcard-bottom">
              <AppIcon name="user" :size="11" />
              <span v-if="formatMailSender(mail)" class="mailbox-sub-sender">{{ formatMailSender(mail) }}</span>
              <span v-if="formatMailAddress(mail) && formatMailAddress(mail) !== formatMailSender(mail)" class="mailbox-sub-email mono">{{ formatMailAddress(mail) }}</span>
            </div>
          </router-link>
        </div>
        <div v-else class="home-conf-grid grid-cols-2">
          <div class="home-conf-card-item">
            <div class="home-conf-item-top"><span class="conf-item-date mono">邮件提取</span></div>
            <h3 class="home-conf-item-title">支持校内与机构邮箱</h3>
          </div>
          <div class="home-conf-card-item">
            <div class="home-conf-item-top"><span class="conf-item-date mono">服务协议</span></div>
            <h3 class="home-conf-item-title">POP3 / IMAP 直通</h3>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.home-widget-card-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: block;
  overflow: hidden;
}
.home-widget-card-wrapper > * {
  width: 100% !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  overflow: hidden !important;
}
.home-widget-card-wrapper.is-in-edit-mode {
  user-select: none !important;
  -webkit-user-select: none !important;
}
.home-widget-card-wrapper.is-in-edit-mode * {
  user-select: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
}
.home-widget-card-wrapper.is-in-edit-mode a {
  pointer-events: none !important;
  user-select: none !important;
  -webkit-user-select: none !important;
  -webkit-user-drag: none !important;
}

/* 1 号位：近期学术会议样式（与 34be100 scoped 100% 吻合） */
.home-conf-section {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  gap: 10px;
  margin-top: 0;
  border-radius: 20px;
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
.home-conf-grid.grid-cols-1 { grid-template-columns: 1fr; }
.home-conf-grid.grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.home-conf-grid.grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.home-conf-grid.grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

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
.conf-item-urgent.is-urgent { color: #f59e0b; }
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
.conf-mini-empty p { margin: 0; }

/* 经典 最小卡片 (Minimal: 1列 x 1行，强制靠左对齐) */
.home-widget-card-wrapper.widget-size-minimal {
  text-align: left !important;
}
.secondary-quick-link-card,
.home-widget-card-wrapper.widget-size-minimal .secondary-quick-link-card {
  min-height: 0 !important;
  height: 100% !important;
  padding: 12px 14px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: center !important;
  text-align: left !important;
  gap: 3px !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
}
.secondary-quick-link-card .destination-label,
.home-widget-card-wrapper.widget-size-minimal .destination-label {
  font-size: 15px !important;
  font-weight: 500 !important;
  color: var(--text) !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: flex-start !important;
  align-self: flex-start !important;
  text-align: left !important;
  gap: 6px !important;
  white-space: nowrap !important;
  line-height: 1.2 !important;
}
.secondary-quick-link-card .destination-count,
.home-widget-card-wrapper.widget-size-minimal .destination-count {
  font-size: 13px !important;
  color: var(--soft) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  width: 100% !important;
  white-space: nowrap !important;
  line-height: 1.2 !important;
}
.secondary-quick-link-card .count-left,
.home-widget-card-wrapper.widget-size-minimal .count-left {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  white-space: nowrap !important;
}
.secondary-quick-link-card p {
  display: none !important;
}

/* 经典 小号卡片 (Small: 2列 x 1行) */
.quick-destination {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 16px 18px !important;
  min-height: 0 !important;
  height: 100% !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
  gap: 10px !important;
}
.quick-destination > div {
  min-width: 0 !important;
  flex: 1 !important;
}
.quick-destination .destination-label {
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  font-size: 15px !important;
  font-weight: 500 !important;
  line-height: 1.2 !important;
}
.quick-destination p {
  font-size: 12px !important;
  color: var(--soft) !important;
  margin: 7px 0 0 !important;
  line-height: 1.2 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.quick-destination .destination-count {
  font-size: 13px !important;
  font-weight: 400 !important;
  color: inherit !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  flex-shrink: 0 !important;
}

/* 经典 最近一次组会 (Large: 2列 x 4行) */
.next-meeting {
  display: flex !important;
  flex-direction: column !important;
  padding: 16px 18px 14px !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
}
.next-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13.5px;
  flex-shrink: 0;
}
.next-heading > span {
  display: flex;
  align-items: center;
  gap: 8px;
}
.next-date {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 8px 0 6px;
  flex-shrink: 0;
}
.next-date > span {
  font-size: 64px;
  font-weight: 300;
  letter-spacing: -0.07em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.next-date > div {
  padding-top: 6px;
  font-size: 16px;
}
.next-date small {
  display: block;
  font-size: 11.5px;
  margin-top: 4px;
  color: var(--soft);
}
.next-meeting h2 {
  font-size: 16px;
  line-height: 1.38;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
  flex-shrink: 0;
}
.next-presenter {
  font-size: 13px;
  color: var(--soft);
  margin-top: 4px;
  flex-shrink: 0;
}
.next-meta {
  margin: 10px 0 8px;
  display: grid;
  gap: 6px;
  flex-shrink: 0;
}
.next-meta p {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 11.5px;
  color: var(--soft);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.next-bottom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12.5px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
  margin-top: auto !important;
  flex-shrink: 0;
}
.next-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 24px 10px;
  gap: 8px;
  margin: auto 0;
}
.next-empty h2 {
  font-size: 16px;
  color: var(--text);
}
.next-empty p {
  font-size: 12.5px;
  color: var(--soft);
  margin: 0;
}

/* 中 (Medium: 最近组会) */
.next-medium-card {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  padding: 14px 16px !important;
  height: 100% !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
  overflow: hidden !important;
}
.next-medium-date-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  background: var(--surface-hover, rgba(255, 255, 255, 0.06));
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
}
.next-medium-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin-top: 4px;
}
.next-medium-topic {
  font-size: 13.5px;
  font-weight: 600;
  line-height: 1.38;
  color: var(--text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 2.76em;
}
.next-medium-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11.5px;
  color: var(--soft);
  min-width: 0;
  overflow: hidden;
}
.next-medium-speaker, .next-medium-arxiv {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next-medium-speaker {
  flex-shrink: 0;
}
.next-medium-arxiv {
  color: var(--text-muted);
}

/* 组会子卡片样式 (Wide & Medium-Wide) */
.next-conf-subcard {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px !important;
}
.next-conf-top-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  flex-wrap: nowrap !important;
  width: 100% !important;
}
.next-conf-top-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}
.next-conf-time-badge {
  margin-left: auto;
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--accent);
  font-weight: 600;
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
}
.next-subcard-presenters {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: var(--soft);
  margin-top: auto;
  min-width: 0;
}
.next-subcard-presenters-left {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.next-subcard-main, .next-subcard-arxiv {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next-subcard-arxiv {
  color: var(--text-muted, #94a3b8);
  font-size: 10.5px;
}

.conf-medium-wide-section {
  height: 100%;
  box-sizing: border-box;
}

.conf-s-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.conf-ranking-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--accent, #a5b4fc);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  white-space: nowrap;
  flex-shrink: 0;
}
.conf-ranking-badge.is-urgent {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(245, 158, 11, 0.35);
  color: #f59e0b;
}

/* 经典 今日天气 (Medium: 2列 x 2行) */
.weather-card {
  padding: 18px 20px !important;
  min-height: 0 !important;
  height: 100% !important;
  box-sizing: border-box !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
}
.weather-place {
  color: var(--muted);
  font-size: 12px;
}
.weather-reading {
  display: flex;
  align-items: baseline !important;
  justify-content: space-between;
  gap: 16px;
  margin: 12px 0 10px;
}
.weather-reading > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.weather-reading strong {
  font-size: 28px;
  font-weight: 400;
  white-space: nowrap;
}
.weather-reading span,
.weather-feels-tag,
.weather-meta {
  color: var(--soft);
  font-size: 12px;
}
.weather-feels-tag,
.weather-reading > div span {
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}
.weather-reading .weather-range {
  text-align: right;
  flex-shrink: 0;
  white-space: nowrap !important;
}
.weather-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

/* 扩展尺寸通用排版规范（中、大卡列表型） */
.list-widget-card {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  height: 100% !important;
  padding: 16px 18px !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
}
.card-mini-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 8px;
}
.mini-head-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mini-head-link {
  font-size: 11.5px;
  color: var(--soft);
  display: flex;
  align-items: center;
  gap: 2px;
}
.widget-list-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  justify-content: center;
}
.widget-list-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text);
}
.widget-list-row.cursor-pointer {
  cursor: pointer;
  padding: 2px 4px;
  margin: -2px -4px;
  border-radius: 4px;
  transition: background 0.15s ease, color 0.15s ease;
}
.widget-list-row.cursor-pointer:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.08));
  color: var(--accent, #6366f1);
}
.widget-list-row.cursor-pointer:hover .row-title {
  color: var(--accent, #6366f1);
}
.widget-list-row.cursor-pointer:hover .row-bullet {
  color: var(--accent, #6366f1);
}
.row-bullet { color: var(--soft); }
.row-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.row-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--soft);
  flex-shrink: 0;
}
.row-tag.urgent {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.widget-list-empty {
  font-size: 12px;
  color: var(--soft);
  text-align: center;
  margin: auto 0;
}

/* 纵向大卡 (Large) */
.widget-vertical-large {
  min-height: 0 !important;
  height: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  padding: 18px 20px !important;
  box-sizing: border-box !important;
}
.widget-v-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 8px;
  min-width: 0;
  flex-shrink: 0;
}
.v-head-left {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
}
.v-head-left span {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.v-head-link {
  font-size: 12px;
  color: var(--soft);
  text-decoration: none;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap !important;
  flex-shrink: 0 !important;
}

/* 天气宽卡子卡片 (气温放大在右侧，原区域显示日期) */
.weather-daily-card-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 8px;
}
.weather-daily-main-col {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.weather-daily-date-title {
  margin: 0;
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--text) !important;
  min-height: auto !important;
  line-height: 1.2 !important;
}
.weather-daily-temp-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}
.weather-daily-temp-large {
  font-size: 15px;
  font-weight: 700;
  color: var(--accent);
  white-space: nowrap;
  letter-spacing: -0.02em;
}

/* 天气大卡 (Large) & 分时预测 (今日天气多维大卡) */
.weather-large-card {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  padding: 15px 14px 13px !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  height: 100% !important;
}
.weather-large-card .widget-v-head {
  margin-bottom: 6px !important;
  flex-shrink: 0 !important;
}
.weather-large-today-reading {
  display: flex !important;
  align-items: baseline !important;
  justify-content: space-between !important;
  gap: 16px !important;
  margin: 0 0 8px !important;
  flex-shrink: 0 !important;
}
.weather-large-today-reading strong {
  font-size: 34px !important;
  font-weight: 400 !important;
  white-space: nowrap !important;
  line-height: 1 !important;
}
.weather-large-today-reading .weather-range {
  font-size: 22px !important;
  font-weight: 400 !important;
  white-space: nowrap !important;
  text-align: right;
  flex-shrink: 0;
}

/* 三大气象指标独立 Bento 小卡网格 */
.weather-large-today-meta.weather-metrics-grid {
  display: grid !important;
  grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
  gap: 6px !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  border-radius: 0 !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
}
.weather-metric-card {
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  gap: 2px !important;
  padding: 8px 7px 7px !important;
  background: var(--surface) !important;
  border: 1px solid var(--line) !important;
  border-radius: 8px !important;
  min-width: 0 !important;
  min-height: 56px !important;
  box-sizing: border-box !important;
  transition: all 0.2s ease !important;
}
.weather-metric-card:hover {
  border-color: var(--accent) !important;
  background: var(--surface-hover) !important;
}
.w-metric-top {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  font-size: 11px !important;
  color: var(--soft) !important;
  min-width: 0 !important;
}
.w-metric-icon {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 12px !important;
  height: 12px !important;
  flex-shrink: 0 !important;
}
.w-metric-icon svg {
  width: 100% !important;
  height: 100% !important;
}
.w-metric-icon.humidity-icon { color: #38bdf8 !important; }
.w-metric-icon.wind-icon { color: #34d399 !important; }
.w-metric-icon.rain-icon { color: #818cf8 !important; }

.w-metric-label {
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.w-metric-val {
  font-size: 13.5px !important;
  font-weight: 600 !important;
  color: var(--text) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
  letter-spacing: -0.02em !important;
}
.wind-metric-val {
  display: flex !important;
  align-items: baseline !important;
  gap: 2px !important;
  min-width: 0 !important;
  white-space: nowrap !important;
}
.wind-metric-val .w-metric-num {
  font-size: 13.5px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  line-height: 1.1 !important;
}
.wind-metric-val.is-text-wind .w-metric-num {
  font-size: 11.5px !important;
  letter-spacing: -0.01em !important;
}
.wind-metric-val .w-metric-unit {
  font-size: 9.5px !important;
  font-weight: 500 !important;
  color: var(--soft) !important;
  line-height: 1.1 !important;
  opacity: 0.85 !important;
}
.w-metric-hint {
  font-size: 9.5px !important;
  color: var(--soft) !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  opacity: 0.85 !important;
}

/* 未来分时气象区域 */
.weather-hourly-section {
  display: flex !important;
  flex-direction: column !important;
  flex: 1 !important;
  min-height: 0 !important;
  margin-top: 12px !important;
  padding-top: 10px !important;
  padding-bottom: 0 !important;
  border-top: 1px solid var(--line) !important;
  width: 100% !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
}
.weather-hourly-title-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  margin-bottom: 8px !important;
  flex-shrink: 0 !important;
}
.weather-hourly-title {
  font-size: 12px !important;
  font-weight: 600 !important;
  color: var(--soft) !important;
}
.weather-hourly-sub {
  font-size: 10px !important;
  color: var(--soft) !important;
  opacity: 0.75 !important;
}
.weather-hourly-grid {
  display: grid !important;
  grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
  gap: 4px !important;
  width: 100% !important;
  flex: 1 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}
.weather-hour-col {
  min-width: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 82px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 2px !important;
  padding: 7px 1px 6px !important;
  background: var(--surface) !important;
  border-radius: 7px !important;
  border: 1px solid var(--line) !important;
  box-sizing: border-box !important;
  overflow: hidden !important;
  transition: all 0.2s ease !important;
}
.weather-hour-col:hover {
  border-color: var(--accent) !important;
  background: var(--surface-hover) !important;
}
.w-hour-time {
  font-size: 10px !important;
  color: var(--soft) !important;
  white-space: nowrap !important;
  line-height: 1.1 !important;
  text-align: center !important;
}
.w-hour-icon {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 15px !important;
  height: 15px !important;
  flex-shrink: 0 !important;
  margin: 0 !important;
}
.w-hour-icon svg {
  width: 100% !important;
  height: 100% !important;
}
.w-hour-icon.icon-sun { color: #f59e0b !important; }
.w-hour-icon.icon-cloud { color: #94a3b8 !important; }
.w-hour-icon.icon-rain { color: #38bdf8 !important; }

.w-hour-temp {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: var(--text) !important;
  line-height: 1.1 !important;
  text-align: center !important;
  white-space: nowrap !important;
}
.w-hour-rain-tag {
  font-size: 8.5px !important;
  color: #818cf8 !important;
  line-height: 1 !important;
  white-space: nowrap !important;
}
.w-hour-label {
  font-size: 9px !important;
  color: var(--soft) !important;
  white-space: nowrap !important;
  line-height: 1.1 !important;
  text-align: center !important;
  max-width: 100% !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  display: block !important;
}

.conf-v-list {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
}
.conf-v-item {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 4px;
  padding: 8px 11px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 9px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s ease;
  min-width: 0;
}
.conf-v-item:hover {
  border-color: var(--accent);
  background: var(--surface-hover);
}
.conf-v-item-top {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  min-width: 0;
  flex-wrap: wrap;
}
.conf-v-title {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  margin: 0;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}
.conf-v-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.conf-v-location span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文献库专属子卡片样式 (宽卡、中宽卡、大卡) */
.library-subcard {
  padding: 12px 14px !important;
  min-height: 104px !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  gap: 6px !important;
}
.library-subcard-title {
  font-size: 13px !important;
  font-weight: 500 !important;
  line-height: 1.4 !important;
  display: -webkit-box !important;
  -webkit-line-clamp: 2 !important;
  -webkit-box-orient: vertical !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  min-height: 2.8em !important;
}
.library-subcard-authors {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.library-journal-tag {
  font-size: 10px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-hover);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
  white-space: nowrap;
  flex-shrink: 0;
  margin-left: auto;
}
.library-v-list {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
}
.library-v-item {
  flex: 1;
  min-height: 68px;
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 9px;
  gap: 4px;
}
.library-v-title {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

/* 资料库大卡子卡片样式 (放4条，紧凑且刚好占满大卡) */
.resources-v-list {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 6px;
  flex: 1;
}
.resources-v-item {
  flex: 1;
  min-height: 48px;
  padding: 6px 11px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 8px;
  gap: 2px;
}
.resources-v-title {
  font-size: 12px;
  font-weight: 500;
  line-height: 1.25;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 文献推荐大卡子卡片样式 */
.arxiv-v-list {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
}
.arxiv-v-item {
  flex: 1;
  min-height: 68px;
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 9px;
  gap: 4px;
}
.arxiv-v-title {
  font-size: 12.5px;
  font-weight: 500;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
}

/* 邮箱大卡子卡片样式 (保持3条，展示发件人地址、摘要片段、附件标示，占满大卡) */
.mailbox-v-list {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
  flex: 1;
}
.mailbox-v-item {
  flex: 1;
  min-height: 70px;
  padding: 9px 12px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: 9px;
  gap: 3px;
}
.mailbox-sender-chip {
  font-size: 10px;
  color: var(--soft);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-left: auto;
}
.mailbox-v-title {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text);
  line-height: 1.3;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mailbox-v-snippet {
  font-size: 11px;
  color: var(--soft);
  line-height: 1.35;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  opacity: 0.85;
}
.mailbox-v-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  font-size: 10.5px;
  color: var(--soft);
}
.mailbox-footer-left {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mailbox-att-pill {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9.5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  white-space: nowrap;
  flex-shrink: 0;
}

/* 文献单行 (arxiv small) */
.arxiv-small-row, .next-small-row, .conf-small-row, .weather-small-row, .mailbox-small-row {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  padding: 12px 16px !important;
  min-height: 0 !important;
  height: 100% !important;
  box-sizing: border-box !important;
  text-decoration: none !important;
  color: inherit !important;
}
.arxiv-s-left, .next-s-left, .conf-s-left, .weather-s-left, .mailbox-s-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
}
.arxiv-s-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}
.arxiv-s-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  white-space: nowrap;
}
.arxiv-s-title {
  font-size: 12.5px;
  color: var(--text);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next-s-info, .conf-s-info, .weather-s-info, .mailbox-s-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.next-s-topic, .conf-s-title, .weather-s-temp, .mailbox-s-label {
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.next-s-sub, .conf-s-date, .weather-s-sub, .mailbox-s-status {
  font-size: 11px;
  color: var(--soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 徽章 */
.home-arxiv-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
}
.home-arxiv-badge.is-red {
  background: #ef4444;
  color: #fff;
}
.home-arxiv-badge.is-gold {
  background: #f59e0b;
  color: #000;
}

.mailbox-s-link,
.mailbox-s-badge {
  font-size: 13px;
  font-weight: 400;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--soft);
  white-space: nowrap;
  flex-shrink: 0;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  transition: color 0.15s ease;
}
.mailbox-s-link .app-icon,
.mailbox-s-badge .app-icon {
  opacity: 0.75;
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.mailbox-small-row:hover .mailbox-s-link,
.mailbox-small-row:hover .mailbox-s-badge {
  color: var(--text);
}
.mailbox-small-row:hover .mailbox-s-link .app-icon,
.mailbox-small-row:hover .mailbox-s-badge .app-icon {
  opacity: 1;
  transform: translate(1px, -1px);
}
.mailbox-subcard-bottom {
  display: flex !important;
  align-items: center !important;
  gap: 5px !important;
  min-width: 0 !important;
  overflow: hidden !important;
  white-space: nowrap !important;
}
.mailbox-sub-sender {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary, #94a3b8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}
.mailbox-sub-email {
  font-size: 10px;
  color: var(--soft);
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.resources-subcard-bottom {
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
  gap: 6px !important;
  width: 100% !important;
}
.resources-bottom-left {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.resources-type-tag {
  margin-left: auto;
  flex-shrink: 0;
}
.arxiv-s-top-line {
  display: flex;
  align-items: center;
  gap: 6px;
}
.arxiv-s-paper-title {
  font-size: 11.5px;
  color: var(--soft);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
  max-width: 240px;
  line-height: 1.3;
}
</style>
