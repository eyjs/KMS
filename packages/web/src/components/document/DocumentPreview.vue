<script setup lang="ts">
import { computed } from 'vue'
import PdfViewer from '@/components/viewer/PdfViewer.vue'
import MarkdownViewer from '@/components/viewer/MarkdownViewer.vue'
import CsvViewer from '@/components/viewer/CsvViewer.vue'
import { LIFECYCLE_LABELS, FRESHNESS_LABELS, SECURITY_LEVEL_LABELS } from '@kms/shared'
import type { DocumentEntity } from '@kms/shared'
import { useFacetTypes } from '@/composables/useFacetTypes'

const props = defineProps<{
  document: DocumentEntity
}>()

const { facetLabel } = useFacetTypes()

const LIFECYCLE_TAG: Record<string, string> = {
  DRAFT: 'info',
  ACTIVE: 'success',
  DEPRECATED: 'danger',
}

const fileUrl = computed(() => props.document.downloadUrl)
</script>

<template>
  <div style="height: 100%; display: flex; flex-direction: column">
    <!-- 뷰어 영역 -->
    <div style="flex: 1; min-height: 200px; overflow: auto; border-bottom: 1px solid #ebeef5">
      <PdfViewer v-if="document.fileType === 'pdf'" :document-id="document.id" />
      <MarkdownViewer v-else-if="document.fileType === 'md'" :document-id="document.id" />
      <CsvViewer v-else-if="document.fileType === 'csv'" :document-id="document.id" />
      <div v-else style="display: flex; align-items: center; justify-content: center; height: 100%; color: #909399">
        미리보기를 지원하지 않는 형식입니다
      </div>
    </div>

    <!-- 메타데이터 -->
    <div style="padding: 12px; font-size: 12px">
      <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px">
        <el-tag :type="LIFECYCLE_TAG[document.lifecycle] ?? 'info'" size="small">
          {{ LIFECYCLE_LABELS[document.lifecycle] ?? document.lifecycle }}
        </el-tag>
        <el-tag
          :type="document.securityLevel === 'SECRET' ? 'danger' : document.securityLevel === 'CONFIDENTIAL' ? 'warning' : ''"
          size="small"
        >
          {{ SECURITY_LEVEL_LABELS[document.securityLevel] ?? document.securityLevel }}
        </el-tag>
        <el-tag
          v-if="document.freshness"
          :type="document.freshness === 'FRESH' ? 'success' : document.freshness === 'WARNING' ? 'warning' : 'danger'"
          size="small"
        >
          {{ FRESHNESS_LABELS[document.freshness] ?? document.freshness }}
        </el-tag>
      </div>
      <div style="color: #606266">
        <p v-if="document.docCode" style="margin: 4px 0; font-family: monospace">{{ document.docCode }}</p>
        <p style="margin: 4px 0">버전: v{{ document.versionMajor }}.{{ document.versionMinor }}</p>
        <p style="margin: 4px 0">크기: {{ (document.fileSize / 1024).toFixed(1) }} KB</p>
        <p style="margin: 4px 0">생성: {{ new Date(document.createdAt).toLocaleDateString('ko-KR') }}</p>
        <p v-if="document.validUntil" style="margin: 4px 0">
          유효기간: {{ new Date(document.validUntil).toLocaleDateString('ko-KR') }}
        </p>
      </div>
      <div v-if="Object.keys(document.classifications).length > 0" style="margin-top: 8px">
        <div style="color: #909399; margin-bottom: 4px">분류:</div>
        <div v-for="(value, key) in document.classifications" :key="key" style="color: #606266; margin-left: 8px">
          {{ facetLabel(String(key)) }}: {{ value }}
        </div>
      </div>
    </div>
  </div>
</template>
