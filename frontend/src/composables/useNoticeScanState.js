import { ref, computed } from 'vue'
import { mailboxApi, noticeApi } from '../api/client'
import { extractNoticesFromEmailsWithAi, isAiAssistantReady } from '../services/aiService'
import { normalizeNoticeTitle } from '../utils/noticeValidity'

// 单例模块级响应式状态，跨路由持久化
const isNoticeScanning = ref(false)
const noticeScanProgress = ref('')
const noticeScanCandidates = ref([])
const noticeScanSelectedIndices = ref(new Set())
const noticeScanReport = ref(null)
const showNoticeScanModal = ref(false)
const noticeScanImporting = ref(false)
const hasUnreadNoticeResults = ref(false)
const noticeScanError = ref('')

let scanAbortController = null

export function useNoticeScanState() {
  /**
   * 启动 AI 扫描最近一周邮件
   * @param {Array} existingNotices - 当前系统中已存在的通知列表，用于精确查重
   */
  async function startNoticeScan(existingNotices = []) {
    if (!isAiAssistantReady()) {
      alert('请先在个人中心配置并测试 AI 大模型助手。')
      return false
    }

    if (isNoticeScanning.value) {
      showNoticeScanModal.value = true
      return true
    }

    // 初始化状态
    isNoticeScanning.value = true
    noticeScanProgress.value = '正在读取最近一周已同步邮件…'
    noticeScanError.value = ''
    noticeScanReport.value = null
    noticeScanCandidates.value = []
    noticeScanSelectedIndices.value = new Set()
    hasUnreadNoticeResults.value = false

    scanAbortController = new AbortController()

    try {
      const emailRes = await mailboxApi.getEmails({ limit: 100 })
      const emailList = Array.isArray(emailRes) ? emailRes : (emailRes?.items || [])

      if (emailList.length === 0) {
        noticeScanProgress.value = '暂未找到已同步的邮件。建议先前往学术邮箱点击“同步最近7天邮件”。'
        isNoticeScanning.value = false
        return true
      }

      noticeScanProgress.value = `获取到 ${emailList.length} 封候选邮件，AI 正在后台分析甄别教务与公共事务通知…`

      const extracted = await extractNoticesFromEmailsWithAi(emailList, {
        signal: scanAbortController.signal,
        onProgress: (p) => {
          noticeScanProgress.value = `正在深度分析邮件 (批次 ${p.currentBatch}/${p.totalBatches}，已分析 ${p.processedEmails}/${p.totalEmails} 封)…`
        }
      })

      if (extracted.length === 0) {
        noticeScanProgress.value = '最近一周邮件中未检测到教务或公共事务通知（报告与研讨会已自动归入学术日程）。'
        isNoticeScanning.value = false
        return true
      }

      // 查重比对：对比现有 notices 的 source_email_uid 与标准化标题
      const existingUids = new Set(
        existingNotices.map(n => String(n.source_email_uid || '').trim()).filter(Boolean)
      )
      const existingTitles = new Set(
        existingNotices.map(n => normalizeNoticeTitle(n.title)).filter(t => t.length >= 4)
      )

      const checkedSet = new Set()
      noticeScanCandidates.value = extracted.map((item, idx) => {
        const uid = String(item.source_uid || '').trim()
        const normTitle = normalizeNoticeTitle(item.title)
        const isUidDuplicate = Boolean(uid && existingUids.has(uid))
        const isTitleDuplicate = Boolean(normTitle.length >= 4 && existingTitles.has(normTitle))
        const isDuplicate = isUidDuplicate || isTitleDuplicate

        if (!isDuplicate) {
          checkedSet.add(idx)
        }

        return {
          ...item,
          isDuplicate,
          duplicateReason: isUidDuplicate ? '邮件UID已入库' : isTitleDuplicate ? '已有类似标题通知' : ''
        }
      })

      noticeScanSelectedIndices.value = checkedSet
      noticeScanProgress.value = `扫描完成，共识别出 ${extracted.length} 条教务与事务通知。`

      // 若弹窗处于关闭状态（用户在其他界面或已最小化），打上未读提示标记
      if (!showNoticeScanModal.value && noticeScanCandidates.value.length > 0) {
        hasUnreadNoticeResults.value = true
      }

      return true
    } catch (err) {
      if (err.name === 'AbortError') {
        noticeScanProgress.value = '已停止后台扫描。'
      } else {
        console.error('AI 扫描邮件通知异常:', err)
        noticeScanError.value = err.message || '网络请求超时'
        noticeScanProgress.value = `扫描中断: ${noticeScanError.value}`
      }
      return false
    } finally {
      isNoticeScanning.value = false
      scanAbortController = null
    }
  }

  /**
   * 取消当前进行中的后台扫描
   */
  function cancelNoticeScan() {
    if (scanAbortController) {
      scanAbortController.abort()
      scanAbortController = null
    }
    isNoticeScanning.value = false
    noticeScanProgress.value = '已停止后台扫描。'
  }

  function openNoticeScanModal() {
    showNoticeScanModal.value = true
    hasUnreadNoticeResults.value = false
  }

  function closeNoticeScanModal() {
    showNoticeScanModal.value = false
  }

  function dismissNoticeScanBanner() {
    hasUnreadNoticeResults.value = false
  }

  function toggleSelectCandidate(idx) {
    const set = new Set(noticeScanSelectedIndices.value)
    if (set.has(idx)) {
      set.delete(idx)
    } else {
      set.add(idx)
    }
    noticeScanSelectedIndices.value = set
  }

  function selectAllCandidates() {
    const set = new Set()
    noticeScanCandidates.value.forEach((item, idx) => {
      if (!item.isDuplicate) set.add(idx)
    })
    noticeScanSelectedIndices.value = set
  }

  function deselectAllCandidates() {
    noticeScanSelectedIndices.value = new Set()
  }

  /**
   * 执行批量入库导入
   */
  async function confirmNoticeBatchImport(onSuccess) {
    const chosen = noticeScanCandidates.value.filter((_, idx) => noticeScanSelectedIndices.value.has(idx))
    if (chosen.length === 0) {
      alert('请至少勾选一条要导入的通知')
      return false
    }

    noticeScanImporting.value = true
    try {
      const payloadNotices = chosen.map(item => ({
        title: item.title,
        content: item.content,
        category: item.category,
        importance: item.importance,
        start_date: item.start_date,
        end_date: item.end_date,
        attachments: item.attachments || '[]',
        source_email_uid: item.source_uid,
        source_email_subject: item.source_subject,
        source_email_sender: item.source_sender
      }))

      const result = await noticeApi.batchCreate(payloadNotices)
      noticeScanReport.value = result
      if (typeof onSuccess === 'function') {
        await onSuccess(result)
      }
      return true
    } catch (err) {
      console.error('批量入库失败:', err)
      alert(err.message || '导入失败，请稍后重试。')
      return false
    } finally {
      noticeScanImporting.value = false
    }
  }

  function resetNoticeScan() {
    cancelNoticeScan()
    noticeScanCandidates.value = []
    noticeScanSelectedIndices.value = new Set()
    noticeScanReport.value = null
    noticeScanProgress.value = ''
    hasUnreadNoticeResults.value = false
  }

  return {
    isNoticeScanning,
    noticeScanProgress,
    noticeScanCandidates,
    noticeScanSelectedIndices,
    noticeScanReport,
    showNoticeScanModal,
    noticeScanImporting,
    hasUnreadNoticeResults,
    noticeScanError,
    startNoticeScan,
    cancelNoticeScan,
    openNoticeScanModal,
    closeNoticeScanModal,
    dismissNoticeScanBanner,
    toggleSelectCandidate,
    selectAllCandidates,
    deselectAllCandidates,
    confirmNoticeBatchImport,
    resetNoticeScan
  }
}
