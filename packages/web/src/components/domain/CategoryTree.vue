<template>
  <div class="category-tree">
    <div class="tree-header">
      <span class="tree-title">카테고리</span>
      <el-button v-if="editable" size="small" text type="primary" @click="addRoot">
        <el-icon><Plus /></el-icon>
      </el-button>
    </div>

    <!-- "전체" 항목 — 카테고리가 있을 때만 표시 -->
    <div
      v-if="treeData.length > 0"
      class="all-item"
      :class="{ active: selectedId === null }"
      @click="selectAll"
    >
      전체
    </div>

    <el-tree
      :data="treeData"
      :props="{ label: 'label', children: 'children' }"
      node-key="id"
      :current-node-key="selectedId"
      highlight-current
      default-expand-all
      @node-click="onNodeClick"
    >
      <template #default="{ node, data }">
        <span class="tree-node">
          <span>{{ node.label }}</span>
          <span v-if="editable" class="tree-actions">
            <el-button size="small" text @click.stop="addChild(data)" title="하위 추가">
              <el-icon><Plus /></el-icon>
            </el-button>
            <el-button size="small" text @click.stop="renameNode(data)" title="이름 변경">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button size="small" text @click.stop="moveNode(data)" title="이동">
              <el-icon><Rank /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click.stop="removeNode(data)" title="삭제">
              <el-icon><Delete /></el-icon>
            </el-button>
          </span>
        </span>
      </template>
    </el-tree>

    <div v-if="treeData.length === 0" class="empty-hint">
      카테고리가 없습니다
    </div>

    <!-- 카테고리 추가 다이얼로그 -->
    <el-dialog v-model="showAddDialog" title="카테고리 추가" width="400px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="이름">
          <el-input v-model="newCategoryName" placeholder="카테고리 이름" maxlength="100" @keyup.enter="confirmAdd" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">취소</el-button>
        <el-button type="primary" :loading="adding" @click="confirmAdd" :disabled="!newCategoryName.trim()">추가</el-button>
      </template>
    </el-dialog>

    <!-- 이름 변경 다이얼로그 -->
    <el-dialog v-model="showRenameDialog" title="카테고리 이름 변경" width="400px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="새 이름">
          <el-input v-model="renameName" placeholder="새 이름" maxlength="100" @keyup.enter="confirmRename" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRenameDialog = false">취소</el-button>
        <el-button type="primary" :loading="renaming" @click="confirmRename" :disabled="!renameName.trim()">변경</el-button>
      </template>
    </el-dialog>

    <!-- 이동 다이얼로그 -->
    <el-dialog v-model="showMoveDialog" title="카테고리 이동" width="400px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="이동 대상">
          <el-tree-select
            v-model="moveTargetId"
            :data="moveTreeOptions"
            :props="{ label: 'label', children: 'children', value: 'id' }"
            placeholder="이동할 위치 선택"
            check-strictly
            style="width: 100%"
            clearable
          />
          <div style="font-size: 12px; color: #909399; margin-top: 4px">
            비워두면 루트로 이동합니다
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMoveDialog = false">취소</el-button>
        <el-button type="primary" :loading="moving" @click="confirmMove">이동</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Plus, Delete, Edit, Rank } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoriesApi } from '@/api/categories'
import type { DomainCategoryEntity } from '@kms/shared'

const props = defineProps<{
  domainCode: string
  editable?: boolean
}>()

const emit = defineEmits<{
  select: [categoryId: number | null]
}>()

const categories = ref<DomainCategoryEntity[]>([])
const selectedId = ref<number | null>(null)
const showAddDialog = ref(false)
const newCategoryName = ref('')
const addParentId = ref<number | null>(null)
const adding = ref(false)

interface TreeItem {
  id: number
  label: string
  children?: TreeItem[]
}

function toTree(cats: DomainCategoryEntity[]): TreeItem[] {
  return cats.map((c) => ({
    id: c.id,
    label: c.name,
    children: c.children?.length ? toTree(c.children) : undefined,
  }))
}

const treeData = computed(() => toTree(categories.value))

async function loadCategories() {
  if (!props.domainCode) return
  try {
    const res = await categoriesApi.getByDomain(props.domainCode)
    categories.value = res.data
  } catch {
    categories.value = []
  }
}

watch(() => props.domainCode, () => {
  selectedId.value = null
  loadCategories()
}, { immediate: true })

function selectAll() {
  selectedId.value = null
  emit('select', null)
}

function onNodeClick(data: TreeItem) {
  selectedId.value = data.id
  emit('select', data.id)
}

function addRoot() {
  addParentId.value = null
  newCategoryName.value = ''
  showAddDialog.value = true
}

function addChild(data: TreeItem) {
  addParentId.value = data.id
  newCategoryName.value = ''
  showAddDialog.value = true
}

async function confirmAdd() {
  if (!newCategoryName.value.trim()) return
  adding.value = true
  try {
    await categoriesApi.create(props.domainCode, {
      name: newCategoryName.value.trim(),
      parentId: addParentId.value ?? undefined,
    })
    ElMessage.success('카테고리가 추가되었습니다')
    showAddDialog.value = false
    await loadCategories()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '추가 실패'
    ElMessage.error(msg)
  } finally {
    adding.value = false
  }
}

async function removeNode(data: TreeItem) {
  try {
    await ElMessageBox.confirm(
      `"${data.label}" 카테고리를 삭제하시겠습니까? 하위 카테고리도 함께 삭제됩니다.`,
      '카테고리 삭제',
      { type: 'warning' },
    )
    await categoriesApi.remove(data.id)
    ElMessage.success('삭제되었습니다')
    if (selectedId.value === data.id) {
      selectedId.value = null
      emit('select', null)
    }
    await loadCategories()
  } catch {
    // 취소 또는 에러
  }
}

// ── 이름 변경 ──
const showRenameDialog = ref(false)
const renameName = ref('')
const renameTargetId = ref<number | null>(null)
const renaming = ref(false)

function renameNode(data: TreeItem) {
  renameTargetId.value = data.id
  renameName.value = data.label
  showRenameDialog.value = true
}

async function confirmRename() {
  if (!renameName.value.trim() || !renameTargetId.value) return
  renaming.value = true
  try {
    await categoriesApi.update(renameTargetId.value, { name: renameName.value.trim() })
    ElMessage.success('이름이 변경되었습니다')
    showRenameDialog.value = false
    await loadCategories()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '이름 변경 실패'
    ElMessage.error(msg)
  } finally {
    renaming.value = false
  }
}

// ── 이동 ──
const showMoveDialog = ref(false)
const moveTargetId = ref<number | null>(null)
const moveSourceId = ref<number | null>(null)
const moving = ref(false)

/** 이동 대상 트리에서 자기 자신과 하위 노드를 제외 */
function getDescendantIds(items: TreeItem[], targetId: number): Set<number> {
  const ids = new Set<number>()
  function collect(nodes: TreeItem[]) {
    for (const n of nodes) {
      ids.add(n.id)
      if (n.children) collect(n.children)
    }
  }
  function findAndCollect(nodes: TreeItem[]): boolean {
    for (const n of nodes) {
      if (n.id === targetId) {
        collect([n])
        return true
      }
      if (n.children && findAndCollect(n.children)) return true
    }
    return false
  }
  findAndCollect(items)
  return ids
}

const moveTreeOptions = computed(() => {
  if (!moveSourceId.value) return []
  const excludeIds = getDescendantIds(treeData.value, moveSourceId.value)
  function filter(items: TreeItem[]): TreeItem[] {
    return items
      .filter((i) => !excludeIds.has(i.id))
      .map((i) => ({
        ...i,
        children: i.children ? filter(i.children) : undefined,
      }))
  }
  return filter(treeData.value)
})

function moveNode(data: TreeItem) {
  moveSourceId.value = data.id
  moveTargetId.value = null
  showMoveDialog.value = true
}

async function confirmMove() {
  if (!moveSourceId.value) return
  moving.value = true
  try {
    await categoriesApi.move(moveSourceId.value, moveTargetId.value)
    ElMessage.success('이동되었습니다')
    showMoveDialog.value = false
    await loadCategories()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '이동 실패'
    ElMessage.error(msg)
  } finally {
    moving.value = false
  }
}

defineExpose({ reload: loadCategories })
</script>

<style scoped>
.category-tree {
  padding: 8px;
}
.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding: 0 4px;
}
.tree-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}
.tree-node {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}
.tree-actions {
  display: none;
}
.tree-node:hover .tree-actions {
  display: inline-flex;
}
.all-item {
  padding: 6px 12px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 2px;
  color: var(--el-text-color-regular);
}
.all-item:hover {
  background: var(--el-fill-color-light);
}
.all-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.empty-hint {
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  padding: 20px;
}
</style>
