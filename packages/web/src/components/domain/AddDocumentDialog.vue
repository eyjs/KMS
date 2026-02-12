<script setup lang="ts">
/**
 * 통합 문서 추가 다이얼로그
 * - 탭 1: 새 파일 업로드 + 현재 도메인에 배치
 * - 탭 2: 기존 문서 검색 (DocumentExplorer) + 현재 도메인에 배치
 */
import { ref, watch, computed } from 'vue'
import { UploadFilled, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/api/documents'
import { placementsApi } from '@/api/placements'
import { categoriesApi } from '@/api/categories'
import { SECURITY_LEVEL_LABELS } from '@kms/shared'
import type { UploadFile } from 'element-plus'
import type { DomainCategoryEntity } from '@kms/shared'
import DocumentExplorer from '@/components/document/DocumentExplorer.vue'

const props = defineProps<{
  visible: boolean
  domainCode: string
  domainName: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  success: []
}>()

// 탭: upload(새 파일) | existing(기존 문서)
const activeTab = ref<'upload' | 'existing'>('upload')

// 카테고리
const categories = ref<DomainCategoryEntity[]>([])
const selectedCategoryId = ref<number | null>(null)
const loadingCategories = ref(false)

// === 업로드 탭 ===
const uploading = ref(false)
const selectedFiles = ref<File[]>([])
const fileList = ref<UploadFile[]>([])
const uploadResults = ref<Array<{
  fileName: string
  success: boolean
  docCode?: string | null
  error?: string
}>>([])

const uploadForm = ref({
  securityLevel: 'INTERNAL',
  validUntil: '',
})

function onFileChange(file: UploadFile) {
  if (file.raw) {
    selectedFiles.value.push(file.raw)
  }
}

function onFileRemove(file: UploadFile) {
  const idx = selectedFiles.value.findIndex((f) => f.name === file.name)
  if (idx >= 0) selectedFiles.value.splice(idx, 1)
}

async function submitUpload() {
  if (selectedFiles.value.length === 0) return
  uploading.value = true
  uploadResults.value = []

  try {
    // 1. 파일 업로드
    let uploadedDocs: Array<{ id: string; fileName: string; docCode?: string | null }> = []

    if (selectedFiles.value.length === 1) {
      const file = selectedFiles.value[0]
      try {
        const res = await documentsApi.upload(file, {
          securityLevel: uploadForm.value.securityLevel,
          validUntil: uploadForm.value.validUntil || undefined,
        })
        uploadedDocs = [{ id: res.data.id, fileName: file.name, docCode: res.data.docCode }]
        uploadResults.value = [{
          fileName: file.name,
          success: true,
          docCode: res.data.docCode,
        }]
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '업로드 실패'
        uploadResults.value = [{ fileName: file.name, success: false, error: msg }]
      }
    } else {
      const res = await documentsApi.bulkUpload(selectedFiles.value, uploadForm.value.securityLevel)
      uploadedDocs = res.data.results
        .filter((r) => r.success && r.documentId)
        .map((r) => ({ id: r.documentId!, fileName: r.fileName, docCode: r.docCode }))
      uploadResults.value = res.data.results.map((r) => ({
        fileName: r.fileName,
        success: r.success,
        docCode: r.docCode,
        error: r.error,
      }))
    }

    // 2. 업로드된 문서를 현재 도메인에 배치
    if (uploadedDocs.length > 0) {
      const placementResult = await placementsApi.bulkCreate({
        documentIds: uploadedDocs.map((d) => d.id),
        domainCode: props.domainCode,
        categoryId: selectedCategoryId.value ?? undefined,
      })

      const successCount = uploadResults.value.filter((r) => r.success).length
      ElMessage.success(`${successCount}개 파일 업로드 및 "${props.domainName}"에 배치 완료`)
      emit('success')
    }
  } catch {
    ElMessage.error('업로드 실패')
  } finally {
    uploading.value = false
  }
}

// === 기존 문서 탭 ===
const selectedDocIds = ref<string[]>([])
const placementLoading = ref(false)

async function submitPlacement() {
  if (selectedDocIds.value.length === 0) {
    ElMessage.warning('문서를 선택해 주세요')
    return
  }
  placementLoading.value = true
  try {
    const result = await placementsApi.bulkCreate({
      documentIds: selectedDocIds.value,
      domainCode: props.domainCode,
      categoryId: selectedCategoryId.value ?? undefined,
    })

    if (result.data.success > 0) {
      ElMessage.success(`${result.data.success}건 "${props.domainName}"에 배치 완료`)
    }
    if (result.data.failed > 0) {
      ElMessage.warning(`${result.data.failed}건 실패 (이미 배치됨)`)
    }
    emit('success')
    emit('update:visible', false)
  } catch {
    ElMessage.error('배치 실패')
  } finally {
    placementLoading.value = false
  }
}

// 카테고리 트리 데이터
interface CascaderNode {
  value: number
  label: string
  children?: CascaderNode[]
}

function buildCategoryTree(cats: DomainCategoryEntity[]): CascaderNode[] {
  const map = new Map<number, CascaderNode & { children: CascaderNode[] }>()
  const roots: CascaderNode[] = []

  for (const cat of cats) {
    map.set(cat.id, { value: cat.id, label: cat.name, children: [] })
  }

  for (const cat of cats) {
    const node = map.get(cat.id)!
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function clean(nodes: CascaderNode[]) {
    for (const n of nodes) {
      if (n.children && n.children.length === 0) {
        delete n.children
      } else if (n.children) {
        clean(n.children)
      }
    }
  }
  clean(roots)
  return roots
}

const categoryTree = computed(() => buildCategoryTree(categories.value))

// 다이얼로그 열릴 때 초기화
watch(
  () => props.visible,
  async (v) => {
    if (v) {
      activeTab.value = 'upload'
      // 업로드 탭 초기화
      selectedFiles.value = []
      fileList.value = []
      uploadResults.value = []
      uploadForm.value = { securityLevel: 'INTERNAL', validUntil: '' }
      // 기존 문서 탭 초기화
      selectedDocIds.value = []
      // 카테고리 초기화
      selectedCategoryId.value = null

      // 카테고리 로드
      loadingCategories.value = true
      try {
        const res = await categoriesApi.getByDomain(props.domainCode)
        categories.value = res.data
      } catch {
        categories.value = []
      } finally {
        loadingCategories.value = false
      }
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="문서 추가"
    width="600px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <!-- 도메인 정보 -->
    <div style="margin-bottom: 16px; padding: 12px; background: #f5f7fa; border-radius: 6px">
      <div style="font-size: 13px; color: #909399">배치될 도메인</div>
      <div style="font-size: 15px; font-weight: 600; color: #303133; margin-top: 4px">
        {{ domainName }}
        <el-tag size="small" style="margin-left: 8px">{{ domainCode }}</el-tag>
      </div>
    </div>

    <!-- 카테고리 선택 (공통) -->
    <el-form-item v-if="categoryTree.length > 0" label="카테고리 (선택)" style="margin-bottom: 16px">
      <el-cascader
        v-model="selectedCategoryId"
        :options="categoryTree"
        :props="{ checkStrictly: true, emitPath: false }"
        clearable
        placeholder="루트에 배치"
        style="width: 100%"
        :loading="loadingCategories"
      />
    </el-form-item>

    <!-- 탭 -->
    <el-tabs v-model="activeTab" type="card">
      <!-- 새 파일 업로드 탭 -->
      <el-tab-pane label="새 파일 업로드" name="upload">
        <el-form label-position="top">
          <el-form-item label="파일 선택" required>
            <el-upload
              ref="uploadRef"
              v-model:file-list="fileList"
              :auto-upload="false"
              :on-change="onFileChange"
              :on-remove="onFileRemove"
              accept=".pdf,.md,.csv"
              multiple
              drag
              action="#"
            >
              <el-icon style="font-size: 32px; color: var(--el-text-color-placeholder)"><UploadFilled /></el-icon>
              <div>파일을 드래그하거나 클릭하여 선택하세요</div>
              <template #tip>
                <div class="el-upload__tip">PDF, Markdown, CSV만 허용 (최대 50MB, 20개)</div>
              </template>
            </el-upload>
          </el-form-item>

          <el-form-item label="보안 등급">
            <el-select v-model="uploadForm.securityLevel" style="width: 100%">
              <el-option
                v-for="(label, key) in SECURITY_LEVEL_LABELS"
                :key="key"
                :label="label"
                :value="key"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="유효기간 (선택)">
            <el-date-picker
              v-model="uploadForm.validUntil"
              type="date"
              placeholder="유효기간 미설정"
              value-format="YYYY-MM-DD"
              style="width: 100%"
              clearable
            />
          </el-form-item>
        </el-form>

        <!-- 업로드 결과 -->
        <div v-if="uploadResults.length > 0" style="margin-top: 12px">
          <el-divider content-position="left">업로드 결과</el-divider>
          <div v-for="(r, i) in uploadResults" :key="i" class="upload-result">
            <el-icon v-if="r.success" style="color: var(--el-color-success)"><CircleCheck /></el-icon>
            <el-icon v-else style="color: var(--el-color-danger)"><CircleClose /></el-icon>
            <span>{{ r.fileName }}</span>
            <el-tag v-if="r.success" size="small" type="success">{{ r.docCode }}</el-tag>
            <el-tag v-else size="small" type="danger">{{ r.error }}</el-tag>
          </div>
        </div>
      </el-tab-pane>

      <!-- 기존 문서 검색 탭 -->
      <el-tab-pane label="기존 문서 배치" name="existing">
        <div style="height: 350px; border: 1px solid #ebeef5; border-radius: 4px; overflow: hidden">
          <DocumentExplorer
            :multi-select="true"
            v-model:selected-ids="selectedDocIds"
          />
        </div>
        <div v-if="selectedDocIds.length > 0" style="margin-top: 12px; color: #409eff; font-size: 13px">
          {{ selectedDocIds.length }}건 선택됨
        </div>
      </el-tab-pane>
    </el-tabs>

    <template #footer>
      <el-button @click="emit('update:visible', false)">
        {{ uploadResults.length > 0 ? '닫기' : '취소' }}
      </el-button>
      <template v-if="activeTab === 'upload'">
        <el-button
          v-if="uploadResults.length === 0"
          type="primary"
          :loading="uploading"
          :disabled="selectedFiles.length === 0"
          @click="submitUpload"
        >
          업로드 및 배치 ({{ selectedFiles.length }}개)
        </el-button>
      </template>
      <template v-else>
        <el-button
          type="primary"
          :loading="placementLoading"
          :disabled="selectedDocIds.length === 0"
          @click="submitPlacement"
        >
          배치 ({{ selectedDocIds.length }}건)
        </el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.upload-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
</style>
