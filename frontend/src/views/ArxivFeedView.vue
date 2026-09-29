<template>
  <main class="page-shell arxiv-page">
    <section class="page-heading">
      <div>
        <p class="eyebrow">今日阅读</p>
        <h1>文献推荐流</h1>
      </div>
      <SilentLizardButton @click="showInput = !showInput" />
    </section>
    <SpotlightCard class="recommend-panel" spotlight-color="rgba(125, 211, 252, .16)">
      <div class="panel-heading">
        <div>
          <h2>快速归档</h2>
        </div>
        <TallSwanToggle v-model="showInput" />
      </div>
      <Transition name="expand-spring">
        <div v-if="showInput" class="expandable-panel">
          <form class="recommend-form" @submit.prevent="handlePreview">
            <WaveInput
              v-model="inputUrlOrId"
              label="arXiv 编号 / DOI / 期刊链接（支持多篇）"
              placeholder="例如 2302.13971, 2401.00123"
              wrapper-class="arxiv-wave-input"
              @keydown.enter.prevent="handlePreview"
            />
            <SpottyHorseButton
              :loading="previewing"
              :disabled="!inputUrlOrId.trim()"
            />
          </form>
          <JournalPaperForm @prepared="previewData = $event; previewError = ''" />
          <p v-if="previewError" class="inline-error">{{ previewError }}</p>
        </div>
      </Transition>
      <div v-if="previewData" class="preview-card">
        <!-- 批量识别多篇文献 -->
        <div v-if="previewData.is_batch && previewData.papers?.length > 1" class="batch-preview-container">
          <div class="batch-preview-header">
            <span class="badge cyan">批量识别 · {{ previewData.papers.length }} 篇文献</span>
            <p class="batch-preview-hint">已自动识别出以下 {{ previewData.papers.length }} 篇文献，确认后将分别生成独立的文献分享：</p>
          </div>
          <div class="batch-paper-list">
            <div
              v-for="(p, pIdx) in previewData.papers"
              :key="p.arxiv_id || pIdx"
              class="batch-paper-item"
            >
              <div class="batch-paper-info">
                <span class="data-label">{{ paperLabel(p) }}</span>
                <h4 class="batch-paper-title" v-html="renderLatex(p.title)"></h4>
                <p class="batch-paper-authors">{{ (p.authors || []).slice(0, 3).join(', ') }}{{ (p.authors || []).length > 3 ? ' 等' : '' }}</p>
              </div>
              <button
                v-if="previewData.papers.length > 1"
                type="button"
                class="remove-batch-item-btn"
                title="移除此篇"
                @click="removeBatchPaper(pIdx)"
              >
                <AppIcon name="close" :size="14" />
              </button>
            </div>
          </div>
        </div>

        <!-- 单篇文献展示 -->
        <div v-else>
          <span class="data-label">{{ paperLabel(previewData) }}</span>
          <h3 v-html="renderLatex(previewData.title)"></h3>
          <p>{{ (previewData.authors || []).slice(0, 3).join(', ') }}{{ (previewData.authors || []).length > 3 ? ' 等' : '' }}</p>
        </div>

        <textarea
          v-model="recommendComment"
          rows="2"
          :placeholder="previewData.is_batch && previewData.papers?.length > 1 ? '推荐理由或研读重点，支持 Markdown 与 LaTeX 公式（将应用于识别出的全部文献，可选）' : '推荐理由或研读重点，支持 Markdown 与 LaTeX 公式（可选）'"
        ></textarea>
        <div v-if="recommendComment && recommendComment.trim()" class="recommend-preview">
          <span class="preview-tag">实时预览：</span>
          <div class="preview-content markdown-content" v-html="renderMarkdown(recommendComment)"></div>
        </div>
        <RecommendationAudience v-model="audience" />
        <div class="inline-actions">
          <button type="button" class="button button-quiet" @click="previewData = null">取消</button>
          <SmartMothButton
            :disabled="submitting || (audience.visibility === 'direct' && !audience.recipient_ids.length)"
            :loading="submitting"
            :label="submitting ? '发布中…' : (previewData.is_batch && previewData.papers?.length > 1 ? `发布全部 ${previewData.papers.length} 篇文献` : (audience.visibility === 'direct' ? '发送定向推荐' : '发布到公共推荐流'))"
            @click="handleSubmitRecommend"
          />
        </div>
      </div>
    </SpotlightCard>
    <section class="feed-toolbar"><SlidingSegmented class="segmented" aria-label="文献筛选" :active-key="scope"><button v-for="option in scopes" :key="option.id" :class="{ active: scope === option.id }" @click="changeScope(option.id)">{{ option.label }}</button></SlidingSegmented><span class="count-label">{{ visibleFeed.length }} 篇</span></section>
    <LoadingState v-if="loading" message="正在更新文献流" />
    <section v-else-if="loadError" class="empty-state"><AppIcon name="warning" :size="28" /><h2>暂时无法读取文献流</h2><p>{{ loadError }}</p><button class="button button-quiet" @click="loadFeed">重试</button></section>
    <section v-else-if="!visibleFeed.length" class="empty-state"><AppIcon name="file-text" :size="28" /><h2>这里还没有文献</h2><p>从上方录入一篇值得组内讨论的论文。</p></section>
    <section v-else class="paper-list">
      <article v-for="paper in visibleFeed" :key="paper.id" :id="'paper-' + paper.id" class="paper-row" :class="{ featured: paper.is_pinned, 'seminar-today': paper.is_seminar_today, 'is-target-highlighted': highlightedPaperId === paper.id }">
        <div class="paper-meta">
          <div class="paper-meta-info">
            <span :class="['badge', paper.visibility === 'direct' ? 'amber' : 'cyan']">{{ paper.visibility === 'direct' ? '定向推荐' : '公开推荐' }}</span>
            <span v-if="paper.is_seminar_today" class="priority-label seminar-priority">今日组会</span>
            <span v-else-if="paper.is_teacher_pinned" class="priority-label teacher-priority">导师重点（今日置顶）</span>
            <span v-else-if="paper.is_pinned" class="priority-label">置顶推荐</span>
            <span v-else-if="paper.recommender?.identity === 'teacher'" class="badge purple">导师推荐</span>
            <span v-if="paper.created_at" class="meta-date" :title="'推荐发送时间：' + paper.created_at">
              推荐：{{ formatRecommendDate(paper.created_at) }}
            </span>
            <span v-if="paper.published_date" class="meta-date meta-pub-date" :title="'原文发表时间：' + paper.published_date">
              发表：{{ paper.published_date }}
            </span>
            <span class="meta-category" :title="paper.journal || paper.primary_category || 'arXiv'">{{ paper.journal || paper.primary_category || 'arXiv' }}</span>
          </div>

          <div class="paper-meta-actions">
            <div class="paper-meta-actions paper-action-dock" role="toolbar" aria-label="文献快捷操作">
            <!-- 1. 打开 PDF -->
            <div class="dock-item pdf">
              <span class="tooltip">{{ paperReadLabel(paper) }}</span>
              <a class="pdf-link button small secondary" :href="paperRead(paper)" target="_blank" rel="noreferrer" :aria-label="paperReadLabel(paper)">
                <div class="filled"></div>
                <svg class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                  <path fill="currentColor" d="M974.848 647.168c-28.672-30.72-86.016-48.128-167.936-48.128-44.032 0-94.208 4.096-149.504 14.336-30.72-30.72-62.464-66.56-92.16-108.544-21.504-29.696-39.936-60.416-56.32-91.136 32.768-101.376 48.128-183.296 48.128-242.688 0-66.56-23.552-136.192-93.184-136.192-21.504 0-41.984 13.312-53.248 31.744-30.72 56.32-17.408 179.2 36.864 300.032-20.48 60.416-40.96 118.784-67.584 183.296-22.528 54.272-49.152 111.616-76.8 162.816-155.648 63.488-256 137.216-265.216 194.56-4.096 21.504 3.072 41.984 18.432 57.344 5.12 4.096 25.6 21.504 59.392 21.504 103.424 0 211.968-169.984 267.264-273.408 41.984-14.336 84.992-27.648 126.976-39.936 46.08-13.312 93.184-23.552 135.168-30.72C753.664 741.376 849.92 757.76 898.048 757.76c59.392 0 80.896-24.576 88.064-45.056 11.264-25.6 3.072-54.272-10.24-69.632l-1.024 4.096z m-55.296 41.984c-4.096 21.504-25.6 35.84-55.296 35.84-8.192 0-15.36-1.024-23.552-3.072-54.272-13.312-104.448-40.96-155.648-83.968 50.176-8.192 92.16-10.24 118.784-10.24 29.696 0 55.296 1.024 71.68 6.144 19.456 4.096 50.176 17.408 44.032 55.296z m-300.032-67.584c-36.864 7.168-75.776 16.384-116.736 27.648-32.768 9.216-66.56 18.432-100.352 30.72 18.432-35.84 33.792-70.656 48.128-103.424 17.408-40.96 30.72-81.92 45.056-120.832 14.336 24.576 29.696 49.152 45.056 70.656 25.6 33.792 52.224 66.56 78.848 95.232zM434.176 83.968c6.144-11.264 17.408-17.408 26.624-17.408 29.696 0 34.816 34.816 34.816 62.464 0 46.08-14.336 116.736-37.888 197.632-40.96-112.64-44.032-205.824-23.552-242.688zM279.552 756.736c-71.68 120.832-141.312 196.608-183.296 196.608-8.192 0-15.36-3.072-21.504-7.168-8.192-8.192-12.288-18.432-10.24-30.72 8.192-43.008 89.088-103.424 215.04-158.72z" />
                </svg>
              </a>
            </div>

            <!-- 2. 与AI讨论 (Robot icon) -->
            <div v-if="isAiReady && paper.arxiv_id" class="dock-item ai-discuss">
              <span class="tooltip">与AI讨论</span>
              <button
                type="button"
                class="discuss-ai-btn button small secondary"
                @click="handleDiscussWithAi(paper)"
                aria-label="与AI讨论"
              >
                <div class="filled"></div>
                <svg class="dock-svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 6V2H8"/><path d="M15 11v2"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M20 16a2 2 0 0 1-2 2H8.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 4 20.286V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z"/><path d="M9 11v2"/>
                </svg>
              </button>
            </div>

            <!-- 3. 查看中文译文/英文原文 & 4. 管理员AI重译 -->
            <template v-if="getPaperTranslation(paper)">
              <div class="dock-item translate-flip">
                <span class="tooltip">{{ isChineseView(paper) ? '译文 (中)' : '原文 (EN)' }}</span>
                <button
                  type="button"
                  class="translate-flip-btn button small"
                  :class="isChineseView(paper) ? 'is-zh' : 'is-en secondary'"
                  @click="togglePaperLang(paper)"
                  :aria-label="isChineseView(paper) ? '译文 (中)' : '原文 (EN)'"
                >
                  <div class="filled"></div>
                  <svg class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                    <path fill="currentColor" d="M608 416H896c35.370667 0 64 28.501333 64 64V896c0 35.370667-28.501333 64-64 64h-416c-35.370667 0-64-28.501333-64-64v-288H128c-35.370667 0-64-28.501333-64-64V128c0-35.370667 28.458667-64 64-64h416c35.370667 0 64 28.458667 64 64v288z m0 128c0 35.370667-28.501333 64-64 64h-64v256c0 17.706667 14.293333 32 32 32h352a32 32 0 0 0 32-32V512a32 32 0 0 0-32-32h-256v64zM128 160V512c0 17.664 14.293333 32 32 32H512a31.914667 31.914667 0 0 0 32-32V160A32 32 0 0 0 512 128H160a32 32 0 0 0-32 32z m64 244.266667V243.370667h112.725333V176h46.762667c6.4 0.938667 9.642667 1.834667 9.642667 2.730667a10.581333 10.581333 0 0 1-1.408 4.138666 74.282667 74.282667 0 0 0-4.096 26.112v34.389334h119.637333v156.757333H424.405333v-20.650667H355.626667v118.272h-49.493334V379.477333h-67.413333v24.746667H192z m46.72-122.368v60.458666h67.413333V281.941333h-67.413333v-0.042666z m185.685333 60.458666V281.941333H355.626667v60.458667h68.736z m203.818667 488.021334H576l92.16-254.378667h64.597333l89.344 254.378667H767.146667l-19.285334-53.632h-100.352l-19.285333 53.632z m33.024-96.256h72.874667L699.733333 625.493333h-1.365333l-37.12 108.629334zM122.581333 665.984a38.4 38.4 0 0 1 43.434667 32.597333c13.653333 95.488 96.896 132.181333 138.069334 138.069334a38.4 38.4 0 0 1-10.837333 76.032c-58.368-8.32-182.784-59.818667-203.264-203.264a38.4 38.4 0 0 1 32.597333-43.434667z m714.069334-361.898667a38.4 38.4 0 0 0 76.032-10.837333c-20.48-143.445333-144.896-194.944-203.264-203.264a38.4 38.4 0 1 0-10.837334 76.032c41.173333 5.888 124.416 42.581333 138.069334 138.069333z" />
                  </svg>
                </button>
              </div>

              <div
                v-if="currentUser?.role === 'admin' && isAiReady"
                class="dock-item retranslate"
              >
                <span class="tooltip">{{ translatingIds.has(getPaperKey(paper)) ? '重译中…' : 'AI重译' }}</span>
                <button
                  type="button"
                  class="retranslate-action-btn button small secondary"
                  :disabled="translatingIds.has(getPaperKey(paper))"
                  @click="handleTranslatePaper(paper, true)"
                  aria-label="AI重译"
                >
                  <div class="filled"></div>
                  <AppIcon v-if="translatingIds.has(getPaperKey(paper))" name="undo" class="spin-icon" :size="15" />
                  <svg v-else class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                    <path fill="currentColor" d="M1019.880673 447.449687l0.063994 0.511956h-132.468657l-0.063995-0.511956H572.750958l208.110181-206.382328A383.967123 383.967123 0 1 0 870.965424 639.945205h136.820284a511.956164 511.956164 0 1 1-134.388493-490.581994L1023.912328 0v447.449687h-4.031655z" />
                  </svg>
                </button>
              </div>
            </template>

            <!-- 5. 初始翻译 (未翻译时) -->
            <div
              v-else-if="!getPaperTranslation(paper)"
              class="dock-item translate-init"
            >
              <span class="tooltip">{{ translatingIds.has(getPaperKey(paper)) ? '翻译中…' : '翻译' }}</span>
              <button
                type="button"
                class="translate-action-btn button small secondary"
                :disabled="translatingIds.has(getPaperKey(paper))"
                @click="handleTranslatePaper(paper, false)"
                aria-label="翻译"
              >
                <div class="filled"></div>
                <AppIcon v-if="translatingIds.has(getPaperKey(paper))" name="undo" class="spin-icon" :size="15" />
                <svg v-else class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                  <path fill="currentColor" d="M608 416H896c35.370667 0 64 28.501333 64 64V896c0 35.370667-28.501333 64-64 64h-416c-35.370667 0-64-28.501333-64-64v-288H128c-35.370667 0-64-28.501333-64-64V128c0-35.370667 28.458667-64 64-64h416c35.370667 0 64 28.458667 64 64v288z m0 128c0 35.370667-28.501333 64-64 64h-64v256c0 17.706667 14.293333 32 32 32h352a32 32 0 0 0 32-32V512a32 32 0 0 0-32-32h-256v64zM128 160V512c0 17.664 14.293333 32 32 32H512a31.914667 31.914667 0 0 0 32-32V160A32 32 0 0 0 512 128H160a32 32 0 0 0-32 32z m64 244.266667V243.370667h112.725333V176h46.762667c6.4 0.938667 9.642667 1.834667 9.642667 2.730667a10.581333 10.581333 0 0 1-1.408 4.138666 74.282667 74.282667 0 0 0-4.096 26.112v34.389334h119.637333v156.757333H424.405333v-20.650667H355.626667v118.272h-49.493334V379.477333h-67.413333v24.746667H192z m46.72-122.368v60.458666h67.413333V281.941333h-67.413333v-0.042666z m185.685333 60.458666V281.941333H355.626667v60.458667h68.736z m203.818667 488.021334H576l92.16-254.378667h64.597333l89.344 254.378667H767.146667l-19.285334-53.632h-100.352l-19.285333 53.632z m33.024-96.256h72.874667L699.733333 625.493333h-1.365333l-37.12 108.629334zM122.581333 665.984a38.4 38.4 0 0 1 43.434667 32.597333c13.653333 95.488 96.896 132.181333 138.069334 138.069334a38.4 38.4 0 0 1-10.837333 76.032c-58.368-8.32-182.784-59.818667-203.264-203.264a38.4 38.4 0 0 1 32.597333-43.434667z m714.069334-361.898667a38.4 38.4 0 0 0 76.032-10.837333c-20.48-143.445333-144.896-194.944-203.264-203.264a38.4 38.4 0 1 0-10.837334 76.032c41.173333 5.888 124.416 42.581333 138.069334 138.069333z" />
                  </svg>
                </button>
              </div>

            <!-- 6. 选为组会分享 / 已是组会分享 -->
            <div v-if="isMySeminarShare(paper)" class="dock-item seminar-shared">
              <span class="tooltip">已是组会分享</span>
              <div class="seminar-linked-status is-linked" aria-label="已是组会分享" tabindex="-1">
                <svg class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                  <path fill="currentColor" d="M725.333333 96a32 32 0 0 1 32 32v42.666667H810.666667a128 128 0 0 1 128 128v285.098666A256 256 0 0 1 583.765333 938.666667H213.333333a128 128 0 0 1-128-128V298.666667a128 128 0 0 1 128-128h53.333334V128a32 32 0 1 1 64 0v42.666667h362.666666V128a32 32 0 0 1 32-32z m0 437.333333a192 192 0 1 0 0 384 192 192 0 0 0 0-384z m-458.666666-298.666666H213.333333A64 64 0 0 0 149.333333 298.666667v512A64 64 0 0 0 213.333333 874.666667h304.042667a256 256 0 0 1 357.290667-357.290667V298.666667A64 64 0 0 0 810.666667 234.666667h-53.333334V298.666667a32 32 0 0 1-64 0V234.666667h-362.666666V298.666667a32 32 0 1 1-64 0V234.666667zM725.333333 608a32 32 0 0 1 32 32v72.106667l33.28 33.28a32 32 0 0 1-45.226666 45.226666l-42.666667-42.666666a32 32 0 0 1-9.386667-22.613334v-85.333333a32 32 0 0 1 32-32z" />
                </svg>
              </div>
            </div>
            <div v-else-if="paper.arxiv_id" class="dock-item seminar-link">
              <span class="tooltip">选为组会分享</span>
              <button
                type="button"
                class="link-seminar-btn button small secondary"
                @click="openLinkToSeminarModal(paper)"
                aria-label="选为组会分享"
              >
                <div class="filled"></div>
                <svg class="dock-svg" viewBox="0 0 1024 1024" width="15" height="15">
                  <path fill="currentColor" d="M725.333333 96a32 32 0 0 1 32 32v42.666667H810.666667a128 128 0 0 1 128 128v285.098666A256 256 0 0 1 583.765333 938.666667H213.333333a128 128 0 0 1-128-128V298.666667a128 128 0 0 1 128-128h53.333334V128a32 32 0 1 1 64 0v42.666667h362.666666V128a32 32 0 0 1 32-32z m0 437.333333a192 192 0 1 0 0 384 192 192 0 0 0 0-384z m-458.666666-298.666666H213.333333A64 64 0 0 0 149.333333 298.666667v512A64 64 0 0 0 213.333333 874.666667h304.042667a256 256 0 0 1 357.290667-357.290667V298.666667A64 64 0 0 0 810.666667 234.666667h-53.333334V298.666667a32 32 0 0 1-64 0V234.666667h-362.666666V298.666667a32 32 0 1 1-64 0V234.666667zM725.333333 608a32 32 0 0 1 32 32v72.106667l33.28 33.28a32 32 0 0 1-45.226666 45.226666l-42.666667-42.666666a32 32 0 0 1-9.386667-22.613334v-85.333333a32 32 0 0 1 32-32z" />
                </svg>
              </button>
            </div>

            <!-- 7. 存入 Zotero -->
            <div class="dock-item zotero">
              <span class="tooltip">{{ zoteroPushedKeys.has(getPaperKey(paper)) ? '已存 Zotero' : '存入 Zotero' }}</span>
              <button
                type="button"
                class="zotero-push-btn button small secondary"
                :class="{ 'is-pushed': zoteroPushedKeys.has(getPaperKey(paper)) }"
                @click="openZoteroPushModal(paper)"
                :aria-label="zoteroPushedKeys.has(getPaperKey(paper)) ? '已存 Zotero' : '存入 Zotero'"
              >
                <div class="filled"></div>
                <img src="/web_icon/zotero-color.svg" width="16" height="16" class="dock-svg zotero-img" alt="Zotero" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="paper-main" :class="{ 'card-in-chinese': isChineseView(paper) }">
          <Transition name="paper-flip" mode="out-in">
            <div :key="isChineseView(paper) ? 'zh-title' : 'en-title'" class="paper-title-wrap">
              <div class="article-source-row">
                <span class="article-source-tag">
                  <AppIcon name="file-text" :size="11" />
                  <span>{{ paper.arxiv_id ? '推荐文章 · ' + (paper.arxiv_id.startsWith('arXiv:') ? paper.arxiv_id : 'arXiv:' + paper.arxiv_id) : (paper.journal ? '推荐文章 · ' + paper.journal : '推荐文章') }}</span>
                </span>
              </div>
              <a :href="paperSource(paper)" target="_blank" rel="noopener">
                <h2 v-html="renderLatex(isChineseView(paper) ? getPaperTranslation(paper).title : paper.title)"></h2>
              </a>
              <div v-if="isChineseView(paper)" class="translation-status-pill">
                <AppIcon name="translate" :size="11" />
                <span>中文学术译本</span>
              </div>
            </div>
          </Transition>
          <PaperAuthors :authors="paper.authors" v-model:expanded="expandedAuthors[paper.id]" />
          <p class="audience-line">
            <span class="audience-flow">
              {{ paper.recommender?.name || '课题组成员' }}
              <span v-if="paper.recommender?.identity === 'teacher'" class="teacher-inline-tag">导师</span>
              <span class="flow-arrow">→</span>
              {{ paper.visibility === 'direct' ? (paper.recipients || []).map(u => u.name).join('、') : '全组成员' }}
            </span>
            <span v-if="paper.created_at" class="recommend-time-inline">
              · 发送于 {{ formatRecommendDate(paper.created_at) }}
            </span>
          </p>
          <div v-if="paper.recommend_comment" class="recommendation" :class="{ 'has-seminar': Boolean(paper.seminar_id) }">
            <div class="recommend-header">
              <span class="recommender-name">{{ paper.recommender?.name || '推荐人' }}：</span>
              <span v-if="paper.seminar_id" class="seminar-tag-action" role="button" tabindex="0" title="点击查看对应组会日程时间线" @click.stop="goToSeminar(paper.seminar_id)">
                <span>查看组会</span>
                <AppIcon name="arrow-up-right" :size="11" />
              </span>
              <button v-if="scope === 'sent' && currentUser?.id === (paper.recommender?.id || paper.recommended_by_id)" type="button" class="inline-edit-btn" title="编辑推荐理由" @click="editVisibility(paper)">
                <AppIcon name="edit" :size="12" />
                <span>编辑</span>
              </button>
            </div>
            <div 
              class="recommend-body markdown-content"
              :class="{ 'clickable-recommend': Boolean(paper.seminar_id) }"
              :title="paper.seminar_id ? '点击查看对应组会日程时间线' : undefined"
              @click="handleRecommendBodyClick(paper, $event)"
              v-html="renderMarkdown(paper.recommend_comment)"
            ></div>
          </div>
          <p v-else-if="scope === 'sent' && currentUser?.id === (paper.recommender?.id || paper.recommended_by_id)" class="recommendation-placeholder">
            <button type="button" class="text-action add-comment-btn" @click="editVisibility(paper)">+ 添加推荐理由</button>
          </p>
          <Transition name="paper-flip" mode="out-in">
            <p
              :key="isChineseView(paper) ? 'zh-abs' : 'en-abs'"
              :class="{ clamped: !expandedAbstracts[paper.id] }"
              class="abstract"
              v-html="renderLatex(isChineseView(paper) ? getPaperTranslation(paper).abstract : paper.abstract)"
            ></p>
          </Transition>
          <button class="text-action" @click="toggleAbstract(paper.id)">{{ expandedAbstracts[paper.id] ? '收起摘要' : '展开摘要' }}</button>
        </div>
        <div class="paper-side-rail">
          <div class="paper-actions">
            <FavoriteButton kind="paper" :target="paper.arxiv_id" />
            <PopularPumaLikeButton :liked="paper.is_liked_by_me" :count="paper.like_count || 0" @toggle="handleToggleLike(paper)" />
            <button v-if="scope === 'sent' && currentUser?.id === (paper.recommender?.id || paper.recommended_by_id)" class="button small secondary visibility-edit" @click="editVisibility(paper)">编辑推荐</button>
            <MightyWarthogBookmark :checked="paper.is_read_by_me" @toggle="handleToggleRead(paper)" />
            <SmartEmuDelete v-if="canDelete(paper)" size="small" title="删除推荐" text="删除" @click="handleDelete(paper)" />
          </div>
          <PaperChatBox :paper="paper" :current-user="currentUser" :expanded="Boolean(expandedAbstracts[paper.id] || expandedAuthors[paper.id])" @comment-added="onCommentAdded(paper, $event)" @comment-deleted="onCommentDeleted(paper, $event)" />
        </div>
      </article>
    </section>
    <BaseDialog :open="!!editingPaper" title="编辑文献推荐" :busy="savingVisibility" @close="editingPaper = null"><form v-if="editingPaper" class="form-grid edit-recommend-form" @submit.prevent="saveVisibility"><p class="academic" v-html="renderLatex(editingPaper.title)"></p><label class="comment-field"><span class="field-label">推荐理由 / 研读重点（支持 Markdown 与 LaTeX，可选）</span><textarea v-model="editComment" rows="4" class="comment-textarea" placeholder="输入研读重点或推荐理由，支持 Markdown（如 **加粗**、- 列表）与 LaTeX 公式（如 $H_0$, $\sigma_8$）…"></textarea></label><div v-if="editComment && editComment.trim()" class="recommend-preview"><span class="preview-tag">实时预览：</span><div class="preview-content markdown-content" v-html="renderMarkdown(editComment)"></div></div><div class="audience-section"><span class="field-label">可见范围</span><RecommendationAudience :key="editingPaper.id" v-model="editAudience" /></div><p class="muted visibility-help">保存后将立即按新范围与新推荐理由展示。若论文还有其他公开推荐或组会收录，公共文献库中的论文仍会保留。</p><p v-if="visibilityError" class="inline-error" role="alert">{{ visibilityError }}</p><div class="form-actions"><button class="button secondary" type="button" :disabled="savingVisibility" @click="editingPaper = null">取消</button><button class="button primary" type="submit" :disabled="savingVisibility || (editAudience.visibility === 'direct' && !editAudience.recipient_ids.length)">{{ savingVisibility ? '保存中…' : '保存修改' }}</button></div></form></BaseDialog>

    <!-- 关联到未来组会分享弹窗 -->
    <BaseDialog
      :open="!!linkingPaper"
      title="选为未来组会分享"
      :busy="isSubmittingLink || loadingUpcoming"
      @close="linkingPaper = null"
    >
      <div v-if="linkingPaper" class="link-seminar-modal-body">
        <div class="selected-paper-card">
          <div class="card-paper-badge muted">当前推荐流文献：</div>
          <div class="paper-brief-id">arXiv:{{ linkingPaper.arxiv_id }}</div>
          <div class="paper-brief-title" v-html="renderLatex(linkingPaper.title)"></div>
        </div>

        <!-- 额外直接输入 arXiv 编号 -->
        <div class="field-section">
          <span class="field-label">同时添加其他 arXiv 编号（可选，支持多篇）</span>
          <WaveInput
            v-model="extraArxivInput"
            label="额外追加的 arXiv 编号或链接"
            placeholder="例如 2401.00123, 2402.04567"
            clearable
            @blur="onExtraArxivChange"
            @change="onExtraArxivChange"
          />
          <p class="muted field-tip" style="font-size: 12px; margin-top: 4px;">
            支持同时填入多篇（逗号或空格分隔），将与本文献一并加入该场组会分享。
          </p>
        </div>

        <div v-if="allPapersToLinkCount > 1" class="pending-papers-summary">
          <span class="muted">本次将为该组会关联 <strong>{{ allPapersToLinkCount }}</strong> 篇文献：</span>
          <div class="pending-chips">
            <span v-for="aid in allPapersToLinkList" :key="aid" class="badge blue">
              arXiv:{{ aid }}
            </span>
          </div>
        </div>

        <div v-if="loadingUpcoming" class="loading-upcoming-wrap">
          <LoadingState message="正在查询您的未来组会排期…" />
        </div>

        <div v-else-if="upcomingPresentations.length === 0" class="empty-upcoming-alert">
          <p class="empty-upcoming-title">您在未来的组会中暂无待进行的 arXiv 分享排期</p>
          <p class="muted">请先联系组会管理员为您安排分享排期槽位，或在组会日程页面确认排期后再进行关联。</p>
          <div class="form-actions" style="margin-top: 16px;">
            <button class="button secondary" type="button" @click="linkingPaper = null">关闭</button>
          </div>
        </div>

        <form v-else class="form-grid link-seminar-form" @submit.prevent="handleConfirmLinkSeminar">
          <div class="field-section">
            <span class="field-label">选择目标组会排期槽位</span>
            <div class="seminar-slot-picker">
              <label
                v-for="slot in upcomingPresentations"
                :key="slot.presentation_id"
                class="seminar-slot-option"
                :class="{ active: selectedPresentationId === slot.presentation_id }"
              >
                <input
                  type="radio"
                  name="target_presentation"
                  :value="slot.presentation_id"
                  v-model="selectedPresentationId"
                  @change="onSelectedPresentationChange"
                />
                <div class="slot-details">
                  <div class="slot-header">
                    <span class="slot-date">{{ slot.date }} ({{ slot.time || '14:30' }})</span>
                    <span class="slot-days" :class="{ 'is-imminent': slot.days_until <= 3 }">
                      {{ slot.days_until === 0 ? '今天' : (slot.days_until === 1 ? '明天' : `${slot.days_until} 天后`) }}
                    </span>
                  </div>
                  <div class="slot-meta muted">
                    <span v-if="slot.topic">主题：{{ slot.topic }}</span>
                    <span v-if="slot.location">地点：{{ slot.location }}</span>
                    <span v-if="slot.papers && slot.papers.length > 0" class="slot-existing-papers">
                      已选文献：{{ slot.papers.join(', ') }}
                    </span>
                  </div>
                </div>
              </label>
            </div>
          </div>

          <!-- 组会查重提醒 -->
          <div v-if="duplicateCheckResult?.presented" class="duplicate-warning-banner" role="alert">
            <div class="warning-header">
              <AppIcon name="warning" :size="16" />
              <strong>查重提醒：该文献在曾经的组会中已分享过</strong>
            </div>
            <div class="warning-body muted">
              <span>往期记录：{{ duplicateCheckResult.paper?.title || ('arXiv:' + duplicateCheckResult.paper?.arxiv_id) }}</span>
            </div>
          </div>

          <!-- 多文献追加 / 替换选项（当所选槽位已有文献时） -->
          <div v-if="currentSelectedSlot?.papers?.length > 0" class="field-section">
            <span class="field-label">文献关联方式</span>
            <div class="mode-selector">
              <label class="mode-option">
                <input type="radio" value="append" v-model="linkMode" />
                <span>追加到该场组会 (多篇分享)</span>
              </label>
              <label class="mode-option">
                <input type="radio" value="replace" v-model="linkMode" />
                <span>替换当前组会已填文献</span>
              </label>
            </div>
          </div>

          <!-- 推荐流同步选项 -->
          <div class="field-section">
            <span class="field-label">推荐流同步分享</span>
            <ThinHoundCheckbox v-model="shareToFeed" :size="18" class="checkbox-option">
              <span>同步在文献分享流中以我的名义额外发送一次分享</span>
            </ThinHoundCheckbox>
          </div>

          <!-- 推荐说明 -->
          <label v-if="shareToFeed" class="comment-field">
            <span class="field-label">分享说明 / 汇报要点</span>
            <textarea
              v-model="linkComment"
              rows="2"
              class="comment-textarea"
              placeholder="输入汇报计划或推荐理由…"
            ></textarea>
          </label>

          <p v-if="linkError" class="inline-error" role="alert">{{ linkError }}</p>

          <div class="form-actions">
            <button class="button secondary" type="button" :disabled="isSubmittingLink" @click="linkingPaper = null">取消</button>
            <button class="button primary" type="submit" :disabled="isSubmittingLink || !selectedPresentationId">
              {{ isSubmittingLink ? '关联中…' : '确认关联' }}
            </button>
          </div>
        </form>
      </div>
    </BaseDialog>

    <!-- 存入 Zotero 弹窗 -->
    <BaseDialog
      :open="zoteroModalOpen"
      title="存入 Zotero 个人文献库"
      :busy="isPushingZotero || isLoadingZoteroModal"
      @close="closeZoteroModal"
    >
      <div v-if="zoteroModalPaper" class="zotero-modal-body">
        <div class="selected-paper-card">
          <div class="card-paper-badge muted">当前文献：</div>
          <div class="paper-brief-id">{{ zoteroModalPaper.arxiv_id ? (zoteroModalPaper.arxiv_id.startsWith('arXiv:') ? zoteroModalPaper.arxiv_id : 'arXiv:' + zoteroModalPaper.arxiv_id) : (zoteroModalPaper.doi || '文献') }}</div>
          <div class="paper-brief-title" v-html="renderLatex(isChineseView(zoteroModalPaper) && getPaperTranslation(zoteroModalPaper) ? getPaperTranslation(zoteroModalPaper).title : zoteroModalPaper.title)"></div>
        </div>

        <div v-if="isLoadingZoteroModal" class="loading-wrap">
          <LoadingState message="正在连接 Zotero 账户…" />
        </div>

        <!-- 已配置 Zotero API -->
        <div v-else-if="zoteroModalConfig?.configured" class="zotero-configured-flow">
          <!-- 树状文件夹选择器 (像素级还原 Zotero Connector 原生体验) -->
          <ZoteroCollectionTree
            v-model="zoteroSelectedCollection"
            :collections="zoteroModalCollections"
            label="保存到"
          />

          <!-- 研读笔记输入框 (Add a note) -->
          <div class="zotero-note-section">
            <textarea
              v-model="zoteroCustomNote"
              rows="2"
              class="zotero-custom-note-textarea"
              placeholder="Add a note (添加个人研读笔记，可选)..."
            ></textarea>
          </div>

          <!-- 标签输入框 -->
          <div class="zotero-tags-section">
            <input
              v-model="zoteroTagsInput"
              type="text"
              class="zotero-tags-input"
              placeholder="标签 (用逗号分隔，可选)"
            />
          </div>

          <div class="field-section zotero-options-section">
            <span class="field-label">附加内容选项</span>
            <div class="options-list">
              <ThinHoundCheckbox
                v-model="zoteroIncludePdf"
                :disabled="isPushingZotero"
                :size="18"
                class="option-checkbox-row"
              >
                <span class="checkbox-text">关联官方 arXiv PDF 网页直链（默认关闭，保持条目纯净以便 Zotero 本地自动获取全文）</span>
              </ThinHoundCheckbox>

              <ThinHoundCheckbox
                v-if="getPaperTranslation(zoteroModalPaper)"
                v-model="zoteroIncludeTranslation"
                :disabled="isPushingZotero"
                :size="18"
                class="option-checkbox-row"
              >
                <span class="checkbox-text">附加学术中文译本笔记（包含中文标题与中文摘要）</span>
              </ThinHoundCheckbox>

              <ThinHoundCheckbox
                v-if="zoteroModalPaper.recommend_comment"
                v-model="zoteroIncludeComment"
                :disabled="isPushingZotero"
                :size="18"
                class="option-checkbox-row"
              >
                <span class="checkbox-text">附加课题组推荐理由与研读重点（创建为子笔记）</span>
              </ThinHoundCheckbox>

              <ThinHoundCheckbox
                v-if="zoteroSelectedCollection && zoteroSelectedCollection !== zoteroModalConfig.default_collection"
                v-model="zoteroSetAsDefault"
                :disabled="isPushingZotero"
                :size="18"
                class="option-checkbox-row default-sync-row"
              >
                <span class="checkbox-text">将所选分类保存为我的默认分类</span>
              </ThinHoundCheckbox>
            </div>
          </div>

          <div v-if="zoteroPushSuccess" class="success-message">
            <AppIcon name="check" :size="16" />
            <span>已成功推送到 Zotero！已附带学术元数据与中文译本笔记</span>
          </div>

          <p v-if="zoteroPushError" class="inline-error" role="alert">{{ zoteroPushError }}</p>

          <div class="form-actions modal-actions">
            <button
              type="button"
              class="button secondary"
              title="导出 RIS 格式并唤起本地 Zotero 导入"
              @click="handleExportRis(zoteroModalPaper)"
            >
              <AppIcon name="download" :size="14" />
              <span>下载 RIS 导入</span>
            </button>
            <button
              type="button"
              class="button secondary"
              :disabled="isPushingZotero"
              @click="closeZoteroModal"
            >
              取消
            </button>
            <button
              type="button"
              class="button primary"
              :disabled="isPushingZotero || zoteroPushSuccess"
              @click="handlePushToZotero"
            >
              <AppIcon v-if="isPushingZotero" name="refresh" class="spin-icon" :size="14" />
              <span>{{ isPushingZotero ? '推送中…' : '推送到 Zotero' }}</span>
            </button>
          </div>
        </div>

        <!-- 未配置 Zotero API -->
        <div v-else class="zotero-unconfigured-flow">
          <div class="unconfigured-guide-card">
            <h4>您尚未绑定 Zotero 云端 API 凭证</h4>
            <p class="muted">
              绑定后可直接从网页将文献、官方 PDF 链接、推荐理由及精校中文翻译一键推送至您的 Zotero 云端文献库；若暂不绑定，您也可直接下载标准 RIS 引文文件唤起本地 Zotero 导入。
            </p>
          </div>

          <div class="unconfigured-action-boxes">
            <div class="action-box">
              <div class="box-header">
                <strong>免配置快速导入</strong>
                <span class="badge">即刻可用</span>
              </div>
              <p class="box-desc">下载包含作者、摘要、PDF 链接与中文翻译的 .ris 格式引文，直接唤起本地已安装的 Zotero 打开导入。</p>
              <button
                type="button"
                class="button primary"
                @click="handleExportRis(zoteroModalPaper)"
              >
                <AppIcon name="download" :size="14" />
                <span>立即下载 RIS 并导入</span>
              </button>
            </div>

            <div class="action-box">
              <div class="box-header">
                <strong>绑定 Zotero Web API</strong>
                <span class="badge blue">推荐</span>
              </div>
              <p class="box-desc">在个人账户设置中一次性输入 User ID 与 API Key，即可实现跨设备、多目录无缝云端直推。</p>
              <button
                type="button"
                class="button secondary"
                @click="goToZoteroSettings"
              >
                <span>前往账户设置绑定</span>
                <AppIcon name="arrow-up-right" :size="14" />
              </button>
            </div>
          </div>

          <div class="form-actions modal-actions" style="margin-top: 16px;">
            <button
              type="button"
              class="button secondary"
              @click="closeZoteroModal"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </BaseDialog>
  </main>
</template>

<script setup>
import JournalPaperForm from '../components/JournalPaperForm.vue'
import PaperChatBox from '../components/PaperChatBox.vue'
import PaperAuthors from '../components/PaperAuthors.vue'
import { renderLatex } from '../utils/latex'
import { renderMarkdown } from '../utils/markdown'
import { paperLabel, paperSource, paperRead, paperReadLabel, extractAllArxivIds } from '../utils/papers'
import FavoriteButton from '../components/FavoriteButton.vue'
import SmartMothButton from '../components/SmartMothButton.vue'
import SilentLizardButton from '../components/SilentLizardButton.vue'
import SpottyHorseButton from '../components/SpottyHorseButton.vue'
import WaveInput from '../components/WaveInput.vue'
import TallSwanToggle from '../components/TallSwanToggle.vue'
import SmartEmuDelete from '../components/SmartEmuDelete.vue'
import MightyWarthogBookmark from '../components/MightyWarthogBookmark.vue'
import ThinHoundCheckbox from '../components/ThinHoundCheckbox.vue'
import PopularPumaLikeButton from '../components/PopularPumaLikeButton.vue'
import { onMounted, onBeforeUnmount, onActivated, ref, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { arxivApi, authApi, seminarApi, zoteroApi } from '../api/client'
import { generatePaperRis, downloadRisFile } from '../utils/risExport'
import { calculateArxivUnread, broadcastArxivUnread, refreshArxivUnread, clearArxivUnread, markArxivFeedViewed } from '../utils/arxivUnread'
import { formatRecommendDate } from '../utils/date'
import BaseDialog from '../components/BaseDialog.vue'
import RecommendationAudience from '../components/RecommendationAudience.vue'
import ZoteroCollectionTree from '../components/ZoteroCollectionTree.vue'
import SlidingSegmented from '../components/SlidingSegmented.vue'
import AppIcon from '../components/AppIcon.vue'
import LoadingState from '../components/LoadingState.vue'
import SpotlightCard from '../components/bits/SpotlightCard.vue'
import { confirmAction, notify } from '../composables/feedback'
import {
  isAiAssistantReady,
  loadPaperTranslations,
  savePaperTranslation,
  translatePaperWithAi
} from '../services/aiService'

const confirm = ({ title, message, confirmText, tone }) => confirmAction(message, { title, confirmLabel: confirmText, danger: tone === 'danger' })
const scopes = [{ id: 'all', label: '全部可见' }, { id: 'public', label: '公共推荐' }, { id: 'received', label: '推荐给我的' }, { id: 'sent', label: '我发出的' }, { id: 'teacher', label: '导师推荐' }, { id: 'unread', label: '未读' }]
const editingPaper = ref(null), editAudience = ref({ visibility: 'public', recipient_ids: [] }), editComment = ref(''), savingVisibility = ref(false), visibilityError = ref('')
const audience = ref({ visibility: 'public', recipient_ids: [] })
const scope = ref('all'), feed = ref([]), loading = ref(false), loadError = ref(''), showInput = ref(false)
const inputUrlOrId = ref(''), previewing = ref(false), previewError = ref(''), previewData = ref(null), recommendComment = ref(''), submitting = ref(false), expandedAbstracts = ref({}), expandedAuthors = ref({}), currentUser = ref(null)

// 选为组会分享状态
const linkingPaper = ref(null)
const extraArxivInput = ref('')
const loadingUpcoming = ref(false)
const upcomingPresentations = ref([])
const selectedPresentationId = ref(null)
const linkMode = ref('append')
const shareToFeed = ref(true)
const linkComment = ref('')
const isSubmittingLink = ref(false)
const linkError = ref('')
const duplicateCheckResult = ref(null)
const isCheckingDuplicate = ref(false)

const currentSelectedSlot = computed(() => {
  if (!selectedPresentationId.value) return null
  return upcomingPresentations.value.find(p => p.presentation_id === selectedPresentationId.value) || null
})

const allPapersToLinkList = computed(() => {
  if (!linkingPaper.value?.arxiv_id) return []
  const baseId = linkingPaper.value.arxiv_id.replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim()
  const extra = extractAllArxivIds(extraArxivInput.value || '')
  const set = new Set([baseId.toLowerCase()])
  const res = [baseId]
  for (const e of extra) {
    const clean = e.replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim()
    if (!set.has(clean.toLowerCase())) {
      set.add(clean.toLowerCase())
      res.push(clean)
    }
  }
  return res
})

const allPapersToLinkCount = computed(() => allPapersToLinkList.value.length)

function updateLinkDefaultComment() {
  const current = upcomingPresentations.value.find(p => p.presentation_id === selectedPresentationId.value)
  if (current) {
    linkComment.value = `预定于 ${current.date} 组会进行文献分享汇报`
  }
}

async function checkDuplicateForSlot(arxivId, targetSeminarId) {
  if (!arxivId) return
  isCheckingDuplicate.value = true
  duplicateCheckResult.value = null
  try {
    const res = await seminarApi.checkArxivPresented(arxivId, targetSeminarId)
    duplicateCheckResult.value = res.data
  } catch (err) {
    console.warn('Duplicate check error:', err)
  } finally {
    isCheckingDuplicate.value = false
  }
}

const myUpcomingArxivSet = ref(new Set())

async function loadMyUpcomingArxivIds() {
  if (!currentUser.value) return
  try {
    const res = await seminarApi.getMyUpcomingPresentations(false)
    const list = Array.isArray(res) ? res : (res?.data || [])
    const idSet = new Set()
    for (const p of list) {
      const ids = p.papers && p.papers.length > 0 ? p.papers : extractAllArxivIds(p.arxiv_id || '')
      for (const id of ids) {
        idSet.add(String(id).replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase())
      }
    }
    myUpcomingArxivSet.value = idSet
  } catch (err) {
    console.warn('Failed to load upcoming seminar arxiv ids:', err)
  }
}

function isMySeminarShare(paper) {
  if (!paper) return false
  const user = currentUser.value
  if (!user) return false

  const recommenderId = paper.recommender?.id || paper.recommended_by_id
  const userNames = [user.name, user.real_name, user.nickname].filter(Boolean).map(s => String(s).trim().toLowerCase())
  const recName = (paper.recommender?.real_name || paper.recommender?.name || '').trim().toLowerCase()
  const isRecommenderMe = (recommenderId && recommenderId === user.id) || (recName && userNames.includes(recName))

  // 1. 如果该文献推荐卡片直接关联了组会且推荐人是自己
  if (Boolean(paper.seminar_id) && isRecommenderMe) {
    return true
  }

  // 2. 如果包含组会分享标记且推荐人是自己
  const comment = String(paper.recommend_comment || '')
  if (comment.includes('组会 arXiv 分享') && isRecommenderMe) {
    return true
  }

  // 3. 如果该文献的 arXiv 编号已被包含在当前用户未来的组会排期中
  if (paper.arxiv_id) {
    const cleanId = String(paper.arxiv_id).replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase()
    if (myUpcomingArxivSet.value.has(cleanId)) {
      return true
    }
  }

  return false
}

async function openLinkToSeminarModal(paper) {
  if (isMySeminarShare(paper)) return
  linkingPaper.value = paper
  extraArxivInput.value = ''
  linkError.value = ''
  duplicateCheckResult.value = null
  linkMode.value = 'append'
  shareToFeed.value = true
  selectedPresentationId.value = null
  upcomingPresentations.value = []
  loadingUpcoming.value = true
  try {
    const res = await seminarApi.getMyUpcomingPresentations(false)
    const list = Array.isArray(res) ? res : (res?.data || [])
    upcomingPresentations.value = list
    if (upcomingPresentations.value.length > 0) {
      selectedPresentationId.value = upcomingPresentations.value[0].presentation_id
      updateLinkDefaultComment()
      checkDuplicateForSlot(paper.arxiv_id, upcomingPresentations.value[0].seminar_id)
    }
  } catch (err) {
    console.error('Failed to load upcoming presentations:', err)
    linkError.value = '获取您的未来组会排期失败，请稍后重试'
  } finally {
    loadingUpcoming.value = false
  }
}

function onSelectedPresentationChange() {
  updateLinkDefaultComment()
  const current = upcomingPresentations.value.find(p => p.presentation_id === selectedPresentationId.value)
  if (current && linkingPaper.value) {
    const allIds = allPapersToLinkList.value.join(', ')
    checkDuplicateForSlot(allIds, current.seminar_id)
  }
}

function onExtraArxivChange() {
  if (!linkingPaper.value) return
  const current = upcomingPresentations.value.find(p => p.presentation_id === selectedPresentationId.value)
  const currentSeminarId = current ? current.seminar_id : null
  const allIds = allPapersToLinkList.value.join(', ')
  checkDuplicateForSlot(allIds, currentSeminarId)
}

async function handleConfirmLinkSeminar() {
  if (!selectedPresentationId.value || !linkingPaper.value) return
  const current = upcomingPresentations.value.find(p => p.presentation_id === selectedPresentationId.value)
  if (!current) return

  const allArxivStr = allPapersToLinkList.value.join(', ')

  if (duplicateCheckResult.value?.presented) {
    const paperTitle = duplicateCheckResult.value.paper?.title || duplicateCheckResult.value.paper?.arxiv_id || '往期记录'
    const ok = await confirm({
      title: '组会查重提醒',
      message: `文献在往期组会中已进行过分享（${paperTitle}）。确定要再次将其作为本次组会的分享文献吗？`,
      confirmText: '确定继续关联',
      tone: 'danger'
    })
    if (!ok) return
  }

  isSubmittingLink.value = true
  linkError.value = ''
  try {
    await seminarApi.linkPaperToPresentation({
      seminar_id: current.seminar_id,
      presentation_id: current.presentation_id,
      arxiv_id: allArxivStr,
      mode: linkMode.value,
      share_to_feed: shareToFeed.value,
      recommend_comment: linkComment.value
    })
    notify(`已成功将 ${allPapersToLinkCount.value} 篇文献关联至组会分享并在推荐流发布！`)
    for (const aid of allPapersToLinkList.value) {
      const clean = String(aid).replace(/^arXiv:/i, '').replace(/v\d+$/, '').trim().toLowerCase()
      myUpcomingArxivSet.value.add(clean)
    }
    linkingPaper.value = null
    extraArxivInput.value = ''
    await loadFeed()
    window.dispatchEvent(new CustomEvent('arxiv-feed-updated'))
  } catch (err) {
    console.error('Link to seminar failed:', err)
    linkError.value = err.response?.data?.detail || err.message || '关联至组会失败，请重试'
  } finally {
    isSubmittingLink.value = false
  }
}

// Zotero 云端直推与本地 RIS 导出状态
const zoteroModalOpen = ref(false)
const zoteroModalPaper = ref(null)
const zoteroModalConfig = ref({ configured: false, user_id: '', default_collection: '', has_api_key: false })
const zoteroModalCollections = ref([])
const zoteroSelectedCollection = ref('')
const zoteroIncludePdf = ref(false)
const zoteroIncludeTranslation = ref(true)
const zoteroIncludeComment = ref(true)
const zoteroCustomNote = ref('')
const zoteroTagsInput = ref('')
const zoteroSetAsDefault = ref(false)
const isPushingZotero = ref(false)
const isLoadingZoteroModal = ref(false)
const zoteroPushSuccess = ref(false)
const zoteroPushError = ref('')
const zoteroPushedKeys = ref(new Set())

async function openZoteroPushModal(paper) {
  zoteroModalPaper.value = paper
  zoteroPushSuccess.value = false
  zoteroPushError.value = ''
  zoteroCustomNote.value = ''
  zoteroTagsInput.value = ''
  zoteroSetAsDefault.value = false
  zoteroIncludePdf.value = false
  zoteroIncludeTranslation.value = true
  zoteroIncludeComment.value = true
  zoteroModalOpen.value = true
  isLoadingZoteroModal.value = true

  try {
    const config = await zoteroApi.getConfig()
    zoteroModalConfig.value = config || { configured: false }
    zoteroSelectedCollection.value = config?.default_collection || ''
    if (config?.configured) {
      try {
        const collections = await zoteroApi.getCollections()
        zoteroModalCollections.value = Array.isArray(collections) ? collections : []
      } catch (colErr) {
        console.warn('获取 Zotero 目录失败:', colErr)
        zoteroModalCollections.value = []
      }
    }
  } catch (err) {
    console.error('获取 Zotero 配置失败:', err)
    zoteroModalConfig.value = { configured: false }
  } finally {
    isLoadingZoteroModal.value = false
  }
}

function closeZoteroModal() {
  if (isPushingZotero.value) return
  zoteroModalOpen.value = false
  zoteroModalPaper.value = null
  zoteroPushSuccess.value = false
  zoteroPushError.value = ''
}

function goToZoteroSettings() {
  closeZoteroModal()
  router.push('/account#section-zotero')
}

function handleExportRis(paper) {
  if (!paper) return
  const translation = getPaperTranslation(paper)
  downloadRisFile(paper, translation)
  notify('已下载标准 RIS 格式引文，正在唤起本地 Zotero 导入…')
  if (zoteroModalOpen.value) {
    closeZoteroModal()
  }
}

async function handlePushToZotero() {
  const paper = zoteroModalPaper.value
  if (!paper) return
  if (!zoteroModalConfig.value?.configured) {
    handleExportRis(paper)
    return
  }

  isPushingZotero.value = true
  zoteroPushError.value = ''
  zoteroPushSuccess.value = false

  try {
    const translation = zoteroIncludeTranslation.value ? getPaperTranslation(paper) : null
    await zoteroApi.pushPaper({
      arxiv_id: paper.arxiv_id,
      title: paper.title,
      authors: paper.authors,
      abstract: paper.abstract,
      published: paper.published,
      published_date: paper.published_date || paper.published,
      journal: paper.journal,
      doi: paper.doi,
      collection_key: zoteroSelectedCollection.value || undefined,
      include_pdf: zoteroIncludePdf.value,
      include_translation: zoteroIncludeTranslation.value,
      include_comment: zoteroIncludeComment.value,
      recommend_comment: paper.recommend_comment,
      recommender_name: paper.recommender?.real_name || paper.recommender?.name || '',
      custom_note: zoteroCustomNote.value.trim() || undefined,
      tags: zoteroTagsInput.value.trim() || undefined,
      translation,
      set_as_default_collection: zoteroSetAsDefault.value
    })

    zoteroPushSuccess.value = true
    zoteroPushedKeys.value.add(getPaperKey(paper))
    if (zoteroSetAsDefault.value && zoteroModalConfig.value) {
      zoteroModalConfig.value.default_collection = zoteroSelectedCollection.value
    }
    notify('已成功推送到 Zotero 云端文献库！')
    setTimeout(() => {
      if (zoteroModalOpen.value) {
        closeZoteroModal()
      }
    }, 1200)
  } catch (err) {
    zoteroPushError.value = err.message || '推送到 Zotero 失败，请检查网络或在账户设置中验证 API Key 权限'
    notify(zoteroPushError.value, 'error')
  } finally {
    isPushingZotero.value = false
  }
}

const visibleFeed = computed(() => {
  const user = currentUser.value
  if (!user) return feed.value
  return feed.value.filter((paper) => {
    if (paper.visibility === 'direct') {
      const isRecommender = (paper.recommender?.id || paper.recommended_by_id) === user.id
      const isRecipient = Array.isArray(paper.recipients) && paper.recipients.some((r) => r.id === user.id)
      return isRecommender || isRecipient
    }
    return true
  })
})

// AI 翻译与多语言卡片翻转状态
const isAiReady = ref(false)
const paperTranslations = ref(loadPaperTranslations())
const paperLangState = ref({})
const translatingIds = ref(new Set())

function checkAiReady() {
  isAiReady.value = isAiAssistantReady()
}

function getPaperKey(paper) {
  if (!paper) return ''
  return String(paper.arxiv_id || paper.doi || paper.id)
}

function getPaperTranslation(paper) {
  if (paper?.title_zh && paper?.abstract_zh) {
    return {
      title: paper.title_zh,
      abstract: paper.abstract_zh
    }
  }
  const key = getPaperKey(paper)
  return paperTranslations.value[key] || null
}

function isChineseView(paper) {
  const key = getPaperKey(paper)
  if (paperLangState.value[key] !== undefined) {
    return paperLangState.value[key] === 'zh'
  }
  return Boolean(getPaperTranslation(paper))
}

function togglePaperLang(paper) {
  const key = getPaperKey(paper)
  const current = isChineseView(paper)
  paperLangState.value[key] = current ? 'en' : 'zh'
}

async function handleTranslatePaper(paper, isRetranslate = false) {
  const key = getPaperKey(paper)
  if (translatingIds.value.has(key)) return
  if (!isAiReady.value) {
    notify('该文献尚未翻译。请先在「AI 科研助手」中配置大模型，即可一键翻译并与全组成员共享。', 'info')
    return
  }
  translatingIds.value.add(key)
  try {
    const result = await translatePaperWithAi({
      title: paper.title,
      abstract: paper.abstract
    })
    try {
      await arxivApi.saveTranslation(paper.id, {
        title_zh: result.title,
        abstract_zh: result.abstract
      })
    } catch (saveErr) {
      console.warn('同步共享翻译到后端失败:', saveErr)
    }
    paper.title_zh = result.title
    paper.abstract_zh = result.abstract
    savePaperTranslation(key, result)
    paperTranslations.value[key] = result
    paperLangState.value[key] = 'zh'
    if (isRetranslate) {
      notify('管理员已成功重新翻译，并更新全组共享译本！', 'success')
    } else {
      notify('文献已成功翻译，并同步为全组共享译本！', 'success')
    }
  } catch (err) {
    notify(`翻译失败: ${err.message || '大模型请求异常'}`, 'error')
  } finally {
    translatingIds.value.delete(key)
  }
}

function handleDiscussWithAi(paper) {
  if (!paper || !paper.arxiv_id) return
  const rawId = paper.arxiv_id
  const payload = {
    arxivId: rawId,
    title: paper.title || '',
    authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : (paper.authors || ''),
    abstract: paper.abstract || ''
  }
  try {
    sessionStorage.setItem('labhub_pending_discuss_paper', JSON.stringify(payload))
    sessionStorage.setItem('csbd_pending_discuss_paper', JSON.stringify(payload))
  } catch (_) {}
  router.push({
    path: '/assistant',
    query: { tab: 'arxiv', paperId: rawId, discussArxiv: rawId }
  })
}

onMounted(() => {
  clearArxivUnread()
  checkAiReady()
  loadFeed()
  loadMyUpcomingArxivIds().catch(() => {})
  checkRouteShareId()
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', checkAiReady)
    window.addEventListener('focus', checkAiReady)
    window.addEventListener('labhub-ai-config-changed', checkAiReady)
    window.addEventListener('csbd-ai-config-changed', checkAiReady)
  }
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', checkAiReady)
    window.removeEventListener('focus', checkAiReady)
    window.removeEventListener('labhub-ai-config-changed', checkAiReady)
    window.removeEventListener('csbd-ai-config-changed', checkAiReady)
  }
})

onActivated(() => {
  clearArxivUnread()
  checkAiReady()
  loadMyUpcomingArxivIds().catch(() => {})
  checkRouteShareId()
})
let feedRequest = 0
const loadFeed = async () => {
  const request = ++feedRequest, requestedScope = scope.value
  loading.value = true; loadError.value = ''
  try {
    const [user, data] = await Promise.all([authApi.getMe(), arxivApi.getFeed(requestedScope)])
    if (request !== feedRequest) return
    currentUser.value = user
    localStorage.setItem('labhub_user', JSON.stringify(user))
    localStorage.setItem('cssbd_user', JSON.stringify(user))
    loadMyUpcomingArxivIds().catch(() => {})

    // 进入文献推荐流时，记录最新浏览进度并清除新文献提示气泡（不强制更改单篇文献的真实已读状态）
    markArxivFeedViewed().catch(() => {})

    // An old backend silently ignores newer scopes. Never label its full feed as "sent".
    if (requestedScope === 'sent' && data.some(paper => (paper.recommender?.id || paper.recommended_by_id) !== user.id)) {
      feed.value = []
      throw new Error('后端未正确处理“我发出的”筛选，请重启后端服务至当前版本后重试。')
    }
    // Defense-in-depth: filter out any direct recommendation where user is neither recommender nor recipient
    feed.value = (data || []).map((paper) => {
      return {
        ...paper,
        is_read_by_me: Boolean(paper.is_read_by_me)
      }
    }).filter((paper) => {
      if (paper.visibility === 'direct') {
        const isRecommender = (paper.recommender?.id || paper.recommended_by_id) === user.id
        const isRecipient = Array.isArray(paper.recipients) && paper.recipients.some((r) => r.id === user.id)
        return isRecommender || isRecipient
      }
      return true
    })
    checkRouteHighlight()
  } catch (error) {
    if (request === feedRequest) { feed.value = []; loadError.value = error.message || '请检查连接后重试。' }
  } finally { if (request === feedRequest) loading.value = false }
}
const changeScope = (next) => { scope.value = next; loadFeed() }
const handlePreview = async () => {
  previewing.value = true
  previewError.value = ''
  previewData.value = null
  try {
    previewData.value = await arxivApi.preview(inputUrlOrId.value.trim())
  } catch (error) {
    previewError.value = error.message
  } finally {
    previewing.value = false
  }
}
const removeBatchPaper = (pIdx) => {
  if (!previewData.value?.papers) return
  previewData.value.papers.splice(pIdx, 1)
  if (previewData.value.papers.length === 1) {
    const single = previewData.value.papers[0]
    previewData.value = { ...single, is_batch: false, papers: [single] }
  }
}
const handleSubmitRecommend = async () => {
  if (!previewData.value) return
  submitting.value = true
  try {
    const papersToSubmit = (previewData.value.is_batch && Array.isArray(previewData.value.papers) && previewData.value.papers.length > 0)
      ? [...previewData.value.papers]
      : [previewData.value]
    for (const paper of papersToSubmit) {
      await arxivApi.recommend({
        ...paper,
        ...audience.value,
        recommend_comment: recommendComment.value,
        is_pinned: false
      })
    }
    const count = papersToSubmit.length
    inputUrlOrId.value = ''
    previewData.value = null
    recommendComment.value = ''
    showInput.value = false
    scope.value = audience.value.visibility === 'direct' ? 'sent' : 'public'
    audience.value = { visibility: 'public', recipient_ids: [] }
    await loadFeed()
    refreshArxivUnread()
    notify(count > 1 ? `已成功将 ${count} 篇文献分别发布到推荐流` : '文献已发布到推荐流', 'success')
  } catch (error) {
    notify(error.message, 'error')
  } finally {
    submitting.value = false
  }
}
const readPending = new Set()
const handleToggleRead = async (paper) => {
  if (!paper || readPending.has(paper.id)) return
  readPending.add(paper.id)
  const prevRead = Boolean(paper.is_read_by_me)
  paper.is_read_by_me = !prevRead
  try {
    const result = await arxivApi.toggleRead(paper.id)
    paper.is_read_by_me = result.is_read
  } catch (error) {
    paper.is_read_by_me = prevRead
    notify(error.message || '标记已读失败', 'error')
  } finally {
    readPending.delete(paper.id)
  }
}

const likePending = new Set()
const handleToggleLike = async (paper) => {
  if (!paper || likePending.has(paper.id)) return
  likePending.add(paper.id)
  const prevLiked = Boolean(paper.is_liked_by_me)
  const prevCount = Number(paper.like_count) || 0
  const nextLiked = !prevLiked
  const nextCount = nextLiked ? prevCount + 1 : Math.max(0, prevCount - 1)
  paper.is_liked_by_me = nextLiked
  paper.like_count = nextCount
  try {
    const result = await arxivApi.toggleLike(paper.id)
    paper.is_liked_by_me = result.is_liked
    paper.like_count = result.like_count
  } catch (error) {
    paper.is_liked_by_me = prevLiked
    paper.like_count = prevCount
    notify(error.message || '点赞操作失败', 'error')
  } finally {
    likePending.delete(paper.id)
  }
}
const handleDelete = async (paper) => {
  if (!await confirm({ title: '移除文献', message: `从推荐流移除「${paper.title}」？`, confirmText: '移除', tone: 'danger' })) return;
  try {
    await arxivApi.deletePaper(paper.id);
    feed.value = feed.value.filter((item) => item.id !== paper.id);
    const summary = calculateArxivUnread(feed.value, currentUser.value?.id)
    broadcastArxivUnread(summary)
    refreshArxivUnread()
    notify('文献已移除', 'success')
  } catch (error) {
    notify(error.message, 'error')
  }
}
function editVisibility(paper) {
  editingPaper.value = paper
  editAudience.value = { visibility: paper.visibility, recipient_ids: (paper.recipients || []).map(u => u.id) }
  editComment.value = paper.recommend_comment || ''
  visibilityError.value = ''
}
async function saveVisibility() {
  if (!editingPaper.value || (editAudience.value.visibility === 'direct' && !editAudience.value.recipient_ids.length)) return
  savingVisibility.value = true; visibilityError.value = ''
  try {
    const updated = await arxivApi.updateVisibility(editingPaper.value.id, {
      ...editAudience.value,
      recommend_comment: editComment.value
    })
    feed.value = feed.value.map(p => p.id === updated.id ? updated : p)
    editingPaper.value = null
    notify('推荐内容已更新', 'success')
  } catch (error) { visibilityError.value = error.message }
  finally { savingVisibility.value = false }
}
const toggleAbstract = (id) => { expandedAbstracts.value[id] = !expandedAbstracts.value[id] }
const canDelete = (paper) => {
  if (!currentUser.value || !paper) return false
  const isOwner = currentUser.value.id === (paper.recommender?.id || paper.recommended_by_id)
  if (paper.visibility === 'direct') {
    return isOwner
  }
  return isOwner || currentUser.value.role === 'admin'
}

function onCommentAdded(paper, comment) {
  if (!comment || !comment.id) return
  if (!Array.isArray(paper.comments)) {
    paper.comments = []
  }
  if (!paper.comments.some(c => c.id === comment.id)) {
    paper.comments.push(comment)
  }
}

function onCommentDeleted(paper, commentId) {
  if (Array.isArray(paper.comments)) {
    paper.comments = paper.comments.filter(c => c.id !== commentId)
  }
}

const router = useRouter()
const route = useRoute()
const highlightedPaperId = ref(null)

function checkRouteHighlight() {
  const targetId = route.query.paper_id ? Number(route.query.paper_id) : null
  const targetArxiv = route.query.arxiv_id ? String(route.query.arxiv_id).trim() : null
  if (!targetId && !targetArxiv) return

  const targetPaper = feed.value.find(p => {
    if (targetId && p.id === targetId) return true
    if (targetArxiv) {
      const cleanTarget = targetArxiv.replace(/^arxiv:/i, '').replace(/v\d+$/, '').toLowerCase()
      const cleanPaperArxiv = String(p.arxiv_id || '').replace(/^arxiv:/i, '').replace(/v\d+$/, '').toLowerCase()
      if (cleanTarget && cleanPaperArxiv && cleanTarget === cleanPaperArxiv) return true
    }
    return false
  })

  if (!targetPaper) {
    if (scope.value !== 'all') {
      scope.value = 'all'
      loadFeed()
    }
    return
  }

  expandedAbstracts.value[targetPaper.id] = true
  highlightedPaperId.value = targetPaper.id

  nextTick(() => {
    setTimeout(() => {
      const el = document.getElementById(`paper-${targetPaper.id}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 150)
  })

  setTimeout(() => {
    if (highlightedPaperId.value === targetPaper.id) {
      highlightedPaperId.value = null
    }
  }, 4500)
}

function checkRouteShareId() {
  const shareId = route.query.share_id ? String(route.query.share_id).trim() : ''
  if (!shareId) return
  showInput.value = true
  inputUrlOrId.value = shareId
  nextTick(() => {
    handlePreview()
  })
}

watch(() => [route.query.paper_id, route.query.arxiv_id, route.query.share_id], () => {
  checkRouteHighlight()
  checkRouteShareId()
})

function goToSeminar(seminarId) {
  if (!seminarId) return
  router.push({
    path: '/seminars',
    query: {
      view: 'timeline',
      target_seminar: String(seminarId),
      no_reset: '1'
    }
  })
}

function handleRecommendBodyClick(paper, event) {
  if (!paper?.seminar_id) return
  if (event?.target?.closest('a, button, input, textarea, select, .inline-edit-btn')) return
  goToSeminar(paper.seminar_id)
}
</script>

<style scoped>
.visibility-help { font-size:12px; line-height:1.8; }.visibility-edit { height: 30px; border-radius: 9999px; font-size: 11.5px; padding: 0 10px; flex-shrink: 0; white-space: nowrap; }.count-label { white-space:nowrap; flex-shrink:0; }.audience-line { margin-top:10px; color:var(--accent); font-size:12px; }.feed-toolbar .segmented { flex-wrap:wrap; }.feed-toolbar { align-items:flex-start; }.paper-meta .badge { width:max-content; }

.page-shell { max-width: 1080px; margin: auto; padding: 42px 28px 100px; }.page-heading, .panel-heading, .feed-toolbar, .inline-actions, .paper-row, .paper-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }.eyebrow, .data-label, .count-label, .paper-meta { color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }.page-heading h1 { margin: 5px 0 8px; font-size: clamp(28px, 4vw, 42px); letter-spacing: -.04em; }.page-heading p:not(.eyebrow), .panel-heading p, .empty-state p { margin: 0; color: var(--muted); font-size: 14px; }.recommend-panel { display: block; margin-top: 28px; padding: 22px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); }
.panel-heading h2 { margin: 0; font-size: 16px; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; }
.expandable-panel { overflow: hidden; }
.recommend-form { display: grid; grid-template-columns: 1fr auto; gap: 14px; align-items: center; margin-top: 18px; }
.recommend-form :deep(.form-control) {
  margin: 10px 0 6px !important;
}

.expand-spring-enter-active {
  transition: all 0.55s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-origin: top center;
}
.expand-spring-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top center;
}
.expand-spring-enter-from {
  opacity: 0;
  transform: translateY(-22px) scale(0.96);
  max-height: 0;
}
.expand-spring-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 400px;
}
.expand-spring-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
  max-height: 400px;
}
.expand-spring-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.96);
  max-height: 0;
}
.preview-card { display: grid; gap: 14px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.preview-card h3, .paper-main h2 { margin: 7px 0; font-family: var(--font); font-size: 18px; line-height: 1.4; }
.preview-card p, .authors { margin: 0; color: var(--muted); font-size: 12px; }
.batch-preview-container { display: flex; flex-direction: column; gap: 12px; }
.batch-preview-header { display: flex; flex-direction: column; gap: 6px; }
.batch-preview-hint { margin: 0; color: var(--muted); font-size: 13px; }
.batch-paper-list { display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px; }
.batch-paper-item { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 10px 14px; background: var(--bg-hover, rgba(255, 255, 255, 0.04)); border: 1px solid var(--line); border-radius: 8px; }
.batch-paper-info { flex: 1; min-width: 0; }
.batch-paper-title { margin: 4px 0 2px; font-size: 14px; font-weight: 500; line-height: 1.4; color: var(--fg); }
.batch-paper-authors { margin: 0; font-size: 12px; color: var(--muted); }
.remove-batch-item-btn { background: transparent; border: none; color: var(--muted); cursor: pointer; padding: 4px; border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: color 0.15s, background-color 0.15s; }
.remove-batch-item-btn:hover { color: var(--danger); background: rgba(255, 77, 79, 0.1); }
.inline-error { margin: 12px 0 0; color: var(--danger); font-size: 13px; }
.feed-toolbar { margin: 28px 0 13px; }
.segmented { display: inline-flex; padding: 3px; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); overflow-x: auto; overflow-y: hidden; scrollbar-width: none; -ms-overflow-style: none; }
.segmented::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
.segmented button { padding: 7px 11px; border: 0; border-radius: 6px; background: transparent; color: var(--muted); font-size: 12px; }
.segmented button.active { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.paper-list { display: grid; gap: 10px; }
.paper-row {
  position: relative;
  display: flex;
  align-items: stretch;
  padding: 21px;
  padding-right: 347px;
  min-height: 220px;
  box-sizing: border-box;
  border: 1px solid var(--line);
  border-radius: 13px;
  background: var(--panel);
  transition: border-color .2s ease, box-shadow .2s ease;
  animation: paperRowIn 0.28s ease-out;
}
@keyframes paperRowIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.paper-row:hover {
  border-color: color-mix(in srgb, var(--accent) 42%, var(--line));
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
}
.paper-row.featured { border-left: 3px solid var(--accent); }
.paper-row.seminar-today {
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 3.5%, var(--panel));
}
.paper-meta {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 126px;
  flex: 0 0 126px;
  gap: 12px;
}

.paper-meta-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 5px;
}

.paper-meta-info .meta-date,
.paper-meta-info .meta-category {
  font-size: 11px;
  color: var(--muted);
  word-break: break-word;
  line-height: 1.4;
}

/* Compact action dock: brave-shrimp-86 styling with 3-column strict grid */
.paper-meta-actions.paper-action-dock {
  display: grid;
  grid-template-columns: repeat(3, 34px);
  gap: 9px;
  align-items: center;
  justify-content: start;
  margin-top: auto;
  width: 100%;
  padding-top: 8px;
}

.dock-item {
  position: relative;
  display: inline-flex;
  justify-content: center;
  align-items: center;
}

/* Base button: soft boundary, naturally embedded */
.dock-btn,
.paper-meta .discuss-ai-btn,
.paper-meta .zotero-push-btn,
.paper-meta .link-seminar-btn,
.paper-meta .translate-action-btn,
.paper-meta .translate-flip-btn,
.paper-meta .retranslate-action-btn,
.paper-meta .pdf-link,
.paper-meta .seminar-linked-status,
.discuss-ai-btn,
.retranslate-action-btn,
.translate-action-btn,
.link-seminar-btn,
.zotero-push-btn,
.pdf-link,
.seminar-linked-status {
  position: relative;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--text) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text) 7%, transparent);
  color: var(--muted, #94a3b8);
  cursor: pointer;
  padding: 0;
  margin: 0;
  box-sizing: border-box;
  box-shadow: none;
  outline: none;
  transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Micro-interaction filled background layer sliding up */
.dock-btn .filled,
.paper-meta-actions .button .filled,
.paper-meta-actions .pdf-link .filled {
  position: absolute;
  top: auto;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0;
  background-color: var(--dock-theme-color, #3b82f6);
  border-radius: 50%;
  transition: height 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  z-index: 1;
  pointer-events: none;
}

.dock-item:hover .filled {
  height: 100%;
}

.dock-item:hover .dock-btn,
.dock-item:hover .pdf-link,
.dock-item:hover .discuss-ai-btn,
.dock-item:hover .translate-flip-btn,
.dock-item:hover .translate-action-btn,
.dock-item:hover .retranslate-action-btn,
.dock-item:hover .link-seminar-btn,
.dock-item:hover .zotero-push-btn {
  color: #ffffff;
  border-color: var(--dock-theme-color);
  box-shadow: 0 4px 14px var(--dock-glow-color, rgba(0, 0, 0, 0.25));
  transform: translateY(-2px);
}

.dock-svg {
  position: relative;
  z-index: 2;
  display: block;
  flex-shrink: 0;
  transition: transform 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.dock-item:hover .dock-svg {
  transform: scale(1.08);
}

.zotero-img {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

/* Tooltip design from brave-shrimp-86 */
.dock-item .tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%) translateY(4px) scale(0.9);
  background: var(--dock-theme-color, #0f172a);
  color: #ffffff;
  font-size: 11px;
  font-weight: 500;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
  opacity: 0;
  pointer-events: none;
  white-space: nowrap;
  transition: all 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  z-index: 100;
}

.dock-item .tooltip::before {
  position: absolute;
  content: "";
  height: 6px;
  width: 6px;
  background: var(--dock-theme-color, #0f172a);
  bottom: -3px;
  left: 50%;
  transform: translate(-50%) rotate(45deg);
}

.dock-item:hover .tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(-50%) translateY(0) scale(1);
}

/* Theme colors for each action dock item */
.dock-item.pdf {
  --dock-theme-color: #ef4444;
  --dock-glow-color: rgba(239, 68, 68, 0.38);
}

.dock-item.ai-discuss {
  --dock-theme-color: #0284c7;
  --dock-glow-color: rgba(2, 132, 199, 0.38);
}

.dock-item.translate-flip,
.dock-item.translate-init {
  --dock-theme-color: #8b5cf6;
  --dock-glow-color: rgba(139, 92, 246, 0.38);
}

.dock-item.retranslate {
  --dock-theme-color: #d946ef;
  --dock-glow-color: rgba(217, 70, 239, 0.38);
}

.dock-item.seminar-link {
  --dock-theme-color: #10b981;
  --dock-glow-color: rgba(16, 185, 129, 0.38);
}

.dock-item.seminar-shared {
  --dock-theme-color: #10b981;
  --dock-glow-color: rgba(16, 185, 129, 0.3);
  cursor: default;
}

.dock-item.zotero {
  --dock-theme-color: #e11d48;
  --dock-glow-color: rgba(225, 29, 72, 0.38);
}

/* Specific state tweaks */
.dock-item.translate-flip .translate-flip-btn.is-zh {
  color: #c084fc;
  background: rgba(168, 85, 247, 0.08);
  border-color: rgba(168, 85, 247, 0.22);
}

.dock-item.zotero .zotero-push-btn.is-pushed {
  color: #fb7185;
  background: rgba(225, 29, 72, 0.08);
  border-color: rgba(225, 29, 72, 0.22);
}

/* Seminar shared status: same icon as seminar link, non-clickable, green color */
.dock-item.seminar-shared .seminar-linked-status,
.paper-meta .seminar-linked-status.is-linked,
.seminar-linked-status.is-linked {
  background: rgba(16, 185, 129, 0.12) !important;
  border: 1px solid rgba(16, 185, 129, 0.3) !important;
  color: #10b981 !important;
  cursor: default !important;
  pointer-events: none;
  box-shadow: none !important;
  transform: none !important;
}

.dock-item.seminar-shared:hover .seminar-linked-status {
  background: rgba(16, 185, 129, 0.2) !important;
  border-color: #10b981 !important;
  box-shadow: 0 2px 10px rgba(16, 185, 129, 0.25) !important;
}

.translation-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  padding: 1px 8px;
  border-radius: 999px;
  margin-top: 4px;
  margin-bottom: 8px;
  width: fit-content;
}

.paper-flip-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.25s ease;
  transform-origin: center center;
}

.paper-flip-leave-active {
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.15s ease;
  transform-origin: center center;
}

.paper-flip-enter-from {
  opacity: 0;
  transform: rotateX(-65deg) scale(0.97);
}

.paper-flip-leave-to {
  opacity: 0;
  transform: rotateX(65deg) scale(0.97);
}

.spin-icon {
  animation: spinRotate 1s linear infinite;
}

@keyframes spinRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.priority-label { color: var(--accent); }
.priority-label.seminar-priority {
  color: var(--accent);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.paper-main { min-width: 0; flex: 1; }
.paper-main a { color: var(--text); text-decoration: none; }
.recommendation {
  margin: 12px 0;
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 4%, transparent);
  border-radius: 0 8px 8px 0;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.6;
}
.recommend-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}
.recommender-name {
  font-weight: 600;
  color: var(--text);
  font-size: 13px;
}
.seminar-tag-action {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding: 1px 7px;
  border: 1px solid color-mix(in srgb, var(--accent) 35%, var(--line));
  border-radius: 9999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
  vertical-align: middle;
  transition: all 0.15s ease;
  user-select: none;
}
.seminar-tag-action:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  border-color: var(--accent);
}
.recommend-body {
  font-size: 13px;
  color: var(--soft);
}
.clickable-recommend {
  cursor: pointer;
}
.clickable-recommend:hover {
  color: var(--text);
}
.inline-edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
  padding: 1px 7px;
  border: 1px solid var(--line);
  border-radius: 9999px;
  background: color-mix(in srgb, var(--panel) 80%, transparent);
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
  vertical-align: middle;
  transition: all 0.15s ease;
}
.inline-edit-btn:hover {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-color: var(--accent);
}
.recommendation-placeholder {
  margin: 8px 0;
}
.recommendation-placeholder .add-comment-btn {
  font-size: 12px;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.recommendation-placeholder .add-comment-btn:hover {
  color: var(--accent);
}
.edit-recommend-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.comment-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.comment-field .field-label, .audience-section .field-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.comment-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 9px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s ease;
}
.comment-textarea:focus {
  border-color: var(--accent);
}
.recommend-preview {
  padding: 8px 12px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 8%, var(--bg));
  border-left: 3px solid var(--accent);
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.5;
}
.recommend-preview .preview-tag {
  color: var(--accent);
  font-size: 11px;
  font-weight: 500;
  margin-right: 4px;
}
.audience-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.abstract { margin: 12px 0 0; color: var(--muted); font-size: 13px; line-height: 1.65; }
.clamped { display: -webkit-box; overflow: hidden; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.text-action { margin-top: 7px; padding: 0; border: 0; background: transparent; color: var(--accent); font-size: 12px; cursor: pointer; }
.empty-state { display: grid; justify-items: center; gap: 10px; padding: 70px 24px; border: 1px dashed var(--line); border-radius: 14px; color: var(--muted); text-align: center; }
.empty-state h2 { margin: 0; color: var(--text); font-size: 17px; }
.paper-side-rail {
  position: absolute;
  top: 21px;
  bottom: 21px;
  right: 21px;
  width: 310px;
  height: calc(100% - 42px);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 8px;
  overflow: hidden;
  box-sizing: border-box;
}
.paper-side-rail .paper-actions {
  flex: 0 0 auto;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  width: 100%;
}
@media (max-width: 768px) {
  .page-shell { padding: 20px 14px 96px; }
  .page-heading { align-items: flex-start; gap: 12px; }
  .page-heading h1 { font-size: 26px; }
  .page-heading p:not(.eyebrow) { font-size: 13px; }
  .recommend-panel { margin-top: 18px; padding: 16px; border-radius: 12px; }
  .recommend-form { grid-template-columns: 1fr; gap: 10px; }
  
  .feed-toolbar {
    margin: 18px 0 10px;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  .feed-toolbar .segmented {
    display: flex;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    flex-wrap: nowrap;
    padding: 3px;
    gap: 4px;
  }
  .feed-toolbar .segmented::-webkit-scrollbar {
    display: none;
  }
  .feed-toolbar .segmented button {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 12px;
    padding: 6px 12px;
  }
  .feed-toolbar .count-label {
    align-self: flex-end;
    font-size: 11px;
  }

  .paper-row {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px !important;
    min-height: auto;
    border-radius: 12px;
  }
  .paper-meta {
    display: flex;
    flex-direction: column;
    width: 100%;
    flex: none;
    gap: 8px;
  }
  .paper-meta-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
  .paper-meta-actions {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    width: 100%;
    margin-top: 2px;
  }
  .paper-meta-actions .pdf-link,
  .paper-meta-actions .discuss-ai-btn,
  .paper-meta-actions .translate-action-btn,
  .paper-meta-actions .translate-flip-btn,
  .paper-meta-actions .retranslate-action-btn,
  .paper-meta-actions .link-seminar-btn,
  .paper-meta-actions .seminar-linked-status,
  .paper-meta-actions .zotero-push-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    padding: 0;
    margin: 0;
  }
  .paper-main h2 {
    font-size: 16px;
    line-height: 1.45;
  }
  .paper-side-rail {
    position: static;
    width: 100%;
    height: auto;
    flex: none;
    margin-top: 8px;
    gap: 10px;
    overflow: visible;
  }
  .paper-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    width: 100%;
    padding-top: 10px;
    border-top: 1px dashed color-mix(in srgb, var(--line) 70%, transparent);
  }
  .paper-actions::-webkit-scrollbar {
    display: none;
  }
}

.article-source-row {
  margin-bottom: 6px;
}

.article-source-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 8px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  border-radius: 9999px;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--accent);
}

.audience-flow {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.teacher-inline-tag {
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, #a855f7 20%, transparent);
  color: #c084fc;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.4;
}

.recommend-time-inline {
  color: var(--muted);
  font-size: 11px;
  margin-left: 4px;
}

.meta-pub-date {
  opacity: 0.8;
}

.priority-label.teacher-priority {
  color: #c084fc;
  font-weight: 700;
}

.badge.purple {
  background: color-mix(in srgb, #a855f7 18%, transparent);
  color: #c084fc;
  border: 1px solid color-mix(in srgb, #a855f7 35%, transparent);
}

.paper-row.is-target-highlighted {
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent), 0 8px 30px rgba(0, 0, 0, 0.3) !important;
  animation: targetHighlightPulse 2s ease-in-out infinite;
}

@keyframes targetHighlightPulse {
  0%, 100% {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent), 0 8px 30px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 60%, transparent), 0 12px 36px rgba(0, 0, 0, 0.45);
  }
}

.link-seminar-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 540px;
  margin: 0 auto;
}

.selected-paper-card {
  padding: 12px 14px;
  background: var(--bg-hover, rgba(0, 0, 0, 0.03));
  border: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
  border-radius: 8px;
}

.paper-brief-id {
  font-family: var(--font-mono, monospace);
  font-size: 12px;
  font-weight: 600;
  color: var(--primary, #2563eb);
  margin-bottom: 4px;
}

.paper-brief-title {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-color, #1e293b);
}

.seminar-slot-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  padding: 2px;
}

.seminar-slot-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line, rgba(184, 155, 248, 0.18));
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: rgba(255, 255, 255, 0.04);
  color: var(--text, #f8fafc);
  position: relative;
}

.seminar-slot-option input[type="radio"] {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
  pointer-events: none;
}

.seminar-slot-option:hover {
  border-color: var(--accent, #b89bf8);
  background: rgba(184, 155, 248, 0.08);
}

.seminar-slot-option.active {
  border-color: var(--accent, #b89bf8);
  background: rgba(184, 155, 248, 0.16);
  box-shadow: 0 0 0 1px var(--accent, #b89bf8), 0 2px 12px rgba(184, 155, 248, 0.2);
}

.slot-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.slot-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #f8fafc);
}

.slot-days {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--muted, #94a3b8);
}

.slot-days.is-imminent {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.slot-meta {
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  color: var(--soft, #cbd5e1);
}

.slot-existing-papers {
  color: var(--accent, #b89bf8);
}

.duplicate-warning-banner {
  padding: 10px 12px;
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.35);
  border-radius: 8px;
  color: #f59e0b;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.warning-body {
  font-size: 12px;
  margin-top: 4px;
  margin-left: 22px;
}

.mode-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mode-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.checkbox-option {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
}

.card-paper-badge {
  font-size: 11px;
  margin-bottom: 4px;
  color: var(--soft, #cbd5e1);
}

.pending-papers-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--line, rgba(184, 155, 248, 0.15));
  border-radius: 8px;
  font-size: 12px;
}

.pending-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* Zotero 推送弹窗样式 */
.zotero-modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 540px;
  margin: 0 auto;
}

.zotero-configured-flow {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.styled-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  outline: none;
}

.styled-select:focus {
  border-color: var(--accent);
}

.zotero-options-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: rgba(255, 255, 255, 0.03);
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
}

.option-checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  cursor: pointer;
  line-height: 1.4;
  color: var(--soft);
}

.option-checkbox-row:hover {
  color: var(--text);
}

.option-checkbox-row input[type="checkbox"] {
  margin-top: 2px;
}

.option-checkbox-row :deep(.checkbox-box) {
  margin-top: 1px;
}

.option-checkbox-row.default-sync-row {
  border-top: 1px dashed var(--line);
  padding-top: 8px;
  margin-top: 2px;
  color: var(--muted);
  font-size: 12px;
}

.unconfigured-guide-card {
  padding: 12px 14px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(14, 165, 233, 0.25);
}

.unconfigured-guide-card h4 {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  color: #38bdf8;
}

.unconfigured-action-boxes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 4px;
}

@media (max-width: 600px) {
  .unconfigured-action-boxes {
    grid-template-columns: 1fr;
  }
}

.action-box {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 10px;
  padding: 14px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--line);
}

.action-box .box-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.action-box .box-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.45;
  margin: 0;
}

.action-box .button {
  width: 100%;
  justify-content: center;
  font-size: 12px;
}

.success-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.35);
  border-radius: 8px;
  color: #4ade80;
  font-size: 13px;
  font-weight: 500;
}

.zotero-note-section {
  width: 100%;
}

.zotero-custom-note-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-family: inherit;
  font-size: 13px;
  line-height: 1.45;
  box-sizing: border-box;
  resize: vertical;
  outline: none;
  min-height: 52px;
  transition: border-color 0.15s ease;
}

.zotero-custom-note-textarea:focus {
  border-color: var(--accent);
}

.zotero-tags-section {
  width: 100%;
}

.zotero-tags-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  box-sizing: border-box;
  outline: none;
  transition: border-color 0.15s ease;
}

.zotero-tags-input:focus {
  border-color: var(--accent);
}
</style>
