<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { documentsApi } from '@/api/documents'
import { taxonomyApi } from '@/api/taxonomy'
import type { FacetMasterEntity, SecurityLevel, DomainMasterEntity, DocumentEntity } from '@kms/shared'
import { useFacetTypes } from '@/composables/useFacetTypes'
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

// 중복 체크
const duplicateDoc = ref<DocumentEntity | null>(null)
const duplicateChecking = ref(false)
let duplicateTimer: ReturnType<typeof setTimeout> | null = null

const { facetLabel } = useFacetTypes()

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
      duplicateDoc.value = null
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
      duplicateDoc.value = null
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

// 분류 선택이 모두 완료되면 중복 체크
const allFacetsSelected = computed(() => {
  const required = requiredFacets()
  if (required.length === 0) return false
  return required.every((ft) => !!formValues[ft])
})

watch(
  () => ({ ...formValues }),
  () => {
    if (duplicateTimer) clearTimeout(duplicateTimer)
    if (!allFacetsSelected.value) {
      duplicateDoc.value = null
      return
    }
    duplicateTimer = setTimeout(async () => {
      duplicateChecking.value = true
      try {
        const classifications: Record<string, string> = {}
        for (const ft of requiredFacets()) {
          if (formValues[ft]) classifications[ft] = formValues[ft]
        }
        const { data } = await documentsApi.checkDuplicate(props.domainCode, classifications)
        duplicateDoc.value = data
      } catch {
        duplicateDoc.value = null
      } finally {
        duplicateChecking.value = false
      }
    }, 300)
  },
  { deep: true },
)

// 분류 경로를 한국어 displayName으로 변환
function classificationPath(): string {
  const parts: string[] = []
  for (const ft of requiredFacets()) {
    const code = formValues[ft]
    if (!code) continue
    const options = facetOptions.value[ft] ?? []
    const match = options.find((o) => o.code === code)
    parts.push(match?.displayName ?? code)
  }
  return parts.join(' > ')
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
    const msg = duplicateDoc.value
      ? '업로드 완료 — 기존 문서는 자동 만료 처리되었습니다'
      : (createMode.value === 'upload' ? '업로드 완료' : '문서 생성 완료')
    ElMessage.success(msg)
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

      <!-- 중복 경고 -->
      <el-alert
        v-if="duplicateDoc"
        type="warning"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        <template #title>
          <strong>{{ classificationPath() }}</strong> 경로에 사용중인 문서가 있습니다
        </template>
        <div style="margin-top: 4px; font-size: 12px; line-height: 1.6">
          <div>{{ duplicateDoc.fileName ?? '(파일 없음)' }}
            <span v-if="duplicateDoc.docCode" style="font-family: monospace; color: #909399; margin-left: 4px">{{ duplicateDoc.docCode }}</span>
          </div>
          <div style="color: #e6a23c">계속 등록하면 기존 문서는 자동으로 만료 처리됩니다</div>
        </div>
      </el-alert>

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
      <el-button
        :type="duplicateDoc ? 'warning' : 'primary'"
        :loading="loading"
        @click="handleSubmit"
      >
        {{ duplicateDoc ? '대체 등록' : (createMode === 'upload' ? '업로드' : '생성') }}
      </el-button>
    </template>
  </el-dialog>
</template>
