<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useDomainStore } from '@/stores/domain'
import { placementsApi } from '@/api/placements'
import { categoriesApi } from '@/api/categories'
import { ElMessage } from 'element-plus'
import type { DomainMasterEntity, DomainCategoryEntity } from '@kms/shared'

const props = defineProps<{
  visible: boolean
  documentIds: string[]
}>()

const emit = defineEmits<{
  (e: 'update:visible', v: boolean): void
  (e: 'success', result: { success: number; failed: number }): void
}>()

const domainStore = useDomainStore()

const selectedDomainCode = ref<string>('')
const selectedCategoryId = ref<number | undefined>(undefined)
const categories = ref<DomainCategoryEntity[]>([])
const loading = ref(false)
const loadingCategories = ref(false)

const selectedDomain = computed(() =>
  domainStore.domainsFlat.find((d) => d.code === selectedDomainCode.value),
)

// 도메인 선택 시 카테고리 로드
watch(selectedDomainCode, async (code) => {
  selectedCategoryId.value = undefined
  categories.value = []

  if (!code) return

  loadingCategories.value = true
  try {
    const res = await categoriesApi.getByDomain(code)
    categories.value = res.data
  } catch {
    categories.value = []
  } finally {
    loadingCategories.value = false
  }
})

// 다이얼로그 열릴 때 초기화
watch(
  () => props.visible,
  (v) => {
    if (v) {
      selectedDomainCode.value = ''
      selectedCategoryId.value = undefined
      categories.value = []
    }
  },
)

const processingMessage = ref('')

async function handleSubmit() {
  if (!selectedDomainCode.value) {
    ElMessage.warning('도메인을 선택해 주세요')
    return
  }

  loading.value = true
  const count = props.documentIds.length
  processingMessage.value = count > 100
    ? `${count.toLocaleString()}건 처리 중... (대용량 작업은 시간이 걸릴 수 있습니다)`
    : ''

  try {
    const res = await placementsApi.bulkCreate({
      documentIds: props.documentIds,
      domainCode: selectedDomainCode.value,
      categoryId: selectedCategoryId.value,
    })

    if (res.data.success > 0) {
      ElMessage.success(`${res.data.success.toLocaleString()}건 배치 완료`)
    }
    if (res.data.failed > 0) {
      ElMessage.warning(`${res.data.failed.toLocaleString()}건 실패`)
    }

    emit('success', { success: res.data.success, failed: res.data.failed })
    emit('update:visible', false)
  } catch {
    ElMessage.error('일괄 배치에 실패했습니다')
  } finally {
    loading.value = false
    processingMessage.value = ''
  }
}

// 카테고리 트리를 el-cascader용 데이터로 변환
interface CascaderNode {
  value: number
  label: string
  children?: CascaderNode[]
}

function buildCategoryTree(cats: DomainCategoryEntity[]): CascaderNode[] {
  const map = new Map<number, CascaderNode & { children: CascaderNode[] }>()
  const roots: CascaderNode[] = []

  for (const cat of cats) {
    map.set(cat.id, { value: cat.id, label: cat.name, children: [] })
  }

  for (const cat of cats) {
    const node = map.get(cat.id)!
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  // children이 빈 배열이면 제거
  function clean(nodes: CascaderNode[]) {
    for (const n of nodes) {
      if (n.children && n.children.length === 0) {
        delete n.children
      } else if (n.children) {
        clean(n.children)
      }
    }
  }
  clean(roots)

  return roots
}

const categoryTree = computed(() => buildCategoryTree(categories.value))
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="일괄 배치"
    width="480px"
    :close-on-click-modal="false"
  >
    <div style="margin-bottom: 16px; color: #606266">
      {{ documentIds.length.toLocaleString() }}건의 문서를 선택한 도메인에 배치합니다.
    </div>

    <!-- 대용량 처리 중 메시지 -->
    <el-alert
      v-if="processingMessage"
      :title="processingMessage"
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    />

    <el-form label-position="top">
      <el-form-item label="도메인" required>
        <el-select
          v-model="selectedDomainCode"
          placeholder="도메인 선택"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="d in domainStore.domainsFlat"
            :key="d.code"
            :label="d.displayName"
            :value="d.code"
          >
            <span>{{ d.displayName }}</span>
            <span style="color: #909399; font-size: 12px; margin-left: 8px">{{ d.code }}</span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item v-if="categoryTree.length > 0" label="카테고리 (선택)">
        <el-cascader
          v-model="selectedCategoryId"
          :options="categoryTree"
          :props="{ checkStrictly: true, emitPath: false }"
          clearable
          placeholder="카테고리 선택 (선택사항)"
          style="width: 100%"
          :loading="loadingCategories"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">취소</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        배치하기
      </el-button>
    </template>
  </el-dialog>
</template>
