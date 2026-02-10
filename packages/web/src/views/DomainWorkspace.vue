<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useDomainStore } from '@/stores/domain'
import { useAuthStore } from '@/stores/auth'
import { taxonomyApi } from '@/api/taxonomy'
import ClassificationTree from '@/components/domain/ClassificationTree.vue'
import DocumentTable from '@/components/document/DocumentTable.vue'
import DocumentPreview from '@/components/document/DocumentPreview.vue'
import UploadDialog from '@/components/domain/UploadDialog.vue'
import type { DocumentEntity, DomainMasterEntity, CreateDomainDto, UpdateDomainDto } from '@kms/shared'

const route = useRoute()
const router = useRouter()
const domainStore = useDomainStore()
const auth = useAuthStore()

const domainCode = computed(() => route.params.domainCode as string)
const filters = ref<Record<string, string>>({})
const selectedDoc = ref<DocumentEntity | null>(null)
const showPreview = ref(true)
const showUpload = ref(false)
const activeTab = ref<'list' | 'graph'>('list')
const docTableRef = ref<InstanceType<typeof DocumentTable>>()

// 하위 도메인
const childDomains = computed(() =>
  domainStore.domainsFlat.filter((d) => d.parentCode === domainCode.value),
)
const isAdmin = computed(() => auth.hasMinRole('ADMIN'))

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

function handleDocAction(command: string, doc: DocumentEntity) {
  if (command === 'detail') {
    router.push(`/d/${domainCode.value}/doc/${doc.id}`)
  } else if (command === 'compare') {
    router.push(`/d/${domainCode.value}/compare?source=${doc.id}`)
  }
}

function handleUploadSuccess() {
  showUpload.value = false
  docTableRef.value?.refresh()
}

function openUpload() {
  showUpload.value = true
}

function navigateToChild(child: DomainMasterEntity) {
  router.push(`/d/${child.code}`)
}

// 하위 도메인 CRUD
const childDialogVisible = ref(false)
const childDialogMode = ref<'create' | 'edit'>('create')
const childDialogLoading = ref(false)
const childFormData = ref({
  code: '',
  displayName: '',
  description: '',
  sortOrder: 0,
})
const editingChildCode = ref('')

function openChildCreateDialog() {
  childDialogMode.value = 'create'
  childFormData.value = { code: '', displayName: '', description: '', sortOrder: 0 }
  childDialogVisible.value = true
}

function openChildEditDialog(child: DomainMasterEntity) {
  childDialogMode.value = 'edit'
  editingChildCode.value = child.code
  childFormData.value = {
    code: child.code,
    displayName: child.displayName,
    description: child.description ?? '',
    sortOrder: child.sortOrder,
  }
  childDialogVisible.value = true
}

async function handleChildSubmit() {
  childDialogLoading.value = true
  try {
    if (childDialogMode.value === 'create') {
      const dto: CreateDomainDto = {
        code: childFormData.value.code,
        displayName: childFormData.value.displayName,
        parentCode: domainCode.value,
        description: childFormData.value.description || undefined,
        sortOrder: childFormData.value.sortOrder,
      }
      await taxonomyApi.createDomain(dto)
      ElMessage.success('하위 도메인이 생성되었습니다')
    } else {
      const dto: UpdateDomainDto = {
        displayName: childFormData.value.displayName,
        description: childFormData.value.description || undefined,
        sortOrder: childFormData.value.sortOrder,
      }
      await taxonomyApi.updateDomain(editingChildCode.value, dto)
      ElMessage.success('하위 도메인이 수정되었습니다')
    }
    childDialogVisible.value = false
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류가 발생했습니다'
    ElMessage.error(msg)
  } finally {
    childDialogLoading.value = false
  }
}

async function handleChildDelete(child: DomainMasterEntity) {
  try {
    await ElMessageBox.confirm(
      `"${child.displayName}" 도메인을 삭제하시겠습니까?`,
      '하위 도메인 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteDomain(child.code)
    ElMessage.success('하위 도메인이 삭제되었습니다')
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
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
        <span
          v-if="domainStore.currentDomain?.description"
          style="margin-left: 12px; font-size: 13px; color: #909399"
        >
          {{ domainStore.currentDomain.description }}
        </span>
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

    <!-- 하위 카테고리 섹션 -->
    <div v-if="childDomains.length > 0 || isAdmin" style="margin-bottom: 16px">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
        <span style="font-size: 13px; color: #606266; font-weight: 600">하위 카테고리</span>
        <el-button
          v-if="isAdmin"
          size="small"
          @click="openChildCreateDialog"
        >
          + 카테고리 추가
        </el-button>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap">
        <div
          v-for="child in childDomains"
          :key="child.code"
          class="child-domain-card"
          @click="navigateToChild(child)"
        >
          <div style="font-size: 14px; font-weight: 500; color: #303133">
            {{ child.displayName }}
          </div>
          <div style="font-size: 11px; color: #909399; margin-top: 2px">
            {{ child.code }}
          </div>
          <!-- ADMIN 드롭다운 -->
          <el-dropdown
            v-if="isAdmin"
            trigger="click"
            style="position: absolute; top: 6px; right: 6px"
            @click.stop
          >
            <el-button text size="small" style="padding: 2px" @click.stop>
              ...
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item @click="openChildEditDialog(child)">수정</el-dropdown-item>
                <el-dropdown-item @click="handleChildDelete(child)" style="color: #f56c6c">삭제</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
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
              @action="handleDocAction"
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

    <!-- 하위 도메인 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="childDialogVisible"
      :title="childDialogMode === 'create' ? '하위 카테고리 추가' : '하위 카테고리 수정'"
      width="420px"
      :close-on-click-modal="false"
    >
      <el-form label-width="90px" label-position="left">
        <el-form-item label="코드" required>
          <el-input
            v-model="childFormData.code"
            :disabled="childDialogMode === 'edit'"
            placeholder="예: GA-SALES-AUTO"
            maxlength="20"
          />
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="childFormData.displayName" placeholder="예: 자동차보험 영업" maxlength="100" />
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="childFormData.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item label="정렬 순서">
          <el-input-number v-model="childFormData.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="childDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="childDialogLoading" @click="handleChildSubmit">
          {{ childDialogMode === 'create' ? '생성' : '저장' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.child-domain-card {
  padding: 12px 16px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
  min-width: 140px;
  position: relative;
}

.child-domain-card:hover {
  border-color: #409eff;
}
</style>
