<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import { FACET_TYPE_LABELS } from '@kms/shared'
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

const domain = ref<DomainMasterEntity | null>(null)
const facetOptions = ref<Record<string, FacetMasterEntity[]>>({})
const formValues = reactive<Record<string, string>>({})

const file = ref<File | null>(null)
const title = ref('')
const securityLevel = ref<SecurityLevel>('INTERNAL')
const validUntil = ref<string>('')
const loading = ref(false)

type CreateMode = 'upload' | 'metadata'
const createMode = ref<CreateMode>('upload')

function facetLabel(facetType: string): string {
  return FACET_TYPE_LABELS[facetType] ?? facetType
}

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
      const { data: domains } = await taxonomyApi.getDomainsFlat()
      domain.value = domains.find((dm) => dm.code === props.domainCode) ?? null

      if (!domain.value) {
        ElMessage.error(`도메인 '${props.domainCode}'을(를) 찾을 수 없습니다`)
        emit('update:visible', false)
        return
      }

      const required = requiredFacets()
      const fetches = required.map((facetType) =>
        taxonomyApi.getFacets(facetType, props.domainCode).then(({ data }) => ({ facetType, data })),
      )
      const results = await Promise.all(fetches)
      const opts: Record<string, FacetMasterEntity[]> = {}
      for (const { facetType, data } of results) {
        opts[facetType] = data.filter((f) => f.isActive)
      }
      facetOptions.value = opts

      // 초기값 채우기
      for (const facetType of required) {
        formValues[facetType] = props.initialFilters?.[facetType] ?? ''
      }
    } else {
      // 리셋
      file.value = null
      title.value = ''
      securityLevel.value = 'INTERNAL'
      validUntil.value = ''
      createMode.value = 'upload'
      for (const key of Object.keys(formValues)) {
        delete formValues[key]
      }
      facetOptions.value = {}
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

async function handleSubmit() {
  const required = requiredFacets()
  for (const facet of required) {
    if (!formValues[facet]) {
      ElMessage.warning(`${facetLabel(facet)}을(를) 선택하세요`)
      return
    }
  }

  if (createMode.value === 'upload' && !file.value) {
    ElMessage.warning('파일을 선택하세요')
    return
  }

  if (createMode.value === 'metadata' && !title.value.trim()) {
    ElMessage.warning('문서 제목을 입력하세요')
    return
  }

  const classifications: Record<string, string> = {}
  for (const [key, val] of Object.entries(formValues)) {
    if (val) classifications[key] = val
  }

  loading.value = true
  try {
    if (createMode.value === 'upload' && file.value) {
      await documentsApi.upload(file.value, {
        domain: props.domainCode,
        classifications,
        securityLevel: securityLevel.value,
        validUntil: validUntil.value || undefined,
      })
    } else {
      await documentsApi.createMetadata({
        domain: props.domainCode,
        classifications,
        securityLevel: securityLevel.value,
        title: title.value.trim(),
        validUntil: validUntil.value || undefined,
      })
    }
    ElMessage.success(createMode.value === 'upload' ? '업로드 완료' : '문서 생성 완료')
    emit('success')
    emit('update:visible', false)
  } catch (err: unknown) {
    const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '처리에 실패했습니다'
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
    title="문서 추가"
    width="520px"
    :close-on-click-modal="false"
  >
    <template #header>
      <span>문서 추가 — {{ domain?.displayName ?? domainCode }}</span>
    </template>

    <el-form label-width="90px">
      <!-- 생성 방식 -->
      <el-form-item label="추가 방식">
        <el-radio-group v-model="createMode">
          <el-radio-button value="upload">파일 업로드</el-radio-button>
          <el-radio-button value="metadata">나중에 첨부</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="도메인">
        <el-input :model-value="domain?.displayName ?? domainCode" disabled />
      </el-form-item>

      <!-- 동적 facet 필드 -->
      <el-form-item
        v-for="facetType in requiredFacets()"
        :key="facetType"
        :label="facetLabel(facetType)"
        :required="true"
      >
        <el-select
          v-model="formValues[facetType]"
          :placeholder="`${facetLabel(facetType)} 선택`"
          :disabled="isLocked(facetType)"
          filterable
          style="width: 100%"
        >
          <el-option
            v-for="opt in (facetOptions[facetType] ?? [])"
            :key="opt.code"
            :label="opt.displayName"
            :value="opt.code"
          />
        </el-select>
      </el-form-item>

      <!-- 보안등급 -->
      <el-form-item label="보안등급">
        <el-select v-model="securityLevel" style="width: 100%">
          <el-option
            v-for="opt in SECURITY_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <!-- 유효기간 -->
      <el-form-item label="유효기간">
        <el-date-picker
          v-model="validUntil"
          type="date"
          placeholder="선택사항"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          clearable
        />
        <div style="font-size: 12px; color: #909399; margin-top: 4px">
          설정 시 만료일 기준으로 신선도가 계산됩니다
        </div>
      </el-form-item>

      <!-- 파일 업로드 모드 -->
      <el-form-item v-if="createMode === 'upload'" label="파일" required>
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

      <!-- 메타데이터 모드: 제목 -->
      <el-form-item v-if="createMode === 'metadata'" label="문서 제목" required>
        <el-input v-model="title" placeholder="문서 제목을 입력하세요" />
        <div style="font-size: 12px; color: #909399; margin-top: 4px">
          파일은 나중에 첨부할 수 있습니다
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:visible', false)">취소</el-button>
      <el-button type="primary" :loading="loading" @click="handleSubmit">
        {{ createMode === 'upload' ? '업로드' : '생성' }}
      </el-button>
    </template>
  </el-dialog>
</template>
