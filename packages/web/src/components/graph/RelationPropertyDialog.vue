<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { knowledgeGraphApi } from '@/api/knowledge-graph'
import type { RelationPropertyEntity } from '@kms/shared'

const props = defineProps<{
  visible: boolean
  relationId: string | null
  relationType: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'saved'): void
}>()

const loading = ref(false)
const saving = ref(false)
const properties = ref<RelationPropertyEntity[]>([])

// 프레임워크 표준 속성 키 정의
const PROPERTY_KEYS = [
  {
    key: 'strength',
    label: '관계 강도',
    description: '두 문서 간 관계의 중요도 (1-10)',
    type: 'slider',
    min: 1,
    max: 10,
    default: '5',
  },
  {
    key: 'reason',
    label: '관계 이유',
    description: '이 관계를 설정한 이유를 설명합니다',
    type: 'textarea',
    placeholder: '예: 상품 약관의 세부 구현 가이드 문서입니다',
    default: '',
  },
  {
    key: 'validUntil',
    label: '유효기간',
    description: '이 관계가 유효한 기간 (선택)',
    type: 'date',
    default: '',
  },
  {
    key: 'confidence',
    label: '신뢰도',
    description: '관계의 신뢰 수준',
    type: 'select',
    options: [
      { value: 'manual', label: '수동 설정 (확실함)' },
      { value: 'auto', label: '자동 추출 (검증됨)' },
      { value: 'suggested', label: 'AI 추천 (검토 필요)' },
    ],
    default: 'manual',
  },
  {
    key: 'createdByType',
    label: '생성 방식',
    description: '이 관계가 어떻게 생성되었는지',
    type: 'select',
    options: [
      { value: 'user', label: '사용자가 직접 설정' },
      { value: 'system', label: '시스템 자동 설정' },
      { value: 'ai', label: 'AI가 추천' },
    ],
    default: 'user',
  },
] as const

// 폼 데이터 (키별 값)
const formData = ref<Record<string, string>>({})

// 다이얼로그 표시 여부
const dialogVisible = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
})

// 관계 유형 한국어 라벨
const relationTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    PARENT_OF: '상위 문서',
    CHILD_OF: '하위 문서',
    SIBLING: '형제 문서',
    REFERENCE: '참조 문서',
    SUPERSEDES: '대체 문서',
    REFERENCED_BY: '피참조 문서',
    SUPERSEDED_BY: '피대체 문서',
  }
  return labels[props.relationType] ?? props.relationType
})

// 속성 로드
async function loadProperties() {
  if (!props.relationId) return

  loading.value = true
  try {
    const response = await knowledgeGraphApi.getRelationProperties(props.relationId)
    properties.value = response.data

    // 폼 데이터 초기화 (기존 값 + 기본값)
    const newFormData: Record<string, string> = {}
    for (const key of PROPERTY_KEYS) {
      const existing = properties.value.find((p) => p.key === key.key)
      newFormData[key.key] = existing?.value ?? key.default
    }
    formData.value = newFormData
  } catch (error) {
    console.error('Failed to load properties:', error)
  } finally {
    loading.value = false
  }
}

// 저장
async function handleSave() {
  if (!props.relationId) return

  saving.value = true
  try {
    // 변경된 속성만 저장
    for (const keyDef of PROPERTY_KEYS) {
      const newValue = formData.value[keyDef.key]
      const existing = properties.value.find((p) => p.key === keyDef.key)

      if (newValue && newValue !== keyDef.default) {
        // 값이 있고 기본값이 아니면 저장
        await knowledgeGraphApi.setRelationProperty(props.relationId, keyDef.key, newValue)
      } else if (existing && (!newValue || newValue === keyDef.default)) {
        // 기존에 있었는데 비워졌거나 기본값이면 삭제
        await knowledgeGraphApi.deleteRelationProperty(props.relationId, keyDef.key)
      }
    }

    ElMessage.success('관계 속성이 저장되었습니다')
    emit('saved')
    dialogVisible.value = false
  } catch (error) {
    console.error('Failed to save properties:', error)
    ElMessage.error('저장에 실패했습니다')
  } finally {
    saving.value = false
  }
}

// visible 변경 시 속성 로드
watch(() => props.visible, (visible) => {
  if (visible && props.relationId) {
    loadProperties()
  }
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="관계 속성 설정"
    width="520px"
    :close-on-click-modal="false"
  >
    <template #header>
      <div style="display: flex; align-items: center; gap: 8px">
        <span>관계 속성 설정</span>
        <el-tag size="small" type="info">{{ relationTypeLabel }}</el-tag>
      </div>
    </template>

    <div v-loading="loading" style="min-height: 200px">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        <template #title>
          관계에 의미를 부여하세요
        </template>
        <span style="font-size: 12px">
          이 속성들은 AI가 문서 관계를 이해하는 데 활용됩니다.
          필요한 항목만 설정하면 됩니다.
        </span>
      </el-alert>

      <el-form label-position="top" style="margin-top: 8px">
        <!-- 관계 강도 -->
        <el-form-item>
          <template #label>
            <div style="display: flex; justify-content: space-between; width: 100%">
              <span>관계 강도</span>
              <span style="color: #909399; font-size: 12px">{{ formData.strength || '5' }}/10</span>
            </div>
          </template>
          <el-slider
            v-model.number="formData.strength"
            :min="1"
            :max="10"
            :step="1"
            show-stops
            :marks="{ 1: '약함', 5: '보통', 10: '강함' }"
          />
          <div style="color: #909399; font-size: 12px; margin-top: 4px">
            두 문서 간 관계의 중요도를 나타냅니다
          </div>
        </el-form-item>

        <!-- 관계 이유 -->
        <el-form-item label="관계 이유">
          <el-input
            v-model="formData.reason"
            type="textarea"
            :rows="2"
            placeholder="예: 상품 약관의 세부 구현 가이드 문서입니다"
          />
          <div style="color: #909399; font-size: 12px; margin-top: 4px">
            이 관계를 설정한 이유를 AI가 참고합니다
          </div>
        </el-form-item>

        <!-- 유효기간 -->
        <el-form-item label="유효기간 (선택)">
          <el-date-picker
            v-model="formData.validUntil"
            type="date"
            placeholder="선택하지 않으면 무기한"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>

        <!-- 신뢰도 -->
        <el-form-item label="신뢰도">
          <el-radio-group v-model="formData.confidence">
            <el-radio-button value="manual">확실함</el-radio-button>
            <el-radio-button value="auto">검증됨</el-radio-button>
            <el-radio-button value="suggested">검토 필요</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <!-- 생성 방식 (읽기 전용 표시) -->
        <el-form-item label="생성 방식">
          <el-tag
            :type="formData.createdByType === 'user' ? 'primary' : formData.createdByType === 'ai' ? 'warning' : 'info'"
          >
            {{ formData.createdByType === 'user' ? '사용자 설정' : formData.createdByType === 'ai' ? 'AI 추천' : '시스템 설정' }}
          </el-tag>
        </el-form-item>
      </el-form>
    </div>

    <template #footer>
      <el-button @click="dialogVisible = false">취소</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">
        저장
      </el-button>
    </template>
  </el-dialog>
</template>
