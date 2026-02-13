<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { documentsApi } from '@/api/documents'
import { relationsApi } from '@/api/relations'
import { placementsApi } from '@/api/placements'
import { LIFECYCLE_LABELS, SECURITY_LEVEL_LABELS, FRESHNESS_LABELS, RELATION_TYPE_LABELS } from '@kms/shared'
import type { DocumentEntity, DocumentPlacementEntity, RelationEntity } from '@kms/shared'

const props = defineProps<{
  visible: boolean
  nodeId: string | null
  domainCode?: string
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'navigate', docId: string): void
}>()

const router = useRouter()

const loading = ref(false)
const doc = ref<DocumentEntity | null>(null)
const relations = ref<{ asSource: RelationEntity[]; asTarget: RelationEntity[] }>({ asSource: [], asTarget: [] })
const placements = ref<DocumentPlacementEntity[]>([])

interface RelationWithInclude extends RelationEntity {
  target?: { fileName?: string }
  source?: { fileName?: string }
}

const allRelations = computed(() => {
  const result: Array<{ id: string; type: string; fileName: string; docId: string; domainCode: string | null }> = []
  for (const r of relations.value.asSource as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.target?.fileName ?? r.targetId.slice(0, 8),
      docId: r.targetId,
      domainCode: r.domainCode,
    })
  }
  for (const r of relations.value.asTarget as RelationWithInclude[]) {
    result.push({
      id: r.id,
      type: r.relationType,
      fileName: r.source?.fileName ?? r.sourceId.slice(0, 8),
      docId: r.sourceId,
      domainCode: r.domainCode,
    })
  }
  return result
})

const lifecycleTagType = computed(() => {
  if (!doc.value) return 'info'
  if (doc.value.lifecycle === 'ACTIVE') return 'success'
  if (doc.value.lifecycle === 'DEPRECATED') return 'danger'
  return 'info'
})

const securityTagType = computed(() => {
  if (!doc.value) return ''
  if (doc.value.securityLevel === 'SECRET') return 'danger'
  if (doc.value.securityLevel === 'CONFIDENTIAL') return 'warning'
  return ''
})

watch(() => [props.visible, props.nodeId], async ([visible, nodeId]) => {
  if (!visible || !nodeId) return

  loading.value = true
  try {
    const [docRes, relRes, placRes] = await Promise.allSettled([
      documentsApi.get(nodeId as string),
      relationsApi.getByDocument(nodeId as string),
      placementsApi.getByDocument(nodeId as string),
    ])
    doc.value = docRes.status === 'fulfilled' ? docRes.value.data : null
    relations.value = relRes.status === 'fulfilled' ? relRes.value.data : { asSource: [], asTarget: [] }
    placements.value = placRes.status === 'fulfilled' ? placRes.value.data : []
  } catch {
    doc.value = null
  } finally {
    loading.value = false
  }
})

function handleClosed() {
  doc.value = null
  relations.value = { asSource: [], asTarget: [] }
  placements.value = []
}

function goToDetail() {
  if (!doc.value) return
  const domain = props.domainCode || '_'
  router.push(`/d/${domain}/doc/${doc.value.id}`)
}

function handleRelationClick(docId: string) {
  emit('navigate', docId)
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    direction="rtl"
    size="360px"
    :show-close="true"
    :with-header="true"
    @update:model-value="$emit('update:visible', $event)"
    @closed="handleClosed"
  >
    <template #header>
      <span style="font-weight: 600; font-size: 15px">문서 정보</span>
    </template>

    <div v-loading="loading" style="min-height: 200px">
      <template v-if="doc">
        <!-- 파일명 -->
        <div style="font-size: 15px; font-weight: 600; color: #303133; word-break: break-all; margin-bottom: 4px">
          {{ doc.fileName ?? '(제목 없음)' }}
        </div>
        <div v-if="doc.docCode" style="font-family: monospace; font-size: 13px; color: #409eff; margin-bottom: 12px">
          {{ doc.docCode }}
        </div>

        <!-- 상태 태그 -->
        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px">
          <el-tag :type="lifecycleTagType" size="small">
            {{ LIFECYCLE_LABELS[doc.lifecycle] ?? doc.lifecycle }}
          </el-tag>
          <el-tag :type="securityTagType" size="small">
            {{ SECURITY_LEVEL_LABELS[doc.securityLevel] ?? doc.securityLevel }}
          </el-tag>
          <el-tag
            v-if="doc.freshness"
            :type="doc.freshness === 'FRESH' ? 'success' : doc.freshness === 'WARNING' ? 'warning' : 'danger'"
            size="small"
          >
            {{ FRESHNESS_LABELS[doc.freshness] ?? doc.freshness }}
          </el-tag>
        </div>

        <!-- 문서 정보 -->
        <div style="font-size: 13px; color: #606266; margin-bottom: 16px">
          <p style="margin: 6px 0"><strong>버전:</strong> v{{ doc.versionMajor }}.{{ doc.versionMinor }}</p>
          <p style="margin: 6px 0"><strong>형식:</strong> {{ doc.fileType?.toUpperCase() ?? '-' }}</p>
          <p style="margin: 6px 0"><strong>크기:</strong> {{ doc.downloadUrl ? (doc.fileSize / 1024).toFixed(1) + ' KB' : '-' }}</p>
          <p style="margin: 6px 0"><strong>생성일:</strong> {{ new Date(doc.createdAt).toLocaleString('ko-KR') }}</p>
          <p style="margin: 6px 0"><strong>수정일:</strong> {{ new Date(doc.updatedAt).toLocaleString('ko-KR') }}</p>
          <p style="margin: 6px 0">
            <strong>유효기간:</strong>
            {{ doc.validUntil ? new Date(doc.validUntil).toLocaleDateString('ko-KR') : '미설정' }}
          </p>
        </div>

        <!-- 배치 정보 -->
        <el-divider style="margin: 12px 0" />
        <div style="font-size: 13px; margin-bottom: 16px">
          <div style="font-weight: 600; color: #303133; margin-bottom: 8px">배치된 도메인</div>
          <div v-if="placements.length > 0">
            <div
              v-for="p in placements"
              :key="p.id"
              style="display: flex; align-items: center; gap: 6px; margin: 4px 0 4px 8px; color: #606266"
            >
              <span style="color: #409eff">{{ p.domainName ?? p.domainCode }}</span>
              <span v-if="p.categoryName" style="color: #909399; font-size: 12px">/ {{ p.categoryName }}</span>
            </div>
          </div>
          <div v-else style="margin-left: 8px; color: #909399">미배치 (고아 문서)</div>
        </div>

        <!-- 관계 정보 -->
        <el-divider style="margin: 12px 0" />
        <div style="font-size: 13px; margin-bottom: 16px">
          <div style="font-weight: 600; color: #303133; margin-bottom: 8px">
            관련 문서 <el-tag size="small" round>{{ allRelations.length }}</el-tag>
          </div>
          <div v-if="allRelations.length > 0" style="max-height: 200px; overflow-y: auto">
            <div
              v-for="rel in allRelations"
              :key="rel.id"
              class="relation-row"
            >
              <el-tag size="small" type="info">{{ RELATION_TYPE_LABELS[rel.type] ?? rel.type }}</el-tag>
              <span class="relation-link" @click="handleRelationClick(rel.docId)">
                {{ rel.fileName }}
              </span>
            </div>
          </div>
          <div v-else style="margin-left: 8px; color: #909399">관련 문서 없음</div>
        </div>

        <!-- 하단 버튼 -->
        <el-divider style="margin: 12px 0" />
        <el-button type="primary" style="width: 100%" @click="goToDetail">
          상세 페이지 이동
        </el-button>
      </template>

      <div v-else-if="!loading" style="text-align: center; color: #909399; padding: 40px 0">
        문서 정보를 불러올 수 없습니다
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.relation-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid #f5f5f5;
}

.relation-row:last-child {
  border-bottom: none;
}

.relation-link {
  font-size: 13px;
  color: #303133;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.relation-link:hover {
  color: #409eff;
}
</style>
