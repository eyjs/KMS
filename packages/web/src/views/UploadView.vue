<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { useAuthStore } from '@/stores/auth'
import type { DomainMasterEntity, FacetMasterEntity, SecurityLevel } from '@kms/shared'
import { ElMessage } from 'element-plus'

const router = useRouter()
const auth = useAuthStore()

const domains = ref<DomainMasterEntity[]>([])
const carriers = ref<FacetMasterEntity[]>([])
const products = ref<FacetMasterEntity[]>([])
const docTypes = ref<FacetMasterEntity[]>([])

const file = ref<File | null>(null)
const form = reactive({
  domain: '',
  carrier: '',
  product: '',
  docType: '',
  securityLevel: 'INTERNAL' as SecurityLevel,
})
const loading = ref(false)

const SECURITY_OPTIONS = [
  { value: 'PUBLIC', label: '공개 - 외부업체 포함 누구나' },
  { value: 'INTERNAL', label: '사내용 - 직원 이상' },
  { value: 'CONFIDENTIAL', label: '대외비(2급) - 팀장 이상' },
  { value: 'SECRET', label: '기밀(1급) - 임원 이상' },
]

onMounted(async () => {
  const [d, c, p, dt] = await Promise.all([
    taxonomyApi.getDomains(),
    taxonomyApi.getFacets('carrier'),
    taxonomyApi.getFacets('product'),
    taxonomyApi.getFacets('docType'),
  ])
  domains.value = d.data
  carriers.value = c.data
  products.value = p.data
  docTypes.value = dt.data
})

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
  if (!form.domain) {
    ElMessage.warning('도메인을 선택하세요')
    return
  }

  const classifications: Record<string, string> = {}
  if (form.carrier) classifications.carrier = form.carrier
  if (form.product) classifications.product = form.product
  if (form.docType) classifications.docType = form.docType

  loading.value = true
  try {
    const { data } = await documentsApi.upload(file.value, {
      domain: form.domain,
      classifications,
      securityLevel: form.securityLevel,
    })
    ElMessage.success('업로드 완료')
    router.push(`/documents/${data.id}`)
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '업로드에 실패했습니다'
    ElMessage.error(message)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h2>문서 업로드</h2>

    <el-card style="max-width: 600px">
      <el-form label-width="100px">
        <!-- 파일 -->
        <el-form-item label="파일">
          <el-upload
            :auto-upload="false"
            :limit="1"
            accept=".pdf,.md,.csv"
            @change="handleFileChange"
            drag
          >
            <div style="padding: 20px">
              <p>파일을 드래그하거나 클릭하세요</p>
              <p style="color: #909399; font-size: 12px">PDF, Markdown, CSV만 가능</p>
            </div>
          </el-upload>
        </el-form-item>

        <!-- 도메인 -->
        <el-form-item label="도메인" required>
          <el-select v-model="form.domain" placeholder="도메인 선택">
            <el-option v-for="d in domains" :key="d.code" :label="d.displayName" :value="d.code" />
          </el-select>
        </el-form-item>

        <!-- 보험사 -->
        <el-form-item label="보험사">
          <el-select v-model="form.carrier" placeholder="보험사 선택" clearable filterable>
            <el-option v-for="c in carriers" :key="c.code" :label="c.displayName" :value="c.code" />
          </el-select>
        </el-form-item>

        <!-- 상품 -->
        <el-form-item label="상품">
          <el-select v-model="form.product" placeholder="상품 선택" clearable filterable>
            <el-option v-for="p in products" :key="p.code" :label="p.displayName" :value="p.code" />
          </el-select>
        </el-form-item>

        <!-- 문서유형 -->
        <el-form-item label="문서유형">
          <el-select v-model="form.docType" placeholder="문서유형 선택" clearable filterable>
            <el-option v-for="dt in docTypes" :key="dt.code" :label="dt.displayName" :value="dt.code" />
          </el-select>
        </el-form-item>

        <!-- 보안 등급 -->
        <el-form-item label="보안등급">
          <el-select v-model="form.securityLevel">
            <el-option
              v-for="opt in SECURITY_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>

        <!-- 업로드 -->
        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleUpload">
            업로드
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
