<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  collections: {
    type: Array,
    default: () => []
  },
  label: {
    type: String,
    default: '保存到'
  },
  initiallyExpanded: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const isTreeExpanded = ref(props.initiallyExpanded)
const isRootOpen = ref(true)
const openMap = ref({})
const filterQuery = ref('')

// 构建以 key 为索引的 Map
const collectionMap = computed(() => {
  const map = new Map()
  for (const c of props.collections) {
    if (c && c.key) {
      map.set(c.key, c)
    }
  }
  return map
})

// 建立父子关系树
const treeData = computed(() => {
  const map = collectionMap.value
  const childrenMap = new Map()

  for (const c of props.collections) {
    const parentKey = c.parentCollection || ''
    if (!childrenMap.has(parentKey)) {
      childrenMap.set(parentKey, [])
    }
    childrenMap.get(parentKey).push(c)
  }

  // 排序
  for (const list of childrenMap.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  function buildTree(parentKey = '', depth = 0) {
    const children = childrenMap.get(parentKey) || []
    return children.map(c => ({
      key: c.key,
      name: c.name,
      parentCollection: c.parentCollection,
      depth,
      hasChildren: (childrenMap.get(c.key) || []).length > 0,
      children: buildTree(c.key, depth + 1)
    }))
  }

  // 顶层节点（无父级或父级不在列表中）
  const rootChildren = []
  for (const c of props.collections) {
    if (!c.parentCollection || !map.has(c.parentCollection)) {
      rootChildren.push({
        key: c.key,
        name: c.name,
        parentCollection: c.parentCollection,
        depth: 0,
        hasChildren: (childrenMap.get(c.key) || []).length > 0,
        children: buildTree(c.key, 1)
      })
    }
  }

  rootChildren.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  return rootChildren
})

// 计算匹配筛选条件的节点及其所有祖先
const matchingKeys = computed(() => {
  const q = filterQuery.value.trim().toLowerCase()
  if (!q) return null

  const matches = new Set()
  const map = collectionMap.value

  for (const c of props.collections) {
    if (c.name && c.name.toLowerCase().includes(q)) {
      matches.add(c.key)
      // 递归添加所有父级
      let currParent = c.parentCollection
      while (currParent && map.has(currParent)) {
        matches.add(currParent)
        currParent = map.get(currParent).parentCollection
      }
    }
  }

  return matches
})

// 扁平化可见树节点
const visibleFlattenedNodes = computed(() => {
  const result = []
  const filterSet = matchingKeys.value

  function walk(nodes) {
    for (const node of nodes) {
      if (filterSet && !filterSet.has(node.key)) {
        continue
      }

      result.push({
        key: node.key,
        name: node.name,
        depth: node.depth,
        hasChildren: node.hasChildren
      })

      // 当搜索或展开时遍历子项
      const shouldExpand = filterSet ? true : Boolean(openMap.value[node.key])
      if (shouldExpand && node.children && node.children.length > 0) {
        walk(node.children)
      }
    }
  }

  walk(treeData.value)
  return result
})

// 自动展开已选节点的祖先链路
function expandAncestorsOf(key) {
  if (!key) return
  const map = collectionMap.value
  let curr = map.get(key)
  while (curr && curr.parentCollection) {
    openMap.value[curr.parentCollection] = true
    curr = map.get(curr.parentCollection)
  }
}

// 当前选中的文件夹显示名称与完整路径
const currentNameText = computed(() => {
  if (!props.modelValue) return '我的文库 (全部文献)'
  const col = collectionMap.value.get(props.modelValue)
  return col?.name || props.modelValue
})

const currentPathText = computed(() => {
  if (!props.modelValue) return '我的文库'
  const col = collectionMap.value.get(props.modelValue)
  return col?.path || col?.name || ''
})

function toggleRoot() {
  isRootOpen.value = !isRootOpen.value
}

function toggleNode(key) {
  openMap.value[key] = !openMap.value[key]
}

function selectCollection(key) {
  emit('update:modelValue', key)
  emit('change', key)
  if (key) {
    // 自动展开当前选中项以查看其内部子文件夹
    openMap.value[key] = true
    expandAncestorsOf(key)
  }
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    expandAncestorsOf(newVal)
  }
}, { immediate: true })

onMounted(() => {
  if (props.modelValue) {
    expandAncestorsOf(props.modelValue)
  }
})
</script>

<template>
  <div class="zotero-tree-container">
    <!-- Header: 保存到 + 当前选项目录 + 展开/折叠按钮 -->
    <div class="zotero-tree-header">
      <span class="zotero-tree-label">{{ label }}</span>
      <div
        class="zotero-tree-current-pill"
        role="button"
        tabindex="0"
        :title="currentPathText ? `当前选定: ${currentPathText} (点击展开/折叠)` : '点击展开/折叠分类树'"
        @click="isTreeExpanded = !isTreeExpanded"
        @keydown.enter="isTreeExpanded = !isTreeExpanded"
        @keydown.space.prevent="isTreeExpanded = !isTreeExpanded"
      >
        <svg class="folder-svg-mini" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span class="pill-name">{{ currentNameText }}</span>
        <svg
          class="caret-svg"
          :class="{ 'rotate-180': isTreeExpanded }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>

      <button
        type="button"
        class="zotero-tree-toggle-btn"
        :title="isTreeExpanded ? '折叠目录列表' : '展开目录列表'"
        @click="isTreeExpanded = !isTreeExpanded"
      >
        <svg
          class="toggle-chevron"
          :class="{ 'rotate-180': !isTreeExpanded }"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    </div>

    <!-- Tree Box Panel (Collapsible) -->
    <div v-show="isTreeExpanded" class="zotero-tree-panel">
      <!-- Search Filter -->
      <div class="zotero-tree-search-wrap">
        <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
        </svg>
        <input
          v-model="filterQuery"
          type="text"
          class="zotero-tree-search-input"
          placeholder="Filter Collections"
          aria-label="筛选分类文件夹"
        />
        <button
          v-if="filterQuery"
          type="button"
          class="search-clear-btn"
          title="清空筛选"
          @click="filterQuery = ''"
        >
          <svg viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>

      <!-- Tree Content -->
      <div class="zotero-tree-scroll-area">
        <!-- Root node: 我的文库 -->
        <div
          v-if="!filterQuery"
          class="zotero-tree-row root-row"
          :class="{ 'is-selected': modelValue === '' }"
          @click="selectCollection('')"
        >
          <button
            type="button"
            class="tree-arrow-btn"
            title="展开/折叠根目录"
            @click.stop="toggleRoot"
          >
            <svg
              class="tree-arrow-svg"
              :class="{ 'is-open': isRootOpen }"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
            </svg>
          </button>

          <!-- Library Box SVG -->
          <svg class="tree-node-icon library-icon" viewBox="0 0 20 20" fill="currentColor">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fill-rule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clip-rule="evenodd" />
          </svg>

          <span class="tree-node-title">我的文库</span>
        </div>

        <!-- Render recursive or flattened items -->
        <div v-show="isRootOpen || filterQuery" class="zotero-tree-children">
          <template v-for="item in visibleFlattenedNodes" :key="item.key">
            <div
              class="zotero-tree-row"
              :class="{ 'is-selected': modelValue === item.key }"
              :style="{ paddingLeft: `calc(12px + ${item.depth} * 18px)` }"
              @click="selectCollection(item.key)"
            >
              <button
                v-if="item.hasChildren"
                type="button"
                class="tree-arrow-btn"
                :title="openMap[item.key] ? '折叠子文件夹' : '展开子文件夹'"
                @click.stop="toggleNode(item.key)"
              >
                <svg
                  class="tree-arrow-svg"
                  :class="{ 'is-open': openMap[item.key] }"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" />
                </svg>
              </button>
              <span v-else class="tree-arrow-spacer"></span>

              <!-- Folder icon -->
              <svg class="tree-node-icon folder-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>

              <span class="tree-node-title">{{ item.name }}</span>
            </div>
          </template>

          <div v-if="visibleFlattenedNodes.length === 0 && filterQuery" class="empty-filter-state">
            未找到匹配的分类文件夹
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.zotero-tree-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.zotero-tree-header {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.zotero-tree-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}

.zotero-tree-current-pill {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  transition: all 0.15s ease;
  overflow: hidden;
}

.zotero-tree-current-pill:hover {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 5%, var(--bg));
}

.folder-svg-mini {
  width: 15px;
  height: 15px;
  color: #f59e0b;
  flex-shrink: 0;
}

.pill-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 500;
}

.caret-svg {
  width: 14px;
  height: 14px;
  color: var(--muted);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.rotate-180 {
  transform: rotate(180deg);
}

.zotero-tree-toggle-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--muted);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.zotero-tree-toggle-btn:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface);
}

.toggle-chevron {
  width: 16px;
  height: 16px;
  transition: transform 0.2s ease;
}

/* Tree Panel Box */
.zotero-tree-panel {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.zotero-tree-search-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 60%, var(--bg));
}

.search-icon {
  width: 14px;
  height: 14px;
  color: var(--muted);
  flex-shrink: 0;
}

.zotero-tree-search-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  outline: none;
  padding: 2px 0;
}

.zotero-tree-search-input::placeholder {
  color: var(--muted);
}

.search-clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 16px;
  height: 16px;
  border: none;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
}

.search-clear-btn:hover {
  color: var(--text);
}

.search-clear-btn svg {
  width: 14px;
  height: 14px;
}

.zotero-tree-scroll-area {
  max-height: 220px;
  overflow-y: auto;
  padding: 4px 0;
}

.zotero-tree-scroll-area::-webkit-scrollbar {
  width: 6px;
}

.zotero-tree-scroll-area::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}

/* Tree Rows */
.zotero-tree-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 3px 10px;
  cursor: pointer;
  user-select: none;
  font-size: 13px;
  color: var(--text);
  transition: background-color 0.12s ease;
}

.zotero-tree-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.zotero-tree-row.is-selected {
  background: #2563eb !important;
  color: #ffffff !important;
}

.zotero-tree-row.is-selected .tree-node-title {
  color: #ffffff !important;
  font-weight: 500;
}

.zotero-tree-row.is-selected .tree-arrow-svg {
  color: rgba(255, 255, 255, 0.85);
}

.zotero-tree-row.is-selected .folder-icon,
.zotero-tree-row.is-selected .library-icon {
  color: #ffffff;
}

.tree-arrow-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}

.tree-arrow-svg {
  width: 13px;
  height: 13px;
  color: var(--muted);
  transition: transform 0.18s ease;
}

.tree-arrow-svg.is-open {
  transform: rotate(90deg);
}

.tree-arrow-spacer {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.tree-node-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.folder-icon {
  color: #f59e0b;
}

.library-icon {
  color: #c084fc;
}

.tree-node-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
}

.empty-filter-state {
  padding: 12px 16px;
  font-size: 12px;
  color: var(--muted);
  text-align: center;
}
</style>
