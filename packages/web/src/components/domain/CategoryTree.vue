<template>
  <div class="category-tree">
    <div class="tree-header">
      <span class="tree-title">카테고리</span>
      <el-button v-if="editable" size="small" text type="primary" @click="addRoot">
        <el-icon><Plus /></el-icon>
      </el-button>
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
            <el-button size="small" text @click.stop="addChild(data)">
              <el-icon><Plus /></el-icon>
            </el-button>
            <el-button size="small" text type="danger" @click.stop="removeNode(data)">
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
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
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
.empty-hint {
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  padding: 20px;
}
</style>
