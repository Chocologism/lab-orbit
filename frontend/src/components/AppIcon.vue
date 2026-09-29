<script setup>
import { PhArrowLeft, PhArrowRight, PhArrowUpRight, PhCalendarBlank, PhCheck, PhX, PhPlus, PhMagnifyingGlass, PhBookOpen, PhArticle, PhDotsSixVertical, PhArrowCounterClockwise, PhSignOut, PhBookmarkSimple, PhStar, PhPencilSimple, PhWarningCircle, PhCaretDown, PhClock, PhMapPin, PhUser, PhMoonStars, PhFloppyDisk, PhTrash, PhPlanet, PhSparkle, PhAtom, PhCompass, PhGlobeHemisphereWest, PhCpu, PhDatabase, PhShootingStar, PhList, PhEnvelopeSimple, PhPaperPlaneTilt, PhHeadphones, PhHeart, PhRobot, PhGear, PhStop, PhImage, PhChatCircleDots, PhChats, PhTranslate, PhCopy, PhDownloadSimple, PhTerminal, PhBell, PhMegaphone } from '@phosphor-icons/vue'
import IconWorkbench from './icons/IconWorkbench.vue'
import IconFeedPaper from './icons/IconFeedPaper.vue'
import IconPaperLibrary from './icons/IconPaperLibrary.vue'
import IconResourceDb from './icons/IconResourceDb.vue'
import IconSchedule from './icons/IconSchedule.vue'
import IconRobot from './icons/IconRobot.vue'
import IconStyle from './icons/IconStyle.vue'

defineProps({ name: String, size: { type: [Number, String], default: 20 }, weight: { type: String, default: 'regular' } })
const icons = { edit: PhPencilSimple, star: PhStar, left: PhArrowLeft, right: PhArrowRight, external: PhArrowUpRight, 'arrow-up-right': PhArrowUpRight, calendar: IconSchedule, check: PhCheck, close: PhX, menu: PhList, list: PhList, plus: PhPlus, search: PhMagnifyingGlass, book: PhBookOpen, 'book-open': PhBookOpen, article: PhArticle, 'file-text': PhArticle, drag: PhDotsSixVertical, undo: PhArrowCounterClockwise, refresh: PhArrowCounterClockwise, logout: PhSignOut, 'sign-out': PhSignOut, bookmark: PhBookmarkSimple, warning: PhWarningCircle, down: PhCaretDown, clock: PhClock, location: PhMapPin, user: PhUser, night: PhMoonStars, save: PhFloppyDisk, trash: PhTrash, planet: PhPlanet, sparkle: PhSparkle, atom: PhAtom, compass: PhCompass, globe: PhGlobeHemisphereWest, cpu: PhCpu, database: PhDatabase, meteor: PhShootingStar, envelope: PhEnvelopeSimple, mail: PhEnvelopeSimple, 'paper-plane': PhPaperPlaneTilt, send: PhPaperPlaneTilt, headphones: PhHeadphones, heart: PhHeart, robot: IconRobot, bot: IconRobot, style: IconStyle, '风格': IconStyle, clothes: IconStyle, '服饰': IconStyle, gear: PhGear, settings: PhGear, stop: PhStop, image: PhImage, chat: PhChatCircleDots, chats: PhChats, translate: PhTranslate, copy: PhCopy, download: PhDownloadSimple, terminal: PhTerminal, bell: PhBell, notice: PhBell, megaphone: PhMegaphone, workbench: IconWorkbench, 'feed-paper': IconFeedPaper, 'paper-library': IconPaperLibrary, 'resource-db': IconResourceDb, schedule: IconSchedule, '工作台': IconWorkbench, '文献推荐': IconFeedPaper, '学术日程': IconSchedule, '文献库': IconPaperLibrary, '资料库': IconResourceDb }

</script>
<template><component :is="icons[name] || PhArticle" :size="size" :weight="weight" aria-hidden="true" class="app-icon" /></template>

