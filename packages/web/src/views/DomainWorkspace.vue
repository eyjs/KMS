<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDomainStore } from '@/stores/domain'
import ClassificationTree from '@/components/domain/ClassificationTree.vue'
import DocumentTable from '@/components/document/DocumentTable.vue'
import DocumentPreview from '@/components/document/DocumentPreview.vue'
import UploadDialog from '@/components/domain/UploadDialog.vue'
import type { DocumentEntity } from '@kms/shared'

const route = useRoute()
const router = useRouter()
const domainStore = useDomainStore()

const domainCode = computed(() => route.params.domainCode as string)
const filters = ref<Record<string, string>>({})
const selectedDoc = ref<DocumentEntity | null>(null)
const showPreview = ref(true)
const showUpload = ref(false)
const activeTab = ref<'list' | 'graph'>('list')
const docTableRef = ref<InstanceType<typeof DocumentTable>>()

watch(domainCode, (code) => {
  if (code) {
    domainStore.setCurrentDomain(code)
    filters.value = {}
    selectedDoc.value = null
  }
}, { immediate: true })

function handleTreeSelect(treeFilters: Record<string, string>) {
  filters.value = treeFilters
  selectedDoc.value = null
}

function handleDocSelect(doc: DocumentEntity) {
  selectedDoc.value = doc
  showPreview.value = true
}

function handleDocDblClick(doc: DocumentEntity) {
  router.push(`/d/${domainCode.value}/doc/${doc.id}`)
}

function handleUploadSuccess() {
  showUpload.value = false
  docTableRef.value?.refresh()
}

function openUpload() {
  showUpload.value = true
}
</script>

<template>
  <div style="height: calc(100vh - 60px); display: flex; flex-direction: column">
    <!-- 상단 도구모음 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px">
      <div>
        <h2 style="margin: 0; font-size: 20px; display: inline">
          {{ domainStore.currentDomain?.displayName ?? domainCode }}
        </h2>
        <el-tag size="small" style="margin-left: 8px; vertical-align: middle">{{ domainCode }}</el-tag>
      </div>
      <div style="display: flex; gap: 8px; align-items: center">
        <el-button type="primary" size="small" @click="openUpload">
          업로드
        </el-button>
        <el-radio-group v-model="activeTab" size="small">
          <el-radio-button value="list">목록</el-radio-button>
          <el-radio-button value="graph">그래프</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 3-패널 레이아웃 -->
    <div style="flex: 1; display: flex; gap: 12px; min-height: 0">
      <!-- 왼쪽: 분류 트리 -->
      <el-card
        shadow="never"
        :body-style="{ padding: '0', height: '100%', overflow: 'hidden' }"
        style="width: 250px; flex-shrink: 0"
      >
        <ClassificationTree
          :domain-code="domainCode"
          @select="handleTreeSelect"
        />
      </el-card>

      <!-- 중앙: 문서 목록 or 그래프 -->
      <div style="flex: 1; min-width: 0">
        <el-card
          shadow="never"
          :body-style="{ padding: '12px', height: '100%', overflow: 'auto' }"
          style="height: 100%"
        >
          <template v-if="activeTab === 'list'">
            <DocumentTable
              ref="docTableRef"
              :domain-code="domainCode"
              :filters="filters"
              @select="handleDocSelect"
              @dblclick="handleDocDblClick"
            />
          </template>
          <template v-else>
            <div style="display: flex; align-items: center; justify-content: center; height: 100%">
              <el-empty description="관계 그래프는 추후 구현 예정입니다" />
            </div>
          </template>
        </el-card>
      </div>

      <!-- 오른쪽: 미리보기 -->
      <transition name="el-fade-in">
        <el-card
          v-if="showPreview && selectedDoc"
          shadow="never"
          :body-style="{ padding: '0', height: '100%', overflow: 'auto' }"
          style="width: 350px; flex-shrink: 0"
        >
          <div style="padding: 8px 12px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ebeef5">
            <span style="font-size: 13px; font-weight: 600; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px">
              {{ selectedDoc.fileName }}
            </span>
            <el-button text size="small" @click="showPreview = false">닫기</el-button>
          </div>
          <DocumentPreview :document="selectedDoc" />
        </el-card>
      </transition>
    </div>

    <!-- 업로드 다이얼로그 -->
    <UploadDialog
      v-model:visible="showUpload"
      :domain-code="domainCode"
      :initial-filters="filters"
      @success="handleUploadSuccess"
    />
  </div>
</template>
