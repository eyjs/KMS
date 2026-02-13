<script setup lang="ts">
/**
 * FolderBrowser - Windows 탐색기 스타일 폴더 선택 컴포넌트
 *
 * 동작:
 * - 단일 클릭: 폴더 선택 (체크 표시)
 * - 더블클릭: 폴더 진입 (하위 목록 표시)
 * - 브레드크럼 클릭: 상위 폴더로 이동
 * - 뒤로가기 버튼: 한 단계 상위로 이동
 */
import { ref, computed, watch } from 'vue'
import { ArrowLeft, ArrowRight, Folder, FolderOpened, Check } from '@element-plus/icons-vue'
import { flattenCategoryTree } from '@/utils'
import type { DomainCategoryEntity } from '@kms/shared'

const props = withDefaults(
  defineProps<{
    categories: DomainCategoryEntity[] // 전체 카테고리 트리
    modelValue?: number | null // v-model (선택된 categoryId)
    allowRoot?: boolean // 루트 선택 허용 (기본 true)
    height?: string // 높이 (기본 '300px')
    loading?: boolean
  }>(),
  {
    modelValue: null,
    allowRoot: true,
    height: '300px',
    loading: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  select: [category: DomainCategoryEntity | null]
}>()

const flatCategories = computed(() => flattenCategoryTree(props.categories))

// 현재 탐색 중인 폴더 (null = 루트)
const currentFolderId = ref<number | null>(null)

// 선택된 폴더 ID (v-model 연동)
const selectedFolderId = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val),
})

// 현재 폴더의 직계 자식
const currentChildren = computed(() => {
  if (currentFolderId.value === null) {
    // 루트: parentId가 null인 것들
    return flatCategories.value.filter((c) => c.parentId === null)
  }
  return flatCategories.value.filter((c) => c.parentId === currentFolderId.value)
})

// 브레드크럼 경로
const breadcrumbPath = computed(() => {
  const path: DomainCategoryEntity[] = []
  let id = currentFolderId.value
  while (id !== null) {
    const folder = flatCategories.value.find((c) => c.id === id)
    if (folder) {
      path.unshift(folder)
      id = folder.parentId
    } else {
      break
    }
  }
  return path
})

// 선택된 폴더 엔티티
const selectedFolder = computed(() => {
  if (selectedFolderId.value === null) return null
  return flatCategories.value.find((c) => c.id === selectedFolderId.value) ?? null
})

// 하위 폴더가 있는 폴더 ID Set (O(1) lookup)
const folderIdsWithChildren = computed(() => {
  const ids = new Set<number>()
  for (const cat of flatCategories.value) {
    if (cat.parentId !== null) {
      ids.add(cat.parentId)
    }
  }
  return ids
})

// 하위 폴더 여부
function hasChildren(folder: DomainCategoryEntity): boolean {
  return folderIdsWithChildren.value.has(folder.id)
}

// 목록이 비어 있는지
const isEmpty = computed(() => {
  // 루트 레벨에서 루트 선택 옵션 없으면 currentChildren만 체크
  if (currentFolderId.value === null && props.allowRoot) {
    return currentChildren.value.length === 0
  }
  return currentChildren.value.length === 0
})

// 폴더 선택 (단일 클릭)
function selectFolder(folderId: number | null) {
  selectedFolderId.value = folderId
  const folder = folderId === null ? null : flatCategories.value.find((c) => c.id === folderId) ?? null
  emit('select', folder)
}

// 폴더 진입 (더블클릭)
function enterFolder(folderId: number) {
  const folder = flatCategories.value.find((c) => c.id === folderId)
  // 하위 폴더가 있을 때만 진입
  if (folder && hasChildren(folder)) {
    currentFolderId.value = folderId
  }
}

// 뒤로가기
function goBack() {
  const current = flatCategories.value.find((c) => c.id === currentFolderId.value)
  currentFolderId.value = current?.parentId ?? null
}

// 루트로 이동
function goToRoot() {
  if (currentFolderId.value !== null) {
    currentFolderId.value = null
  }
}

// 특정 폴더로 이동 (브레드크럼 클릭)
function navigateTo(folderId: number) {
  // 마지막 항목(현재 폴더)가 아닌 경우만 이동
  const lastFolder = breadcrumbPath.value[breadcrumbPath.value.length - 1]
  if (!lastFolder || lastFolder.id !== folderId) {
    currentFolderId.value = folderId
  }
}

// 선택된 폴더의 부모로 이동 (선택된 폴더가 보이도록)
function navigateToShowSelected() {
  if (props.modelValue === null) {
    currentFolderId.value = null
    return
  }
  const selected = flatCategories.value.find((c) => c.id === props.modelValue)
  if (selected) {
    // 선택된 폴더의 부모로 이동하여 선택된 폴더가 리스트에 보이도록
    currentFolderId.value = selected.parentId
  }
}

// 카테고리가 바뀌면 탐색 위치 리셋 및 선택된 폴더로 이동
watch(
  () => props.categories,
  () => {
    navigateToShowSelected()
  },
)

// 초기 마운트 시 선택된 폴더가 있으면 해당 위치로 이동
watch(
  () => props.modelValue,
  (newVal, oldVal) => {
    // 외부에서 modelValue가 변경된 경우에만 (내부 선택이 아닌 경우)
    if (newVal !== oldVal && newVal !== null) {
      const selected = flatCategories.value.find((c) => c.id === newVal)
      if (selected && selected.parentId !== currentFolderId.value) {
        currentFolderId.value = selected.parentId
      }
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="folder-browser" :style="{ height }">
    <!-- 헤더: 뒤로가기 + 브레드크럼 -->
    <div class="browser-header">
      <el-button
        :icon="ArrowLeft"
        text
        :disabled="currentFolderId === null"
        @click="goBack"
        size="small"
      />
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>
          <span
            :class="{ clickable: currentFolderId !== null }"
            @click="goToRoot"
          >
            루트
          </span>
        </el-breadcrumb-item>
        <el-breadcrumb-item
          v-for="(folder, idx) in breadcrumbPath"
          :key="folder.id"
        >
          <span
            :class="{ clickable: idx < breadcrumbPath.length - 1 }"
            @click="navigateTo(folder.id)"
          >
            {{ folder.name }}
          </span>
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <!-- 폴더 목록 -->
    <div class="browser-list" v-loading="loading">
      <!-- 루트 선택 옵션 -->
      <div
        v-if="allowRoot && currentFolderId === null"
        class="folder-item root-option"
        :class="{ selected: selectedFolderId === null }"
        @click="selectFolder(null)"
      >
        <el-icon><FolderOpened /></el-icon>
        <span class="name">루트에 배치 (폴더 없음)</span>
        <el-icon v-if="selectedFolderId === null" class="check"><Check /></el-icon>
      </div>

      <!-- 하위 폴더 -->
      <div
        v-for="folder in currentChildren"
        :key="folder.id"
        class="folder-item"
        :class="{ selected: selectedFolderId === folder.id }"
        @click="selectFolder(folder.id)"
        @dblclick="enterFolder(folder.id)"
      >
        <el-icon><Folder /></el-icon>
        <span class="name">{{ folder.name }}</span>
        <span class="code">{{ folder.code }}</span>
        <el-icon v-if="hasChildren(folder)" class="arrow"><ArrowRight /></el-icon>
        <el-icon v-if="selectedFolderId === folder.id" class="check"><Check /></el-icon>
      </div>

      <!-- 빈 상태 -->
      <el-empty
        v-if="isEmpty && !loading"
        description="하위 폴더 없음"
        :image-size="60"
      />
    </div>

    <!-- 푸터: 선택된 폴더 -->
    <div class="browser-footer" v-if="selectedFolder">
      선택됨: {{ selectedFolder.name }} ({{ selectedFolder.code }})
    </div>
    <div class="browser-footer" v-else-if="allowRoot && selectedFolderId === null">
      선택됨: 루트 (폴더 없음)
    </div>
  </div>
</template>

<style scoped>
.folder-browser {
  display: flex;
  flex-direction: column;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}

.browser-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #ebeef5;
  background: #fafafa;
}

.browser-header :deep(.el-breadcrumb) {
  font-size: 13px;
}

.browser-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.folder-item:hover {
  background: #f5f7fa;
}

.folder-item.selected {
  background: #ecf5ff;
}

.folder-item .name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-item .code {
  color: #909399;
  font-size: 12px;
  flex-shrink: 0;
}

.folder-item .arrow {
  color: #c0c4cc;
  flex-shrink: 0;
}

.folder-item .check {
  color: #409eff;
  flex-shrink: 0;
}

.folder-item.root-option {
  color: #606266;
  font-style: italic;
}

.browser-footer {
  padding: 8px 12px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
  font-size: 13px;
  color: #606266;
}

.clickable {
  cursor: pointer;
}

.clickable:hover {
  color: #409eff;
}
</style>
