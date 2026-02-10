<script setup lang="ts">
import { computed } from 'vue'
import { LIFECYCLE_LABELS, FRESHNESS_LABELS } from '@kms/shared'

interface TagConfig {
  type: '' | 'success' | 'info' | 'warning' | 'danger'
  label: string
  tooltip: string
}

const LIFECYCLE_CONFIG: Record<string, TagConfig> = {
  DRAFT: { type: 'info', label: LIFECYCLE_LABELS.DRAFT ?? '임시저장', tooltip: '작성 중인 문서입니다. 활성화 후 사용하세요.' },
  ACTIVE: { type: 'success', label: LIFECYCLE_LABELS.ACTIVE ?? '사용중', tooltip: '현재 유효한 문서입니다.' },
  DEPRECATED: { type: 'danger', label: LIFECYCLE_LABELS.DEPRECATED ?? '만료', tooltip: '만료된 문서입니다. 새 버전을 확인하세요.' },
}

const SECURITY_CONFIG: Record<string, TagConfig> = {
  PUBLIC: { type: 'success', label: '공개', tooltip: '전체 접근 가능한 문서입니다.' },
  INTERNAL: { type: '', label: '사내용', tooltip: '직원 이상만 열람 가능합니다.' },
  CONFIDENTIAL: { type: 'warning', label: '대외비', tooltip: '팀장 이상만 열람 가능합니다.' },
  SECRET: { type: 'danger', label: '기밀', tooltip: '임원 이상만 열람 가능합니다.' },
}

const FRESHNESS_CONFIG: Record<string, TagConfig> = {
  FRESH: { type: 'success', label: FRESHNESS_LABELS.FRESH ?? '정상', tooltip: '최근에 갱신된 문서입니다.' },
  WARNING: { type: 'warning', label: FRESHNESS_LABELS.WARNING ?? '갱신필요', tooltip: '갱신 주기가 다가오고 있습니다.' },
  EXPIRED: { type: 'danger', label: FRESHNESS_LABELS.EXPIRED ?? '만료됨', tooltip: '갱신 주기를 초과했습니다. 확인이 필요합니다.' },
}

const CONFIG_MAP: Record<string, Record<string, TagConfig>> = {
  lifecycle: LIFECYCLE_CONFIG,
  security: SECURITY_CONFIG,
  freshness: FRESHNESS_CONFIG,
}

const props = defineProps<{
  type: 'lifecycle' | 'security' | 'freshness'
  value: string
  size?: 'small' | 'default' | 'large'
}>()

const config = computed<TagConfig>(() => {
  return CONFIG_MAP[props.type]?.[props.value] ?? { type: 'info', label: props.value, tooltip: '' }
})
</script>

<template>
  <el-tooltip :content="config.tooltip" placement="top" :disabled="!config.tooltip">
    <el-tag :type="config.type" :size="size ?? 'small'">
      {{ config.label }}
    </el-tag>
  </el-tooltip>
</template>
