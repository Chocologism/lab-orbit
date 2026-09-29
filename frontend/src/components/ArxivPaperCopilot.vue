<template>
  <div class="arxiv-copilot-container" :class="{ 'is-mobile': isMobile }">
    <!-- 主工作台两栏分屏区域 (100% 满屏沉浸式) -->
    <main
      v-if="currentPaperId"
      class="copilot-workspace"
      ref="workspaceRef"
      :class="{ 'is-resizing': isDraggingSplitter }"
    >
      <!-- 左侧栏：Paper 原件 PDF 阅览区 (高保真单层极简工具栏，支持换篇、翻页、缩放、Dark/Light护眼背景与划词即问) -->
      <section
        class="left-reading-pane"
        :style="!isMobile ? { width: `${leftWidthPercent}%` } : {}"
        v-show="!isMobile || activeMobilePane === 'reading'"
      >
        <div class="pdf-viewer-wrapper">
          <ArxivPdfViewer
            :paper-id="currentPaperId"
            :initial-page="currentPage"
            @selection-action="handleSelectionAction"
            @page-change="currentPage = $event"
            @paper-change="handlePaperChange"
            @pdf-loaded="handlePdfLoaded"
            @pdf-error="handlePdfError"
          />
        </div>
      </section>

      <!-- 中间可拖拽调整分割条 (桌面端) -->
      <div
        v-if="!isMobile"
        class="split-resizer"
        @mousedown="startDraggingSplitter"
        @dblclick="resetSplitRatio"
        title="拖动调整阅览与对话区域比例 (双击复位)"
      >
        <div class="resizer-handle"></div>
      </div>

      <!-- 右侧栏：Assistant 独立伴读卡片 (图 2 原版设计) -->
      <section
        class="right-assistant-pane"
        :style="!isMobile ? { width: `${100 - leftWidthPercent}%` } : {}"
        v-show="!isMobile || activeMobilePane === 'chat'"
      >
        <div class="assistant-card-shell">
          <!-- 顶部 Assistant 标题栏 -->
          <div class="assistant-header-bar">
            <span class="assistant-headline">AI 伴读助手</span>
            <div class="assistant-header-actions">
              <!-- 返回引导页按钮 (仅在活跃对话且有消息时显示) -->
              <button
                v-if="messages.length > 0"
                type="button"
                class="new-chat-btn"
                title="保存当前研讨并返回伴读引导卡片页（历史记录随时可在下方继续）"
                @click="startNewChat"
              >
                <svg class="new-chat-plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                <span>返回引导页</span>
              </button>
              <button
                v-if="fulltextData?.fullText"
                type="button"
                class="assistant-tool-btn"
                title="查看已注入 AI 上下文的原文数据"
                @click="showRawSourceModal = true"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                </svg>
              </button>
              <button
                type="button"
                class="assistant-tool-btn"
                title="清空当前研讨对话"
                @click="handleClearChat"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                type="button"
                class="assistant-tool-btn"
                title="复位分屏比例为 55 : 45"
                @click="resetSplitRatio"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10"></polyline>
                  <polyline points="1 20 1 14 7 14"></polyline>
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
              </button>
              <button
                type="button"
                class="assistant-tool-btn"
                title="换篇：返回文献挑选引导页"
                @click="handlePaperChange('')"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
              </button>
            </div>
          </div>

          <!-- 消息滚动视口 -->
          <div class="assistant-messages-body" ref="chatScrollContainerRef">
            <!-- 初始欢迎状态：2×2 启发式提问引导卡片 -->
            <div v-if="messages.length === 0" class="welcome-guide-container">
              <h3 class="guide-lead-title">深入理解、审视反思或拓展此文献</h3>

              <div class="guide-cards-2x2">
                <!-- 卡片 1: 检验或挑战核心结论 -->
                <button
                  type="button"
                  class="guide-action-card"
                  @click="sendQuickPrompt('哪些后续工作检验或挑战了本文的核心结论？请从实证检验与理论推演两个维度，深入剖析后续研究与相关前沿文献。')"
                >
                  <div class="card-icon-line">
                    <div class="action-icon-circle fork">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="6" cy="6" r="3"></circle>
                        <circle cx="18" cy="6" r="3"></circle>
                        <circle cx="6" cy="18" r="3"></circle>
                        <path d="M18 9a9 9 0 0 1-9 9"></path>
                        <path d="M6 9v6"></path>
                      </svg>
                    </div>
                    <svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <span class="card-headline">哪些后续工作检验或挑战了本文的核心结论？</span>
                </button>

                <!-- 卡片 2: 讲解硬核部分：从物理直觉到伪代码 -->
                <button
                  type="button"
                  class="guide-action-card"
                  @click="sendQuickPrompt('请为我精讲本文最硬核、难度最高的核心部分，按照从物理直觉、数学公式推导到具体伪代码实现的完整链路进行深度剖析。')"
                >
                  <div class="card-icon-line">
                    <div class="action-icon-circle code">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                      </svg>
                    </div>
                    <svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <span class="card-headline">讲解本文最硬核的部分：从物理直觉到伪代码实现</span>
                </button>

                <!-- 卡片 3: 转化为可落地的复现清单 -->
                <button
                  type="button"
                  class="guide-action-card"
                  @click="sendQuickPrompt('请将本文的方法转化为一份详尽的学术复现清单，梳理实验所需的数据集、超参数设定、关键假设及核心代码处理管线步骤。')"
                >
                  <div class="card-icon-line">
                    <div class="action-icon-circle list">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                    </div>
                    <svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <span class="card-headline">将本文转化为可落地的复现清单</span>
                </button>

                <!-- 卡片 4: 脱离基准测试后的失效假设 -->
                <button
                  type="button"
                  class="guide-action-card"
                  @click="sendQuickPrompt('脱离这些特定的基准测试环境后，本文中有哪些未明说的假设前提、边界约束条件或参数近似可能在现实科研场景中失效？')"
                >
                  <div class="card-icon-line">
                    <div class="action-icon-circle alert">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                        <line x1="12" y1="9" x2="12" y2="13"></line>
                        <line x1="12" y1="17" x2="12.01" y2="17"></line>
                      </svg>
                    </div>
                    <svg class="chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <span class="card-headline">脱离这些基准测试后，哪些假设可能失效？</span>
                </button>
              </div>

              <!-- 历史会话列表 -->
              <div v-if="paperSessions.length > 0" class="continue-chat-section">
                <div class="continue-chat-header-row">
                  <h4 class="continue-chat-label">继续最近的研讨会话</h4>
                  <button
                    type="button"
                    class="clear-all-sessions-link-btn"
                    title="清空此文献全部历史研讨会话记录"
                    @click="handleClearAllSessionsForCurrentPaper"
                  >
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                    <span>清空此文献全部历史</span>
                  </button>
                </div>
                <div class="recent-sessions-list">
                  <div
                    v-for="s in paperSessions"
                    :key="s.id"
                    class="recent-session-item"
                    @click="openSession(s.id)"
                  >
                    <div class="session-item-left">
                      <div class="session-bubble-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                      </div>
                      <div class="session-item-text">
                        <div class="session-item-title">{{ s.title }}</div>
                        <div class="session-item-date">{{ formatRelativeTime(s.updatedAt || s.createdAt) }}</div>
                      </div>
                    </div>
                    <div class="session-item-actions">
                      <button
                        type="button"
                        class="delete-history-btn"
                        title="删除此条会话"
                        @click.stop="deleteSession(s.id)"
                      >
                        <AppIcon name="close" :size="12" />
                      </button>
                      <svg class="item-chevron-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 对话历史消息线程 -->
            <div v-else class="copilot-thread-list">
              <div
                v-for="(msg, index) in messages"
                :key="index"
                class="thread-message-item"
                :class="msg.role"
              >
                <!-- 气泡内容主体 (仅包裹提问/回答内容卡片) -->
                <div class="msg-bubble-card">
                  <!-- 附带的图片展示 -->
                  <div v-if="msg.images && msg.images.length > 0" class="msg-images-preview">
                    <img
                      v-for="(imgUrl, imgIdx) in msg.images"
                      :key="imgIdx"
                      :src="imgUrl"
                      class="msg-image-thumb"
                      alt="提问附图"
                    />
                  </div>

                  <!-- 附带的划选引用 -->
                  <div v-if="msg.quote" class="embedded-quote-chip">
                    <div class="quote-chip-header">
                      <span class="quote-page-badge">第 {{ msg.quote.page }} 页引用</span>
                    </div>
                    <blockquote class="quote-chip-text">{{ msg.quote.text }}</blockquote>
                  </div>

                  <!-- 用户提问编辑状态 -->
                  <div v-if="msg.role === 'user' && editingMessageIndex === index" class="inline-edit-box">
                    <textarea
                      v-model="editingContent"
                      class="inline-edit-textarea"
                      rows="3"
                      placeholder="修改您的问题..."
                      @keydown.enter.exact.prevent="handleSaveEdit(index)"
                      @keydown.esc="handleCancelEdit"
                    ></textarea>
                    <div class="inline-edit-actions">
                      <button type="button" class="btn-cancel-edit" @click="handleCancelEdit">取消</button>
                      <button type="button" class="btn-save-edit" @click="handleSaveEdit(index)">保存并提交</button>
                    </div>
                  </div>

                  <!-- 用户提问普通正文 -->
                  <div v-else-if="msg.role === 'user'" class="user-msg-text">
                    {{ msg.content }}
                  </div>

                  <!-- Assistant 深度推理思考链 (DeepSeek-R1 风格) -->
                  <details
                    v-if="msg.role === 'assistant' && msg.reasoning"
                    class="reasoning-disclosure"
                    :open="msg.reasoningOpen !== false"
                    @toggle="msg.reasoningOpen = $event.target.open"
                  >
                    <summary class="reasoning-summary-bar">
                      <svg class="sparkle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
                      </svg>
                      <span>深度推理思考过程 (Reasoning)</span>
                      <span v-if="isStreaming && index === streamingIndex && !msg.content" class="thinking-dot-pulse">思考中...</span>
                    </summary>
                    <div class="reasoning-content-box">
                      {{ msg.reasoning }}
                    </div>
                  </details>

                  <!-- Assistant 回答正文渲染 (Markdown + KaTeX) -->
                  <div v-if="msg.role === 'assistant' && msg.content" class="msg-markdown-view markdown-body">
                    <div v-html="renderMarkdown(msg.content)"></div>

                    <!-- 正在生成中光标 -->
                    <div v-if="isStreaming && index === streamingIndex" class="stream-pulse-bar">
                      <span class="pulse-spark"></span>
                      <span class="pulse-text">正在生成学术解答...</span>
                    </div>
                  </div>

                  <!-- 正在思考等待占位 -->
                  <div
                    v-else-if="msg.role === 'assistant' && isStreaming && index === streamingIndex"
                    class="streaming-placeholder-box"
                  >
                    <span class="dot-spinner"></span>
                    <span class="dot-spinner"></span>
                    <span class="dot-spinner"></span>
                    <span class="hint-text">{{ msg.reasoning ? '推导完毕，正在输出解答...' : '正在检索文献并推演解答...' }}</span>
                  </div>
                </div>

                <!-- 气泡外面的悬浮操作与时间栏 (时间在左边，其余按钮在右边) -->
                <div
                  v-if="editingMessageIndex !== index && (!isStreaming || index !== streamingIndex)"
                  class="msg-hover-footer"
                >
                  <div class="msg-footer-left">
                    <span class="msg-hover-time">{{ formatRelativeTime(msg.timestamp) }}</span>
                  </div>
                  <div class="msg-footer-actions">
                    <!-- 用户消息专属操作：Retry, Edit -->
                    <template v-if="msg.role === 'user'">
                      <button
                        type="button"
                        class="msg-action-icon-btn"
                        title="重试此提问"
                        :disabled="isStreaming"
                        @click="handleRetryUserMessage(index)"
                      >
                        <!-- 经典 Retry 逆时针环形箭头图标 -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        class="msg-action-icon-btn"
                        title="编辑此提问"
                        :disabled="isStreaming"
                        @click="handleStartEdit(index, msg.content)"
                      >
                        <!-- 经典 Edit 铅笔图标 -->
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          <path d="m15 5 4 4" />
                        </svg>
                      </button>
                    </template>

                    <!-- 经典 Copy 双矩形复制图标 (用户和模型均支持) -->
                    <button
                      type="button"
                      class="msg-action-icon-btn"
                      :title="copiedIndex === index ? '已复制' : '复制内容'"
                      @click="copyMessageContent(msg.content, index)"
                    >
                      <svg v-if="copiedIndex === index" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="13" height="13" x="9" y="9" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部输入栏容器 (全面升级为普通对话设计：宽敞卡片、图片上传/预览、模型与思考强度选择) -->
          <footer class="alphaxiv-input-shell">
            <!-- 待发送图片缩略预览栏 -->
            <div v-if="pendingImages.length > 0" class="pending-images-bar">
              <div
                v-for="(img, imgIdx) in pendingImages"
                :key="img.id"
                class="pending-image-card"
              >
                <img :src="img.url" :alt="img.name" class="pending-thumb" />
                <button
                  type="button"
                  class="remove-image-btn"
                  @click="removePendingImage(imgIdx)"
                  title="移除此图片"
                >
                  <AppIcon name="close" :size="12" />
                </button>
              </div>
            </div>

            <div class="alphaxiv-input-card">
              <!-- 划选引用提醒条 (用户在左侧选词后悬挂于输入框上方) -->
              <div v-if="activeQuote" class="active-quote-banner">
                <div class="banner-quote-left">
                  <span class="quote-page-info">第 {{ activeQuote.page }} 页引用:</span>
                  <span class="quote-text-preview" :title="activeQuote.text">
                    "{{ activeQuote.text.slice(0, 90) }}{{ activeQuote.text.length > 90 ? '...' : '' }}"
                  </span>
                </div>
                <button
                  type="button"
                  class="quote-dismiss-btn"
                  title="取消引用"
                  @click="activeQuote = null"
                >
                  <AppIcon name="close" :size="14" />
                </button>
              </div>

              <!-- 隐藏的文件上传 input -->
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                multiple
                class="hidden-file-input"
                @change="handleFileInputChange"
              />

              <!-- 核心多行输入框 (支持自动高度、粘贴/拖拽图片) -->
              <textarea
                ref="textareaRef"
                v-model="inputQuestion"
                class="alphaxiv-textarea"
                rows="2"
                placeholder="输入您关于本文的问题，或在左侧划选段落提问... 支持粘贴图片 (Ctrl+V / Cmd+V)"
                :disabled="fetchingFulltext"
                @input="adjustTextareaHeight"
                @keydown.enter.exact.prevent="handleSubmitQuestion"
                @paste="handlePaste"
                @dragover.prevent
                @drop="handleDrop"
              ></textarea>

              <!-- 底部操作行：图片上传按钮、可用模型下拉选单、推理档位、发送按钮 -->
              <div class="alphaxiv-bottom-bar">
                <div class="bottom-bar-left">
                  <!-- 图片上传触发按钮 (替换原附件图标) -->
                  <button
                    type="button"
                    class="bar-attach-btn"
                    title="上传图片或截图 (支持直接按 Ctrl+V / Cmd+V 粘贴)"
                    :disabled="fetchingFulltext || isStreaming"
                    @click="triggerFileUpload"
                  >
                    <AppIcon name="image" :size="18" />
                  </button>

                  <!-- 核心功能：模型切换浮层选择器 (全域可点击 + 高质感毛玻璃) -->
                  <ModelSelectPopover
                    :model-value="config.model"
                    :models="config.models || []"
                    placement="top"
                    @change="handleSelectModel"
                  />

                  <!-- 核心功能：推理思考深度调节器 (off / low / high / max) -->
                  <div
                    v-if="activeModel?.supportsReasoningEffort"
                    class="copilot-reasoning-widget"
                    title="调节当前模型的推理思考深度 (reasoningEffort)"
                  >
                    <span class="reasoning-caption">思考:</span>
                    <div class="reasoning-btn-group">
                      <button
                        v-for="lvl in ['off', 'low', 'high', 'max']"
                        :key="lvl"
                        type="button"
                        class="reasoning-pill-btn"
                        :class="{ 'is-active': (activeModel.reasoningEffort || 'off') === lvl }"
                        @click="setReasoningEffort(lvl)"
                      >
                        {{ lvl }}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="bottom-bar-right">
                  <button
                    v-if="isStreaming"
                    type="button"
                    class="circular-send-btn stop-state"
                    title="停止生成"
                    @click="stopGeneration"
                  >
                    <AppIcon name="stop" :size="14" />
                  </button>

                  <button
                    v-else
                    type="button"
                    class="circular-send-btn"
                    :class="{ 'is-active': canSend && !fetchingFulltext }"
                    :disabled="!canSend || fetchingFulltext"
                    title="发送提问 (Enter)"
                    @click="handleSubmitQuestion"
                  >
                    <AppIcon name="send" :size="16" />
                  </button>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </section>
    </main>

    <!-- 未选定文献状态：沉浸式文献挑选与快速开启引导落地页 -->
    <div v-else class="arxiv-landing-screen">
      <div class="landing-content-card">
        <!-- 头部标题区 -->
        <div class="landing-header">
          <div class="landing-badge">
            <svg class="landing-sparkle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
            </svg>
            <span>arXiv AI Copilot · 伴读研讨工作台</span>
          </div>
          <h2 class="landing-title">开启文献深度伴读与研讨</h2>
          <p class="landing-subtitle">
            输入任意 arXiv 论文编号或链接，即刻体验双栏高清阅读、物理公式解析、划词提问与 AI 深度推理研讨
          </p>
        </div>

        <!-- 核心输入卡片 -->
        <div class="landing-input-panel">
          <div class="landing-input-box" :class="{ 'has-error': landingInputError }">
            <span class="landing-input-prefix">arXiv:</span>
            <input
              v-model="landingInputPaperId"
              type="text"
              class="landing-text-input"
              placeholder="输入论文编号或链接，例如 2312.00752 或 https://arxiv.org/abs/..."
              @keydown.enter="handleLandingSubmit"
              @input="landingInputError = ''"
            />
            <button
              type="button"
              class="landing-submit-btn"
              :disabled="!landingInputPaperId.trim()"
              @click="handleLandingSubmit"
            >
              <span>开启研讨</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
          <div v-if="landingInputError" class="landing-error-hint">
            {{ landingInputError }}
          </div>
        </div>

        <!-- 推荐与历史两栏分区 -->
        <div class="landing-grids">
          <!-- 左栏：最近研讨文献 -->
          <div class="landing-grid-col">
            <div class="col-header">
              <svg class="col-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span>最近研讨文献</span>
            </div>

            <div v-if="recentPapersList.length > 0" class="recent-papers-list">
              <div
                v-for="paper in recentPapersList.slice(0, 4)"
                :key="paper.id"
                role="button"
                tabindex="0"
                class="landing-paper-card"
                @click="handleSelectRecent(paper.id)"
                @keydown.enter="handleSelectRecent(paper.id)"
              >
                <div class="paper-card-top">
                  <span class="paper-id-tag">arXiv:{{ paper.id }}</span>
                  <div class="paper-card-top-actions">
                    <button
                      type="button"
                      class="delete-recent-paper-btn"
                      title="删除此文献全部研讨历史"
                      aria-label="删除此文献研讨历史"
                      @click.stop="handleDeletePaperHistory(paper.id)"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <span class="paper-card-action">继续研讨 →</span>
                  </div>
                </div>
                <div class="paper-card-title">{{ paper.title || `arXiv:${paper.id}` }}</div>
              </div>
            </div>
            <div v-else class="landing-empty-box">
              <span class="empty-tip-text">暂无研讨历史，输入上方论文编号即可快速开启</span>
            </div>
          </div>

          <!-- 右栏：实验室文献推荐流精选 -->
          <div class="landing-grid-col">
            <div class="col-header">
              <svg class="col-icon star" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              <span>实验室精选推荐文献</span>
            </div>

            <div v-if="landingFeedPapers.length > 0" class="feed-papers-list">
              <button
                v-for="paper in landingFeedPapers"
                :key="paper.id || paper.arxiv_id"
                type="button"
                class="landing-paper-card feed-style"
                @click="handleSelectFeedPaper(paper)"
              >
                <div class="paper-card-top">
                  <span class="paper-id-tag feed-tag">arXiv:{{ paper.arxiv_id }}</span>
                  <span class="paper-card-action">即刻伴读 →</span>
                </div>
                <div class="paper-card-title">{{ paper.title }}</div>
                <div v-if="paper.categories || paper.primary_category" class="paper-card-meta">
                  <span class="category-pill">{{ paper.primary_category || (Array.isArray(paper.categories) ? paper.categories[0] : paper.categories) }}</span>
                  <span v-if="paper.recommender?.name" class="recommender-note">推荐人: {{ paper.recommender.name }}</span>
                </div>
              </button>
            </div>
            <div v-else-if="loadingLandingFeed" class="landing-empty-box">
              <span class="empty-tip-text">正在拉取实验室前沿推荐...</span>
            </div>
            <div v-else class="landing-empty-box">
              <span class="empty-tip-text">暂无推荐文献，可前往文献推荐流添加</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 移动端底栏视图切换器 -->
    <div v-if="isMobile && currentPaperId" class="mobile-pane-tabs">
      <button
        type="button"
        class="mobile-pane-tab"
        :class="{ active: activeMobilePane === 'reading' }"
        @click="activeMobilePane = 'reading'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
        </svg>
        <span>论文阅览</span>
      </button>
      <button
        type="button"
        class="mobile-pane-tab"
        :class="{ active: activeMobilePane === 'chat' }"
        @click="activeMobilePane = 'chat'"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>AI 伴读</span>
      </button>
    </div>

    <!-- 原文原始内容查看模态弹窗 -->
    <div v-if="showRawSourceModal" class="raw-source-modal-overlay" @click.self="showRawSourceModal = false">
      <div class="raw-source-modal">
        <div class="modal-header">
          <div class="modal-title-group">
            <h4 class="modal-title">已注入上下文的全文内容</h4>
            <span class="modal-source-pill">{{ currentSourceLabel }} · {{ (fulltextData?.wordCount || 0).toLocaleString() }} 字符</span>
          </div>
          <button
            type="button"
            class="modal-close-btn"
            @click="showRawSourceModal = false"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <pre class="raw-text-viewer"><code>{{ fulltextData?.fullText }}</code></pre>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="modal-btn secondary"
            @click="copyMessageContent(fulltextData?.fullText || '')"
          >
            <span>复制全部原文</span>
          </button>
          <button
            type="button"
            class="modal-btn primary"
            @click="showRawSourceModal = false"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import ArxivPdfViewer from './ArxivPdfViewer.vue'
import AppIcon from './AppIcon.vue'
import ModelSelectPopover from './ModelSelectPopover.vue'
import { renderMarkdown } from '../utils/markdown.js'
import { notify } from '../composables/feedback.js'
import {
  SOURCE_MARKDOWN,
  SOURCE_HTML,
  SOURCE_TEX,
  SOURCE_OPTIONS,
  fetchPaperFulltextBySource
} from '../services/arxivFulltextService.js'
import {
  loadAiConfig,
  saveAiConfig,
  sendChatMessageStream,
  isAiConnectivityPassed
} from '../services/aiService.js'
import {
  cleanArxivId,
  getRecentArxivPapers,
  saveRecentArxivPaper,
  removeRecentArxivPaper,
  resolveArxivPaperMetadata,
  isNoiseTitle
} from '../utils/arxivHtml.js'
import { resolveUserScope } from '../utils/userScope.js'
import { arxivApi } from '../api/client.js'

const props = defineProps({
  initialPaperId: {
    type: String,
    default: ''
  },
  preferredSource: {
    type: String,
    default: 'markdown'
  }
})

const emit = defineEmits(['paper-change'])

// 当前登录用户（用于本地多账号沙箱隔离，绝不上传云端）
const currentUser = computed(() => {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('cssbd_user') || localStorage.getItem('labhub_user'))
      : null
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
})

// 论文状态
const currentPaperId = ref(cleanArxivId(props.initialPaperId) || '')
const inputPaperId = ref(currentPaperId.value)
const currentPage = ref(1)

// 引导落地页状态
const landingInputPaperId = ref('')
const landingInputError = ref('')
const recentPapersList = ref(getRecentArxivPapers(currentUser.value))
const landingFeedPapers = ref([])
const loadingLandingFeed = ref(false)

// 全文数据源状态 (从配置中接收 preferredSource，默认使用已有 markdown)
const currentSource = ref(props.preferredSource || SOURCE_MARKDOWN)
const fulltextData = ref(null)
const fetchingFulltext = ref(false)
const fulltextError = ref('')
const showRawSourceModal = ref(false)

// 监听数据源偏好变更
watch(() => props.preferredSource, (newSource) => {
  if (newSource && newSource !== currentSource.value) {
    currentSource.value = newSource
    loadPaperFulltext(currentPaperId.value, newSource)
  }
})

// 分屏与布局状态
const leftWidthPercent = ref(parseFloat(localStorage.getItem('csbd_arxiv_split_pct')) || 55)
const isDraggingSplitter = ref(false)
const workspaceRef = ref(null)
const isMobile = ref(false)
const activeMobilePane = ref('reading') // 'reading' | 'chat'

// 对话状态与多会话历史 (图 2 与图 3)
const paperSessions = ref([])
const activeSessionId = ref(null)
const messages = ref([])
const inputQuestion = ref('')
const activeQuote = ref(null)
const isStreaming = ref(false)
const streamingIndex = ref(-1)
const chatScrollContainerRef = ref(null)
const textareaRef = ref(null)
let abortController = null

// 行内编辑与操作交互状态 (对齐 alphaxiv 图 5)
const editingMessageIndex = ref(-1)
const editingContent = ref('')
const copiedIndex = ref(-1)
let copyResetTimer = null

// 多模态图片上传与剪贴板粘贴
const pendingImages = ref([])
const fileInputRef = ref(null)

// AI 模型配置
const config = reactive(loadAiConfig())
const isConfigured = computed(() => {
  return isAiConnectivityPassed() || Boolean(config.apiKey) || config.provider === 'ollama'
})

const activeModel = computed(() => {
  if (!Array.isArray(config.models) || config.models.length === 0) {
    return {
      id: config.model || 'deepseek-chat',
      name: config.model || 'DeepSeek-V3',
      contextWindow: 128000,
      supportsReasoningEffort: false,
      reasoningEffort: 'off'
    }
  }
  const found = config.models.find(m => m.id === config.model)
  return found || config.models[0]
})

function handleSelectModel(modelId) {
  config.model = modelId
  saveAiConfig(config)
}

function setReasoningEffort(level) {
  if (activeModel.value) {
    activeModel.value.reasoningEffort = level
    saveAiConfig(config)
    notify(`推理档位已调整为: ${level}`, 'info')
  }
}

// 自动调整输入框高度
function adjustTextareaHeight() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  const nextHeight = Math.min(el.scrollHeight, 180)
  el.style.height = `${Math.max(nextHeight, 44)}px`
}

// 多模态图片处理与剪贴板/拖拽支持
function processImageFile(file) {
  if (!file.type.startsWith('image/')) {
    notify('仅支持上传图片格式文件。', 'error')
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    notify('单张图片大小不能超过 10MB。', 'error')
    return
  }
  const reader = new FileReader()
  reader.onload = (e) => {
    pendingImages.value.push({
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      url: e.target.result,
      name: file.name
    })
    nextTick(() => {
      adjustTextareaHeight()
    })
  }
  reader.readAsDataURL(file)
}

function triggerFileUpload() {
  fileInputRef.value?.click()
}

function handleFileInputChange(e) {
  const files = e.target.files
  if (!files || files.length === 0) return
  for (let i = 0; i < files.length; i++) {
    processImageFile(files[i])
  }
  e.target.value = ''
}

function handlePaste(e) {
  const clipboardData = e.clipboardData || window.clipboardData
  if (!clipboardData) return
  const items = clipboardData.items
  if (!items) return

  let hasImage = false
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type.indexOf('image') !== -1) {
      hasImage = true
      const file = item.getAsFile()
      if (file) {
        processImageFile(file)
      }
    }
  }
  if (hasImage) {
    notify('已成功粘贴剪贴板图片。', 'info')
  }
}

function handleDrop(e) {
  e.preventDefault()
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return
  for (let i = 0; i < files.length; i++) {
    processImageFile(files[i])
  }
}

function removePendingImage(index) {
  pendingImages.value.splice(index, 1)
  nextTick(() => {
    adjustTextareaHeight()
  })
}

// 论文元信息计算
const paperTitle = computed(() => fulltextData.value?.title || `arXiv:${currentPaperId.value}`)
const paperAuthors = computed(() => fulltextData.value?.authors || '')

const currentSourceLabel = computed(() => {
  const opt = SOURCE_OPTIONS.find(o => o.id === currentSource.value)
  return opt ? opt.name : currentSource.value
})

const canSend = computed(() => {
  const hasTextOrMedia = Boolean(inputQuestion.value.trim() || activeQuote.value || pendingImages.value.length > 0)
  return hasTextOrMedia && isConfigured.value
})

// 载入论文全文 (开启自动降级回退策略)
async function loadPaperFulltext(id, source = currentSource.value) {
  const clean = cleanArxivId(id)
  if (!clean) return

  fetchingFulltext.value = true
  fulltextError.value = ''

  try {
    const res = await fetchPaperFulltextBySource(clean, source, { autoFallback: true })
    if (res.ok) {
      fulltextData.value = res
      if (!res.title || isNoiseTitle(res.title) || res.title === `arXiv:${clean}`) {
        resolveArxivPaperMetadata(clean).then(meta => {
          if (meta?.title && !isNoiseTitle(meta.title) && meta.title !== `arXiv:${clean}`) {
            fulltextData.value = { ...fulltextData.value, title: meta.title }
            saveRecentArxivPaper(clean, meta.title, currentUser.value)
            recentPapersList.value = getRecentArxivPapers(currentUser.value)
          }
        }).catch(() => {})
      }
    } else {
      fulltextError.value = res.error || '获取全文失败'
      notify(`加载 ${source} 提示: ${fulltextError.value}`, 'warning')
    }
  } catch (err) {
    fulltextError.value = err.message || '网络连接异常'
    notify(`拉取异常: ${fulltextError.value}`, 'error')
  } finally {
    fetchingFulltext.value = false
  }
}

// 切换论文（由 ArxivPdfViewer 工具栏触发、落地页触发或由父组件 prop 触发）
function handlePaperChange(newId) {
  const clean = cleanArxivId(newId)
  if (!clean) {
    currentPaperId.value = ''
    inputPaperId.value = ''
    landingInputPaperId.value = ''
    recentPapersList.value = getRecentArxivPapers(currentUser.value)
    autoHealRecentPapers()
    loadLandingFeedPapers()
    emit('paper-change', '')
    return
  }
  if (clean === currentPaperId.value) return

  currentPaperId.value = clean
  inputPaperId.value = clean
  landingInputPaperId.value = ''
  currentPage.value = 1

  // 保留已有权威标题，避免被空或旧篇标题覆写
  const existingPaper = recentPapersList.value.find(p => p.id === clean)
  const knownTitle = existingPaper && !isNoiseTitle(existingPaper.title) && !/^arxiv:\s*\d/i.test(existingPaper.title)
    ? existingPaper.title
    : ''
  saveRecentArxivPaper(clean, knownTitle, currentUser.value)
  recentPapersList.value = getRecentArxivPapers(currentUser.value)
  loadSessionForPaper(clean)
  loadPaperFulltext(clean, currentSource.value)

  // 立即发起纯前端直接权威解析
  resolveArxivPaperMetadata(clean).then(meta => {
    if (meta?.title && !isNoiseTitle(meta.title) && !/^arxiv:\s*\d/i.test(meta.title)) {
      saveRecentArxivPaper(clean, meta.title, currentUser.value)
      const found = recentPapersList.value.find(p => p.id === clean)
      if (found) found.title = meta.title
      if (currentPaperId.value === clean && (!fulltextData.value?.title || isNoiseTitle(fulltextData.value.title) || /^arxiv:\s*\d/i.test(fulltextData.value.title))) {
        if (fulltextData.value) {
          fulltextData.value.title = meta.title
          if (meta.authors && !fulltextData.value.authors) {
            fulltextData.value.authors = meta.authors
          }
        }
      }
    }
  }).catch(() => {})

  emit('paper-change', clean)
}

async function loadLandingFeedPapers() {
  loadingLandingFeed.value = true
  try {
    const feed = await arxivApi.getFeed('all')
    const list = Array.isArray(feed) ? feed : (feed?.data || [])
    landingFeedPapers.value = list.slice(0, 4)
  } catch (err) {
    console.warn('Failed to load feed papers for landing:', err)
  } finally {
    loadingLandingFeed.value = false
  }
}

function handleLandingSubmit() {
  const clean = cleanArxivId(landingInputPaperId.value)
  if (!clean) {
    landingInputError.value = '请输入合规的 arXiv 论文编号或链接（如 2312.00752）'
    return
  }
  landingInputError.value = ''
  resolveArxivPaperMetadata(clean).catch(() => {})
  handlePaperChange(clean)
}

function handleSelectRecent(id) {
  handlePaperChange(id)
}

function handleSelectFeedPaper(paper) {
  const clean = cleanArxivId(paper.arxiv_id || '')
  if (clean) {
    handlePaperChange(clean)
  }
}


// 接收划选动作
function handleSelectionAction({ action, text, page }) {
  activeQuote.value = { text, page, action }

  if (isMobile.value) {
    activeMobilePane.value = 'chat'
  }

  if (action === 'quote') {
    nextTick(() => {
      if (textareaRef.value) textareaRef.value.focus()
    })
    return
  }

  let prompt = ''
  if (action === 'explain') {
    prompt = '请结合论文全文背景，用中文详细阐释以上选中文本与公式的核心内涵、理论前提及学术逻辑。'
  } else if (action === 'translate') {
    prompt = '请将以上选中的论文内容翻译为地道严谨的学术中文，保留所有专业英文术语与 LaTeX 数学公式（$...$ 与 $$...$$）。'
  } else if (action === 'summarize') {
    prompt = '请用中文精炼提炼以上选中文本的核心论点与关键事实。'
  }

  inputQuestion.value = prompt
  nextTick(() => {
    handleSubmitQuestion()
  })
}

// 提交快捷意图
function sendQuickPrompt(promptText) {
  inputQuestion.value = promptText
  handleSubmitQuestion()
}

// 提交提问
async function handleSubmitQuestion() {
  const q = inputQuestion.value.trim()
  const imagesToSend = pendingImages.value.map(img => img.url)
  if (!q && !activeQuote.value && imagesToSend.length === 0) return
  if (!isConfigured.value) {
    notify('请先在 AI 助手设置中配置有效的 API Key 或模型接入点', 'warning')
    return
  }

  const quoteSnapshot = activeQuote.value ? { ...activeQuote.value } : null
  const questionText = q || (quoteSnapshot ? '请深入分析以上引用的内容' : '请结合文献分析以上图片')

  // 若当前没有激活的会话，自动创建一个全新研讨会话 (支持单篇文献多次独立对话)
  if (!activeSessionId.value) {
    const newId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7)
    const newSession = {
      id: newId,
      title: questionText.slice(0, 36) || '新研讨会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    }
    paperSessions.value.unshift(newSession)
    activeSessionId.value = newId
  }

  const userMsg = {
    role: 'user',
    content: questionText,
    quote: quoteSnapshot,
    images: imagesToSend,
    timestamp: Date.now()
  }
  messages.value.push(userMsg)
  saveSessionForPaper(currentPaperId.value)

  inputQuestion.value = ''
  activeQuote.value = null
  pendingImages.value = []
  adjustTextareaHeight()

  const assistantMsg = {
    role: 'assistant',
    content: '',
    reasoning: '',
    reasoningOpen: true,
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  const assistantIdx = messages.value.length - 1
  await startAssistantStream(assistantIdx)
}

// 驱动模型流式输出 (支持新问答、重试以及编辑后重新生成)
async function startAssistantStream(assistantIdx) {
  streamingIndex.value = assistantIdx
  isStreaming.value = true

  const assistantMsg = messages.value[assistantIdx]
  if (assistantMsg) {
    assistantMsg.content = ''
    assistantMsg.reasoning = ''
  }

  await nextTick()
  scrollToBottom()

  const paperContext = {
    arxivId: currentPaperId.value,
    title: fulltextData.value?.title || currentPaperId.value,
    authors: fulltextData.value?.authors || '',
    fullText: fulltextData.value?.fullText || fulltextData.value?.abstract || ''
  }

  const chatPayload = messages.value.slice(0, assistantIdx).map(m => {
    let text = m.content
    if (m.quote) {
      text = `【用户在论文第 ${m.quote.page} 页划选了以下段落/公式】：\n\n> ${m.quote.text}\n\n${text}`
    }
    const item = {
      role: m.role,
      content: text
    }
    if (m.images && m.images.length > 0) {
      item.images = m.images
    }
    return item
  })

  abortController = new AbortController()

  try {
    await sendChatMessageStream({
      config,
      messages: chatPayload,
      activeModel: activeModel.value,
      paperContext,
      onChunk: (chunk) => {
        if (assistantMsg) {
          assistantMsg.content += chunk
          scrollToBottom()
        }
      },
      onReasoningChunk: (reasoningChunk) => {
        if (assistantMsg) {
          assistantMsg.reasoning += reasoningChunk
          scrollToBottom()
        }
      },
      onDone: () => {
        isStreaming.value = false
        streamingIndex.value = -1
        saveSessionForPaper(currentPaperId.value)
      },
      onError: (err) => {
        if (assistantMsg) {
          assistantMsg.content += `\n\n[回答异常: ${err.message || '网络连接中断'}]`
        }
        isStreaming.value = false
        streamingIndex.value = -1
        saveSessionForPaper(currentPaperId.value)
      },
      signal: abortController.signal
    })
  } catch (err) {
    if (err?.name !== 'AbortError' && assistantMsg) {
      assistantMsg.content += `\n\n[调用错误: ${err.message || '未知错误'}]`
    }
    isStreaming.value = false
    streamingIndex.value = -1
    saveSessionForPaper(currentPaperId.value)
  }
}

// 提问重试 (截断该提问之后的所有回答并重新请求解答)
async function handleRetryUserMessage(userIndex) {
  if (isStreaming.value) return
  messages.value = messages.value.slice(0, userIndex + 1)
  const assistantMsg = {
    role: 'assistant',
    content: '',
    reasoning: '',
    reasoningOpen: true,
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  saveSessionForPaper(currentPaperId.value)
  await startAssistantStream(messages.value.length - 1)
}

// 行内编辑提问
function handleStartEdit(index, content) {
  if (isStreaming.value) return
  editingMessageIndex.value = index
  editingContent.value = content || ''
}

function handleCancelEdit() {
  editingMessageIndex.value = -1
  editingContent.value = ''
}

async function handleSaveEdit(index) {
  const newContent = editingContent.value.trim()
  if (!newContent) {
    notify('提问内容不能为空', 'warning')
    return
  }
  if (messages.value[index]) {
    messages.value[index].content = newContent
    messages.value[index].timestamp = Date.now()
  }
  editingMessageIndex.value = -1
  editingContent.value = ''

  // 截断该消息之后的消息并重新生成解答
  messages.value = messages.value.slice(0, index + 1)
  const assistantMsg = {
    role: 'assistant',
    content: '',
    reasoning: '',
    reasoningOpen: true,
    timestamp: Date.now()
  }
  messages.value.push(assistantMsg)
  saveSessionForPaper(currentPaperId.value)
  await startAssistantStream(messages.value.length - 1)
}

// 停止生成
function stopGeneration() {
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  isStreaming.value = false
  streamingIndex.value = -1
}

// 清空当前对话并返回欢迎状态
function handleClearChat() {
  stopGeneration()
  if (activeSessionId.value) {
    const idx = paperSessions.value.findIndex(s => s.id === activeSessionId.value)
    if (idx !== -1) {
      paperSessions.value.splice(idx, 1)
      saveSessionsForPaper(currentPaperId.value)
    }
    activeSessionId.value = null
  }
  messages.value = []
  activeQuote.value = null
  notify('已清空当前研讨记录并返回欢迎状态', 'info')
}

// 滚动到底部
function scrollToBottom() {
  if (!chatScrollContainerRef.value) return
  chatScrollContainerRef.value.scrollTop = chatScrollContainerRef.value.scrollHeight
}

// 复制消息内容 (带轻量状态反馈，对齐图 5)
async function copyMessageContent(text, index = -1) {
  if (!text) return
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    if (index !== -1) {
      copiedIndex.value = index
      clearTimeout(copyResetTimer)
      copyResetTimer = setTimeout(() => {
        copiedIndex.value = -1
      }, 2000)
    }
    notify('内容已成功复制到剪贴板', 'success')
  } catch (_) {
    notify('复制失败，请手动选取复制', 'error')
  }
}

// 本地多会话持久化与会话管理（按当前登录用户沙箱隔离，绝不上传后端，保持纯前端直连）
function getSessionsStorageKey(id) {
  const clean = cleanArxivId(id)
  const scope = resolveUserScope(currentUser.value)
  return scope
    ? `csbd_arxiv_copilot_sessions_${scope}_${clean}`
    : `csbd_arxiv_copilot_sessions_${clean}`
}

function loadSessionsForPaper(id) {
  const clean = cleanArxivId(id)
  if (!clean) return []
  const targetKey = getSessionsStorageKey(clean)
  try {
    const raw = localStorage.getItem(targetKey)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (_) {}

  // 若当前为特定用户作用域（targetKey 非旧版全局格式），检查旧版未隔离的全局历史并平滑迁移
  const legacyGlobalKey = `csbd_arxiv_copilot_sessions_${clean}`
  if (targetKey !== legacyGlobalKey) {
    try {
      const legacyRaw = localStorage.getItem(legacyGlobalKey)
      if (legacyRaw) {
        const parsedLegacy = JSON.parse(legacyRaw)
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          localStorage.setItem(targetKey, JSON.stringify(parsedLegacy))
          // 迁移后移除旧全局键，防止后续登录的其他账号串扰读取
          localStorage.removeItem(legacyGlobalKey)
          return parsedLegacy
        }
      }
    } catch (_) {}
  }

  // 平滑迁移旧单会话
  try {
    const legacyKey = `csbd_arxiv_copilot_session_${clean}`
    const rawLegacy = localStorage.getItem(legacyKey)
    if (rawLegacy) {
      const legacyMsgs = JSON.parse(rawLegacy)
      if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
        const firstUser = legacyMsgs.find(m => m.role === 'user')?.content || '历史研讨'
        const migratedSession = {
          id: 'session_' + Date.now(),
          title: firstUser.slice(0, 36),
          createdAt: legacyMsgs[0]?.timestamp || Date.now(),
          updatedAt: legacyMsgs[legacyMsgs.length - 1]?.timestamp || Date.now(),
          messages: legacyMsgs
        }
        const initialList = [migratedSession]
        localStorage.setItem(targetKey, JSON.stringify(initialList))
        localStorage.removeItem(legacyKey)
        return initialList
      }
    }
  } catch (_) {}

  return []
}

function saveSessionsForPaper(id) {
  const clean = cleanArxivId(id)
  if (!clean) return
  try {
    localStorage.setItem(getSessionsStorageKey(clean), JSON.stringify(paperSessions.value))
  } catch (_) {}
}

function loadSessionForPaper(id) {
  const clean = cleanArxivId(id)
  if (!clean) return
  paperSessions.value = loadSessionsForPaper(clean)
  activeSessionId.value = null
  messages.value = []
}

function saveSessionForPaper(id) {
  const clean = cleanArxivId(id)
  if (!clean) return
  if (activeSessionId.value) {
    const cur = paperSessions.value.find(s => s.id === activeSessionId.value)
    if (cur) {
      cur.messages = [...messages.value]
      cur.updatedAt = Date.now()
      if (!cur.title || cur.title === '新研讨会话') {
        const firstUser = messages.value.find(m => m.role === 'user')?.content
        if (firstUser) cur.title = firstUser.slice(0, 36)
      }
    }
  }
  saveSessionsForPaper(clean)
}

function openSession(sessionId) {
  stopGeneration()
  const found = paperSessions.value.find(s => s.id === sessionId)
  if (!found) return
  activeSessionId.value = found.id
  messages.value = [...(found.messages || [])]
  activeQuote.value = null
  nextTick(() => {
    scrollToBottom()
  })
}

function startNewChat() {
  stopGeneration()
  if (activeSessionId.value) {
    saveSessionForPaper(currentPaperId.value)
  }
  activeSessionId.value = null
  messages.value = []
  activeQuote.value = null
  inputQuestion.value = ''
  notify('已返回伴读引导页，当前研讨已安全保存至列表', 'info')
}

function deleteSession(sessionId) {
  const idx = paperSessions.value.findIndex(s => s.id === sessionId)
  if (idx !== -1) {
    paperSessions.value.splice(idx, 1)
    saveSessionsForPaper(currentPaperId.value)
    if (activeSessionId.value === sessionId) {
      activeSessionId.value = null
      messages.value = []
    }
    notify('已删除该条历史会话', 'info')
  }
}

// 彻底清除某篇文献在本地沙箱的所有持久化会话记录
function removeAllSessionsForPaper(paperId) {
  const clean = cleanArxivId(paperId)
  if (!clean || typeof localStorage === 'undefined') return
  const scope = resolveUserScope(currentUser.value)
  const scopedKey = scope ? `csbd_arxiv_copilot_sessions_${scope}_${clean}` : `csbd_arxiv_copilot_sessions_${clean}`
  const legacyGlobalKey = `csbd_arxiv_copilot_sessions_${clean}`
  const legacySingleKey = `csbd_arxiv_copilot_session_${clean}`

  try {
    localStorage.removeItem(scopedKey)
    localStorage.removeItem(legacyGlobalKey)
    localStorage.removeItem(legacySingleKey)
  } catch (_) {}
}

// 删除文献全部研讨历史（包含从最近文献列表中移除与清空全部沙箱会话）
function handleDeletePaperHistory(paperId) {
  const clean = cleanArxivId(paperId)
  if (!clean) return
  removeRecentArxivPaper(clean, currentUser.value)
  recentPapersList.value = getRecentArxivPapers(currentUser.value)
  removeAllSessionsForPaper(clean)

  if (currentPaperId.value === clean) {
    stopGeneration()
    paperSessions.value = []
    activeSessionId.value = null
    messages.value = []
    activeQuote.value = null
  }

  notify(`已删除 arXiv:${clean} 及其全部历史对话`, 'success')
}

// 清空当前文献的全部历史会话记录（在欢迎页中触发）
function handleClearAllSessionsForCurrentPaper() {
  if (!currentPaperId.value) return
  stopGeneration()
  removeAllSessionsForPaper(currentPaperId.value)
  paperSessions.value = []
  activeSessionId.value = null
  messages.value = []
  activeQuote.value = null
  notify('已清空此文献全部历史研讨会话', 'success')
}

// 自动自愈历史噪音标题，将草稿排版标识或默认 fallback 异步解析为权威真名
async function autoHealRecentPapers() {
  const currentList = getRecentArxivPapers(currentUser.value)
  if (!Array.isArray(currentList) || currentList.length === 0) return

  const needsHealing = currentList.filter(paper => {
    return paper?.id && (!paper.title || isNoiseTitle(paper.title) || paper.title === `arXiv:${paper.id}` || /^arxiv:\s*\d/i.test(paper.title))
  })
  if (needsHealing.length === 0) return

  await Promise.allSettled(
    needsHealing.map(async (paper) => {
      try {
        const meta = await resolveArxivPaperMetadata(paper.id)
        if (meta?.title && !isNoiseTitle(meta.title) && !/^arxiv:\s*\d/i.test(meta.title)) {
          saveRecentArxivPaper(paper.id, meta.title, currentUser.value)
          const found = recentPapersList.value.find(p => p.id === paper.id)
          if (found) {
            found.title = meta.title
          }
        }
      } catch (_) {}
    })
  )

  recentPapersList.value = getRecentArxivPapers(currentUser.value)
}

function formatRelativeTime(ts) {
  if (!ts) return ''
  const diff = Date.now() - Number(ts)
  const diffSec = Math.floor(diff / 1000)
  if (diffSec < 60) return '刚刚'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay === 1) return '昨天'
  if (diffDay < 30) return `${diffDay} 天前`
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 分割条拖动调整
function startDraggingSplitter(e) {
  e.preventDefault()
  isDraggingSplitter.value = true

  const onMouseMove = (moveEvent) => {
    if (!workspaceRef.value) return
    const rect = workspaceRef.value.getBoundingClientRect()
    const offsetX = moveEvent.clientX - rect.left
    const newPercent = (offsetX / rect.width) * 100
    leftWidthPercent.value = Math.min(75, Math.max(25, Number(newPercent.toFixed(1))))
  }

  const onMouseUp = () => {
    isDraggingSplitter.value = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    localStorage.setItem('csbd_arxiv_split_pct', String(leftWidthPercent.value))
  }

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}

function resetSplitRatio() {
  leftWidthPercent.value = 55
  localStorage.setItem('csbd_arxiv_split_pct', '55')
}

// 辅助方法
function formatTime(timestamp) {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function renderLatexTitle(title) {
  if (!title) return ''
  return renderMarkdown(title).replace(/^<p>|<\/p>$/g, '')
}

function handlePdfLoaded() {}
function handlePdfError() {}

function checkMobile() {
  if (typeof window !== 'undefined') {
    isMobile.value = window.innerWidth <= 768
  }
}

// 监听 paperId 变更
watch(() => props.initialPaperId, (newId) => {
  const clean = cleanArxivId(newId)
  if (clean !== currentPaperId.value) {
    handlePaperChange(clean)
  }
})

watch(() => fulltextData.value?.title, (t) => {
  if (t && currentPaperId.value) {
    saveRecentArxivPaper(currentPaperId.value, t, currentUser.value)
    recentPapersList.value = getRecentArxivPapers(currentUser.value)
  }
})

function reloadPaperSessionsForCurrentUser() {
  recentPapersList.value = getRecentArxivPapers(currentUser.value)
  autoHealRecentPapers()
  if (currentPaperId.value) {
    loadSessionForPaper(currentPaperId.value)
  }
}

// 监听当前登录用户账号变动，即时无缝切换沙箱
watch(
  () => currentUser.value?.id || currentUser.value?.username || currentUser.value?.email || '',
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      reloadPaperSessionsForCurrentUser()
    }
  }
)

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  window.addEventListener('account-updated', reloadPaperSessionsForCurrentUser)
  window.addEventListener('storage', reloadPaperSessionsForCurrentUser)
  autoHealRecentPapers()
  if (currentPaperId.value) {
    loadSessionForPaper(currentPaperId.value)
    loadPaperFulltext(currentPaperId.value, currentSource.value)
  } else {
    loadLandingFeedPapers()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  window.removeEventListener('account-updated', reloadPaperSessionsForCurrentUser)
  window.removeEventListener('storage', reloadPaperSessionsForCurrentUser)
  clearTimeout(copyResetTimer)
  stopGeneration()
})
</script>

<style scoped>
.arxiv-copilot-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #090a0f;
  color: #f1f5f9;
  overflow: hidden;
  position: relative;
}

/* 主工作台分屏容器 */
.copilot-workspace {
  display: flex;
  flex-direction: row;
  height: 100%;
  width: 100%;
  overflow: hidden;
  position: relative;
}

/* 左侧栏：阅览区域 */
.left-reading-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #090a0f;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  position: relative;
}

/* 视图：PDF 容器 */
.pdf-viewer-wrapper {
  flex: 1;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

/* 移动端底栏视图切换 */
.mobile-pane-tabs {
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: 48px;
  background: #0c0e15;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  z-index: 30;
}

.mobile-pane-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mobile-pane-tab svg {
  width: 16px;
  height: 16px;
}

.mobile-pane-tab.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  font-weight: 600;
}

/* 分割调整条 */
.split-resizer {
  width: 6px;
  height: 100%;
  cursor: col-resize;
  background: #090a0f;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s ease;
  z-index: 20;
}

.split-resizer:hover,
.copilot-workspace.is-resizing .split-resizer {
  background: color-mix(in srgb, var(--accent) 25%, transparent);
}

.resizer-handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 24px;
  border-radius: 1px;
  background: rgba(255, 255, 255, 0.2);
}

/* 右侧栏：Assistant 独立卡片 */
.right-assistant-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #090a0f;
  padding: 12px 14px 12px 6px;
  overflow: hidden;
}

.assistant-card-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0c0e15;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
  min-height: 0;
}

/* 顶部 Assistant 标题栏 */
.assistant-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  flex-shrink: 0;
}

.assistant-headline {
  font-size: 14px;
  font-weight: 600;
  color: #f1f5f9;
}

.assistant-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.new-chat-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.new-chat-btn:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  color: var(--accent);
  transform: translateY(-0.5px);
}

.new-chat-plus-icon {
  width: 14px;
  height: 14px;
}

.assistant-tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.assistant-tool-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
}

.assistant-tool-btn svg {
  width: 14px;
  height: 14px;
}

/* 消息视口 */
.assistant-messages-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 22px 24px;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* 初始欢迎状态：图 2 原版 2×2 引导卡片 */
.welcome-guide-container {
  display: flex;
  flex-direction: column;
  margin: auto 0 20px;
}

.guide-lead-title {
  font-size: 17px;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 18px;
  letter-spacing: -0.01em;
}

.guide-cards-2x2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.guide-action-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 104px;
  padding: 14px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.08);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.guide-action-card:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.card-icon-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.action-icon-circle {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: #94a3b8;
}

.action-icon-circle.fork { color: #f472b6; }
.action-icon-circle.code { color: var(--accent); }
.action-icon-circle.list { color: #a78bfa; }
.action-icon-circle.alert { color: #fb923c; }

.action-icon-circle svg {
  width: 17px;
  height: 17px;
}

.chevron-right {
  width: 15px;
  height: 15px;
  color: #475569;
}

.card-headline {
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.42;
  color: #e2e8f0;
}

/* 图 2 原版：Continue a recent chat */
.continue-chat-section {
  margin-top: 24px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.continue-chat-label {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
  margin: 0;
  letter-spacing: -0.01em;
}

.continue-chat-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.clear-all-sessions-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: none;
  font-size: 12px;
  color: #94a3b8;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.clear-all-sessions-link-btn:hover {
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.12);
}

.recent-sessions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 10px 14px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.recent-session-item:hover {
  background: color-mix(in srgb, var(--accent) 6%, rgba(255, 255, 255, 0.05));
  border-color: color-mix(in srgb, var(--accent) 25%, transparent);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.session-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  flex: 1;
}

.session-bubble-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: #94a3b8;
  transition: all 0.2s ease;
}

.recent-session-item:hover .session-bubble-icon {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 15%, transparent);
}

.session-bubble-icon svg {
  width: 16px;
  height: 16px;
}

.session-item-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.session-item-title {
  font-size: 13.5px;
  font-weight: 500;
  color: #f1f5f9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.recent-session-item:hover .session-item-title {
  color: var(--accent);
}

.session-item-date {
  font-size: 12px;
  color: #64748b;
}

.session-item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.delete-history-btn {
  display: none;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.recent-session-item:hover .delete-history-btn {
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-history-btn:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.item-chevron-right {
  width: 14px;
  height: 14px;
  color: #64748b;
  transition: transform 0.2s ease, color 0.2s ease;
}

.recent-session-item:hover .item-chevron-right {
  color: #94a3b8;
  transform: translateX(2px);
}

/* 消息流线程 */
.copilot-thread-list {
  display: flex;
  flex-direction: column;
  gap: 22px;
  width: 100%;
}

.thread-message-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  transition: all 0.2s ease;
}

/* 用户提问气泡：仅包裹气泡内的提问文字与内容，操作栏在气泡外面 */
.thread-message-item.user .msg-bubble-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

.thread-message-item.assistant .msg-bubble-card {
  width: 100%;
  padding: 4px 2px;
}

.user-msg-text {
  font-size: 14.5px;
  line-height: 1.65;
  color: #f1f5f9;
  white-space: pre-wrap;
  word-break: break-word;
}

.msg-images-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.msg-image-thumb {
  max-width: 220px;
  max-height: 160px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
}

.embedded-quote-chip {
  background: color-mix(in srgb, var(--accent) 7%, rgba(255, 255, 255, 0.03));
  border-left: 3px solid var(--accent);
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
}

.quote-page-badge {
  font-size: 11px;
  color: var(--accent);
  font-weight: 600;
  display: block;
  margin-bottom: 3px;
}

.quote-chip-text {
  font-size: 13px;
  line-height: 1.55;
  color: #cbd5e1;
  margin: 0;
  font-style: normal;
}

/* 推理折叠区域 */
.reasoning-disclosure {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
}

.reasoning-summary-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

.sparkle-icon {
  width: 13px;
  height: 13px;
  color: var(--accent);
}

.thinking-dot-pulse {
  color: var(--accent);
  font-size: 11px;
  margin-left: auto;
}

.reasoning-content-box {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  line-height: 1.7;
  color: #94a3b8;
  white-space: pre-wrap;
}

/* 正文渲染：增强阅读字号与行距，公式与段落留白充分，缓解阅读疲劳 */
.msg-markdown-view {
  font-size: 14.5px;
  line-height: 1.78;
  color: #f1f5f9;
  letter-spacing: 0.012em;
}

.msg-markdown-view :deep(p) {
  margin: 0 0 13px 0;
  line-height: 1.78;
}

.msg-markdown-view :deep(p:last-child) {
  margin-bottom: 0;
}

.msg-markdown-view :deep(ul),
.msg-markdown-view :deep(ol) {
  margin: 8px 0 14px;
  padding-left: 22px;
}

.msg-markdown-view :deep(li) {
  margin-bottom: 6px;
  line-height: 1.75;
}

.msg-markdown-view :deep(h1),
.msg-markdown-view :deep(h2),
.msg-markdown-view :deep(h3),
.msg-markdown-view :deep(h4) {
  margin-top: 18px;
  margin-bottom: 10px;
  color: #ffffff;
  font-weight: 600;
  line-height: 1.35;
}

.msg-markdown-view :deep(pre),
.msg-markdown-view :deep(.katex-display) {
  margin: 14px 0 !important;
  padding: 10px 14px;
  border-radius: 10px;
}

.msg-markdown-view :deep(.katex-display) {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 8px 12px;
}

/* 鼠标悬浮才浮现的操作与时间栏 (对齐图 5 alphaxiv 设计：气泡外部，时间在左边，其余按钮在右边) */
.msg-hover-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  min-height: 24px;
  margin-top: 6px;
  padding: 2px 4px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease-in-out;
}

.thread-message-item:hover .msg-hover-footer {
  opacity: 1;
  pointer-events: auto;
}

.msg-footer-left {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.msg-hover-time {
  font-size: 11.5px;
  color: #71717a;
  letter-spacing: 0.01em;
  user-select: none;
}

.msg-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-shrink: 0;
}

.msg-action-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: #71717a;
  cursor: pointer;
  padding: 0;
  transition: all 0.15s ease;
}

.msg-action-icon-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: #f4f4f5;
}

.msg-action-icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.msg-action-icon-btn svg {
  width: 14px;
  height: 14px;
}

/* 行内编辑提问框 */
.inline-edit-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.inline-edit-textarea {
  width: 100%;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid color-mix(in srgb, var(--accent) 40%, rgba(255, 255, 255, 0.15));
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13.5px;
  line-height: 1.6;
  color: #f1f5f9;
  resize: vertical;
  outline: none;
  font-family: inherit;
}

.inline-edit-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 25%, transparent);
}

.inline-edit-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.btn-cancel-edit,
.btn-save-edit {
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-cancel-edit {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.btn-cancel-edit:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}

.btn-save-edit {
  background: var(--accent);
  border: none;
  color: var(--accent-ink, #0b1120);
}

.btn-save-edit:hover {
  filter: brightness(1.1);
}

.stream-pulse-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--accent);
}

.pulse-spark {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.5s infinite;
}

.streaming-placeholder-box {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  color: #94a3b8;
  padding: 8px 0;
}

.dot-spinner {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: bounce 1.4s infinite ease-in-out both;
}

.dot-spinner:nth-child(1) { animation-delay: -0.32s; }
.dot-spinner:nth-child(2) { animation-delay: -0.16s; }

.hint-text {
  margin-left: 6px;
}

/* 底部输入框容器 (图 2 原版悬浮卡片) */
.alphaxiv-input-shell {
  padding: 12px 16px 16px;
  flex-shrink: 0;
}

/* 待发送图片胶囊栏 */
.pending-images-bar {
  display: flex;
  gap: 8px;
  padding: 0 4px 8px;
  overflow-x: auto;
}

.pending-image-card {
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  flex-shrink: 0;
}

.pending-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: background 0.15s ease;
}

.remove-image-btn:hover {
  background: #ef4444;
}

.hidden-file-input {
  display: none;
}

.alphaxiv-input-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.alphaxiv-input-card:focus-within {
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}

.active-quote-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
}

.banner-quote-left {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  white-space: nowrap;
}

.quote-page-info {
  font-weight: 600;
  color: var(--accent);
}

.quote-text-preview {
  color: #cbd5e1;
  text-overflow: ellipsis;
  overflow: hidden;
}

.quote-dismiss-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 2px;
}

.quote-dismiss-btn:hover {
  color: #fff;
}

.quote-dismiss-btn svg {
  width: 12px;
  height: 12px;
}

/* 核心多行输入框 */
.alphaxiv-textarea {
  width: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  font-size: 13.5px;
  line-height: 1.5;
  color: #f1f5f9;
  min-height: 44px;
  max-height: 130px;
}

.alphaxiv-textarea::placeholder {
  color: #555e75;
}

/* 底部操作行 */
.alphaxiv-bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.bottom-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bar-attach-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}

.bar-attach-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #cbd5e1;
}

.bar-attach-btn svg {
  width: 15px;
  height: 15px;
}

/* 核心功能：模型切换下拉选择器 */
.copilot-model-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  padding: 2px 22px 2px 8px;
  transition: all 0.2s ease;
}

.copilot-model-select-wrapper:hover {
  background: rgba(255, 255, 255, 0.09);
  border-color: var(--accent);
}

.model-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
  margin-right: 5px;
  flex-shrink: 0;
}

.copilot-model-dropdown {
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  color: #e2e8f0;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  padding: 2px 0;
  max-width: 150px;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.copilot-model-dropdown option {
  background: #0f121d;
  color: #f1f5f9;
}

.select-down-arrow {
  position: absolute;
  right: 7px;
  pointer-events: none;
  color: #64748b;
}

/* 核心功能：推理档位调节组件 */
.copilot-reasoning-widget {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 5px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.reasoning-caption {
  font-size: 10.5px;
  color: #94a3b8;
  font-weight: 500;
  padding-left: 2px;
}

.reasoning-btn-group {
  display: inline-flex;
  gap: 2px;
}

.reasoning-pill-btn {
  padding: 1px 6px;
  border-radius: 9999px;
  border: none;
  background: transparent;
  color: #94a3b8;
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-transform: uppercase;
}

.reasoning-pill-btn:hover {
  color: #f1f5f9;
}

.reasoning-pill-btn.is-active {
  background: var(--accent);
  color: var(--accent-ink, #070314);
}

/* 圆形发送按钮 (图 2 原版设计) */
.circular-send-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #232736;
  border: none;
  color: #475569;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: not-allowed;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.circular-send-btn.is-active {
  background: #f8fafc;
  color: #0b0f19;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(255, 255, 255, 0.15);
}

.circular-send-btn.is-active:hover {
  transform: scale(1.05);
}

.circular-send-btn.stop-state {
  background: #ef4444;
  color: #ffffff;
  cursor: pointer;
}

.circular-send-btn svg {
  width: 16px;
  height: 16px;
}

/* 原文查看模态弹窗 */
.raw-source-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.raw-source-modal {
  width: 100%;
  max-width: 860px;
  max-height: 85vh;
  background: #0f121d;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-title {
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.modal-source-pill {
  font-size: 11.5px;
  color: #94a3b8;
  margin-left: 10px;
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
}

.modal-close-btn svg {
  width: 18px;
  height: 18px;
}

.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.raw-text-viewer {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #cbd5e1;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.modal-btn {
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

.modal-btn.primary {
  background: var(--accent);
  color: var(--accent-ink, #000000);
  border: none;
}

.modal-btn.secondary {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
}

/* 动效 */
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1.0); }
}

.fade-drop-enter-active,
.fade-drop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.fade-drop-enter-from,
.fade-drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .copilot-workspace {
    flex-direction: column;
  }
  .left-reading-pane,
  .right-assistant-pane {
    width: 100% !important;
  }
  .right-assistant-pane {
    padding: 8px;
  }
  .guide-cards-2x2 {
    grid-template-columns: 1fr;
  }
  .abstract-viewport-scroller {
    padding: 24px 20px 60px;
  }
}

/* ======================================================== */
/* 沉浸式文献挑选与启动引导页 (Landing Screen) */
/* ======================================================== */
.arxiv-landing-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  overflow-y: auto;
  position: relative;
  background: radial-gradient(circle at 50% 20%, rgba(20, 28, 48, 0.45) 0%, transparent 70%);
}

.landing-content-card {
  max-width: 880px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  margin: auto;
}

.landing-header {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.landing-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.landing-sparkle {
  width: 16px;
  height: 16px;
  animation: pulseSparkle 2.5s ease-in-out infinite;
}

@keyframes pulseSparkle {
  0%, 100% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

.landing-title {
  font-size: 28px;
  font-weight: 700;
  color: #f8fafc;
  margin: 0;
  letter-spacing: -0.02em;
}

.landing-subtitle {
  font-size: 14px;
  color: #94a3b8;
  margin: 0;
  max-width: 600px;
  line-height: 1.6;
}

.landing-input-panel {
  width: 100%;
  max-width: 720px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.landing-input-box {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(15, 23, 42, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-radius: 14px;
  padding: 8px 10px 8px 18px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
  transition: all 0.25s ease;
}

.landing-input-box:focus-within {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  box-shadow: 0 12px 36px color-mix(in srgb, var(--accent) 15%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent) 30%, transparent);
}

.landing-input-box.has-error {
  border-color: rgba(239, 68, 68, 0.6);
}

.landing-input-prefix {
  font-weight: 700;
  font-size: 15px;
  color: var(--accent);
  letter-spacing: 0.04em;
  user-select: none;
}

.landing-text-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 15px;
  font-family: inherit;
  padding: 4px 0;
}

.landing-text-input::placeholder {
  color: #64748b;
  font-size: 14px;
}

.landing-submit-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--accent);
  color: var(--accent-ink, #000000);
  border: none;
  border-radius: 10px;
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.landing-submit-btn svg {
  width: 16px;
  height: 16px;
}

.landing-submit-btn:hover:not(:disabled) {
  background: var(--accent-strong, var(--accent));
  transform: translateY(-1px);
  box-shadow: 0 4px 16px color-mix(in srgb, var(--accent) 35%, transparent);
}

.landing-submit-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.landing-error-hint {
  font-size: 13px;
  color: #f87171;
  padding-left: 12px;
}

.landing-grids {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.landing-grid-col {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.col-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #cbd5e1;
}

.col-icon {
  width: 16px;
  height: 16px;
  color: #94a3b8;
}

.col-icon.star {
  color: #f59e0b;
}

.recent-papers-list,
.feed-papers-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.landing-paper-card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px 16px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.landing-paper-card:hover {
  background: rgba(30, 41, 59, 0.7);
  border-color: color-mix(in srgb, var(--accent) 35%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}

.paper-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.paper-card-top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-recent-paper-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
  opacity: 0.7;
}

.delete-recent-paper-btn:hover {
  color: #f43f5e;
  background: rgba(244, 63, 94, 0.15);
  opacity: 1;
  transform: scale(1.08);
}

.paper-id-tag {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  padding: 2px 8px;
  border-radius: 6px;
}

.paper-id-tag.feed-tag {
  color: #a78bfa;
  background: rgba(167, 139, 250, 0.1);
}

.paper-card-action {
  font-size: 12px;
  color: #94a3b8;
  transition: color 0.2s;
}

.landing-paper-card:hover .paper-card-action {
  color: var(--accent);
}

.paper-card-title {
  font-size: 13px;
  font-weight: 500;
  color: #e2e8f0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.paper-card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
}

.category-pill {
  font-size: 11px;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.05);
  padding: 1px 6px;
  border-radius: 4px;
}

.recommender-note {
  font-size: 11px;
  color: #64748b;
}

.landing-empty-box {
  padding: 28px 16px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.3);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  text-align: center;
}

.empty-tip-text {
  font-size: 13px;
  color: #64748b;
}

@media (max-width: 768px) {
  .landing-grids {
    grid-template-columns: 1fr;
  }
  .landing-title {
    font-size: 22px;
  }
  .landing-input-box {
    flex-direction: column;
    align-items: stretch;
    padding: 12px;
  }
  .landing-submit-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
