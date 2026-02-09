<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import type { FacetMasterEntity, SecurityLevel, DomainMasterEntity } from '@kms/shared'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  visible: boolean
  domainCode: string
  initialFilters?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

const domains = ref<DomainMasterEntity[]>([])
const carriers = ref<FacetMasterEntity[]>([])
const products = ref<FacetMasterEntity[]>([])
const docTypes = ref<FacetMasterEntity[]>([])
const domain = ref<DomainMasterEntity | null>(null)

const file = ref<File | null>(null)
const form = reactive({
  carrier: '',
  product: '',
  docType: '',
  securityLevel: 'INTERNAL' as SecurityLevel,
})
const loading = ref(false)

const SECURITY_OPTIONS = [
  { value: 'PUBLIC', label: '공개 - 외부업체 포함' },
  { value: 'INTERNAL', label: '사내용 - 직원 이상' },
  { value: 'CONFIDENTIAL', label: '대외비(2급) - 팀장 이상' },
  { value: 'SECRET', label: '기밀(1급) - 임원 이상' },
]

watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      const [d, c, p, dt] = await Promise.all([
        taxonomyApi.getDomains(),
        taxonomyApi.getFacets('carrier', props.domainCode),
        taxonomyApi.getFacets('product', props.domainCode),
        taxonomyApi.getFacets('docType', props.domainCode),
      ])
      domains.value = d.data
      domain.value = d.data.find((dm) => dm.code === props.domainCode) ?? null
      carriers.value = c.data.filter((f) => f.isActive)
      products.value = p.data.filter((f) => f.isActive)
      docTypes.value = dt.data.filter((f) => f.isActive)

      // 트리에서 선택된 값 자동 채움
      if (props.initialFilters) {
        form.carrier = props.initialFilters.carrier ?? ''
        form.product = props.initialFilters.product ?? ''
        form.docType = props.initialFilters.docType ?? ''
      }
    } else {
      file.value = null
      form.carrier = ''
      form.product = ''
      form.docType = ''
      form.securityLevel = 'INTERNAL'
    }
  },
)

function requiredFacets(): string[] {
  return (domain.value?.requiredFacets as string[]) ?? []
}

function isLocked(facetType: string): boolean {
  return !!(props.initialFilters && props.initialFilters[facetType])
}

function handleFileChange(uploadFile: { raw: File }) {
  const f = uploadFile.raw
  const ext = f.name.split('.').pop()?.toLowerCase()
  if (!ext || !['pdf', 'md', 'csv'].includes(ext)) {
    ElMessage.error('PDF, Markdown, CSV 파일만 업로드 가능합니다')
    return
  }
  file.value = f
}

async function handleUpload() {
  if (!file.value) {
    ElMessage.warning('파일을 선택하세요')
    return
  }

  const required = requiredFacets()
  for (const facet of required) {
    const val = form[facet as keyof typeof form]
    if (!val) {
      ElMessage.warning(`${facet}을(를) 선택하세요`)
      return
    }
  }

  const classifications: Record<string, string> = {}
  if (form.carrier) classifications.carrier = form.carrier
  if (form.product) classifications.product = form.product
  if (form.docType) classifications.docType = form.docType

  loading.value = true
  try {
    await documentsApi.upload(file.value, {
      domain: props.domainCode,
      classifications,
      securityLevel: form.securityLevel,
    })
    ElMessage.success('업로드 완료')
    emit('success')
    emit('update:visible', false)
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '업로드에 실패했습니다'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="문서 업로드"
    width="500px"
    :close-on-click-modal="false"
  >
    <template #header>
      <span>문서 업로드 — {{ domain?.displayName ?? domainCode }}</span>
    </template>

    <el-form label-width="80px">
      <el-form-item label="도메인">
        <el-input :model-value="domain?.displayName ?? domainCode" disabled />
      </el-form-item>

      <!-- 보험사 -->
      <el-form-item
        v-if="requiredFacets().includes('carrier')"
        label="보험사"
        :required="true"
      >
        <el-select
          v-model="form.carrier"
          placeholder="보험사 선택"
          :disabled="isLocked('carrier')"
          filterable
          style="width: 100%"
        >
          <el-option v-for="c in carriers" :key="c.code" :label="c.displayName" :value="c.code" />
        </el-select>
      </el-form-item>

      <!-- 상품 -->
      <el-form-item
        v-if="requiredFacets().includes('product')"
        label="상품"
        :required="true"
      >
        <el-select
          v-model="form.product"
          placeholder="상품 선택"
          :disabled="isLocked('product')"
          filterable
          style="width: 100%"
        >
          <el-option v-for="p in products" :key="p.code" :label="p.displayName" :value="p.code" />
        </el-select>
      </el-form-item>

      <!-- 문서유형 -->
      <el-form-item
        v-if="requiredFacets().includes('docType')"
        label="문서유형"
        :required="true"
      >
        <el-select
          v-model="form.docType"
          placeholder="문서유형 선택"
          :disabled="isLocked('docType')"
          filterable
          style="width: 100%"
        >
          <el-option v-for="dt in docTypes" :key="dt.code" :label="dt.displayName" :value="dt.code" />
        </el-select>
      </el-form-item>

      <!-- 보안등급 -->
      <el-form-item label="보안등급">
        <el-select v-model="form.securityLevel" style="width: 100%">
          <el-option
            v-for="opt in SECURITY_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <!-- 파일 -->
      <el-form-item label="파일" required>
        <el-upload
          :auto-upload="false"
          :limit="1"
          accept=".pdf,.md,.csv"
          @change="handleFileChange"
          drag
          style="width: 100%"
        >
          <div style="padding: 16px">
            <p style="margin: 0">파일을 드래그하거나 클릭하세요</p>
            <p style="color: #909399; font-size: 12px; margin: 4px 0 0">PDF, Markdown, CSV만 허용</p>
          </div>
        </el-upload>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">취소</el-button>
      <el-button type="primary" :loading="loading" @click="handleUpload">업로드</el-button>
    </template>
  </el-dialog>
</template>
