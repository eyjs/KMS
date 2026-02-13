<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="$emit('update:visible', $event)"
    title="도메인에 배치"
    width="500px"
    destroy-on-close
  >
    <el-form label-position="top">
      <el-form-item label="도메인 선택" required>
        <el-tree-select
          v-model="form.domainCode"
          :data="domainTreeData"
          :props="{ label: 'label', value: 'value', children: 'children' }"
          placeholder="도메인을 선택하세요"
          check-strictly
          filterable
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="폴더 (선택)">
        <el-tree-select
          v-model="form.categoryId"
          :data="categoryTreeData"
          :props="{ label: 'label', value: 'value', children: 'children' }"
          placeholder="루트에 배치"
          check-strictly
          clearable
          style="width: 100%"
          :disabled="!form.domainCode"
        />
      </el-form-item>

      <el-form-item label="별칭 (선택)">
        <el-input v-model="form.alias" placeholder="도메인 내에서 사용할 별칭" maxlength="200" />
      </el-form-item>

      <el-form-item label="메모 (선택)">
        <el-input v-model="form.note" type="textarea" :rows="2" placeholder="배치 사유" maxlength="500" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">취소</el-button>
      <el-button type="primary" :loading="submitting" @click="submit" :disabled="!form.domainCode">
        배치
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useDomainStore } from '@/stores/domain'
import { placementsApi } from '@/api/placements'
import { categoriesApi } from '@/api/categories'
import type { DomainMasterEntity, DomainCategoryEntity } from '@kms/shared'

const props = defineProps<{
  visible: boolean
  documentId: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  placed: []
}>()

const domainStore = useDomainStore()
const submitting = ref(false)
const categories = ref<DomainCategoryEntity[]>([])

const form = ref({
  domainCode: '',
  categoryId: null as number | null,
  alias: '',
  note: '',
})

interface TreeOption {
  label: string
  value: string | number
  children?: TreeOption[]
}

function buildDomainTree(domains: DomainMasterEntity[]): TreeOption[] {
  return domains.map((d) => ({
    label: d.displayName,
    value: d.code,
    children: d.children?.length ? buildDomainTree(d.children) : undefined,
  }))
}

function buildCategoryTree(cats: DomainCategoryEntity[]): TreeOption[] {
  return cats.map((c) => ({
    label: c.name,
    value: c.id,
    children: c.children?.length ? buildCategoryTree(c.children) : undefined,
  }))
}

const domainTreeData = computed(() => buildDomainTree(domainStore.domainTree))
const categoryTreeData = computed(() => buildCategoryTree(categories.value))

watch(() => props.visible, (v) => {
  if (v) {
    domainStore.loadDomains()
    form.value = { domainCode: '', categoryId: null, alias: '', note: '' }
    categories.value = []
  }
})

watch(() => form.value.domainCode, async (code) => {
  form.value.categoryId = null
  if (!code) {
    categories.value = []
    return
  }
  try {
    const res = await categoriesApi.getByDomain(code)
    categories.value = res.data
  } catch {
    categories.value = []
  }
})

async function submit() {
  if (!form.value.domainCode) return
  submitting.value = true
  try {
    await placementsApi.create({
      documentId: props.documentId,
      domainCode: form.value.domainCode,
      categoryId: form.value.categoryId ?? undefined,
      alias: form.value.alias || undefined,
      note: form.value.note || undefined,
    })
    ElMessage.success('배치되었습니다')
    emit('placed')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '배치 실패'
    ElMessage.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>
