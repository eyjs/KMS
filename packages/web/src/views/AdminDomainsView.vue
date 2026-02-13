<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { taxonomyApi } from '@/api/taxonomy'
import { useDomainStore } from '@/stores/domain'
import { DOMAIN_LEVEL_LABELS, DOMAIN_GUIDANCE } from '@kms/shared'
import type { DomainMasterEntity, CreateDomainDto, UpdateDomainDto } from '@kms/shared'

const domainStore = useDomainStore()
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await domainStore.loadDomains()
  } finally {
    loading.value = false
  }
})

function getNewDomainLevelLabel(): string {
  // 하위 도메인 차단됨, 항상 루트 도메인
  return DOMAIN_LEVEL_LABELS[0] ?? '도메인'
}

// ============================================================
// 도메인 CRUD
// ============================================================

const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)
const showAdvanced = ref(false)

const formData = ref({
  code: '',
  displayName: '',
  description: '',
  sortOrder: 0,
  parentCode: null as string | null,
})

function openCreateDialog() {
  dialogMode.value = 'create'
  showAdvanced.value = false
  formData.value = {
    code: '',
    displayName: '',
    description: '',
    sortOrder: 0,
    parentCode: null,
  }
  dialogVisible.value = true
}

function openEditDialog(domain: DomainMasterEntity) {
  dialogMode.value = 'edit'
  formData.value = {
    code: domain.code,
    displayName: domain.displayName,
    description: domain.description ?? '',
    sortOrder: domain.sortOrder,
    parentCode: domain.parentCode ?? null,
  }
  dialogVisible.value = true
}

async function handleDialogSubmit() {
  if (!formData.value.displayName.trim()) {
    ElMessage.warning('도메인 이름을 입력해주세요')
    return
  }
  dialogLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      const dto: CreateDomainDto = {
        displayName: formData.value.displayName,
        parentCode: formData.value.parentCode ?? undefined,
        description: formData.value.description || undefined,
        sortOrder: formData.value.sortOrder,
      }
      // 고급 옵션에서 코드를 입력한 경우에만 전달
      if (formData.value.code.trim()) {
        dto.code = formData.value.code.trim()
      }
      await taxonomyApi.createDomain(dto)
      ElMessage.success('도메인이 생성되었습니다')
    } else {
      const dto: UpdateDomainDto = {
        displayName: formData.value.displayName,
        description: formData.value.description || undefined,
        sortOrder: formData.value.sortOrder,
      }
      await taxonomyApi.updateDomain(formData.value.code, dto)
      ElMessage.success('도메인이 수정되었습니다')
    }
    dialogVisible.value = false
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류가 발생했습니다'
    ElMessage.error(msg)
  } finally {
    dialogLoading.value = false
  }
}

async function handleDelete(domain: DomainMasterEntity) {
  try {
    await ElMessageBox.confirm(
      `"${domain.displayName}" 도메인을 삭제하시겠습니까?\n도메인 내 폴더도 함께 삭제됩니다.`,
      '도메인 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteDomain(domain.code)
    ElMessage.success('도메인이 삭제되었습니다')
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
}
</script>

<template>
  <div v-loading="loading" class="admin-domains-view">
    <h2 style="margin: 0 0 8px; font-size: 20px">도메인 관리</h2>
    <div style="margin-bottom: 12px; padding: 10px 14px; background: #f4f4f5; border-radius: 6px; font-size: 13px; color: #606266; line-height: 1.6">
      <strong>{{ DOMAIN_GUIDANCE.principle }}</strong>
    </div>

    <!-- 도메인 목록 (트리 테이블) -->
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600">도메인 목록</span>
          <el-button type="primary" size="small" @click="openCreateDialog">
            루트 도메인 추가
          </el-button>
        </div>
      </template>
      <el-table
        :data="domainStore.domainTree"
        size="small"
        row-key="code"
        :tree-props="{ children: 'children' }"
        :default-expand-all="true"
        :header-cell-style="{ background: '#fafafa' }"
      >
        <el-table-column prop="code" label="코드" width="160">
          <template #default="{ row }">
            <span style="font-family: monospace; font-size: 12px">{{ row.code }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="displayName" label="이름" min-width="180" />
        <el-table-column prop="description" label="설명" min-width="200">
          <template #default="{ row }">
            <span v-if="row.description" style="color: #606266">{{ row.description }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column label="상태" width="70" align="center">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
              {{ row.isActive ? '활성' : '비활성' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="순서" width="60" align="center" />
        <el-table-column label="" width="140" align="center">
          <template #default="{ row }">
            <el-button text size="small" type="primary" @click.stop="openEditDialog(row)">
              수정
            </el-button>
            <el-button text size="small" type="danger" @click.stop="handleDelete(row)">
              삭제
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty
        v-if="!loading && domainStore.domainTree.length === 0"
        description="등록된 도메인이 없습니다. 루트 도메인을 추가해주세요."
        :image-size="80"
      >
        <el-button type="primary" @click="openCreateDialog">루트 도메인 추가</el-button>
      </el-empty>
    </el-card>

    <!-- 도메인 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'edit' ? '도메인 수정' : `${getNewDomainLevelLabel()} 추가`"
      width="480px"
      :close-on-click-modal="false"
    >
      <!-- 도메인 가이드 -->
      <el-alert
        v-if="dialogMode === 'create'"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
      >
        <template #title>{{ DOMAIN_GUIDANCE.principle }}</template>
        <div style="font-size: 12px; line-height: 1.6; margin-top: 4px">
          <div style="color: #67c23a">예시: {{ DOMAIN_GUIDANCE.examples.correct.join(', ') }}</div>
          <div style="color: #f56c6c">주의: {{ DOMAIN_GUIDANCE.examples.wrong.join(', ') }}</div>
        </div>
      </el-alert>

      <el-form label-width="110px" label-position="left">
        <el-form-item v-if="formData.parentCode && dialogMode === 'create'" label="상위 도메인">
          <el-input :model-value="formData.parentCode" disabled />
        </el-form-item>
        <el-form-item v-if="dialogMode === 'edit'" label="코드">
          <el-input :model-value="formData.code" disabled />
        </el-form-item>
        <el-form-item :label="`${getNewDomainLevelLabel()} 이름`" required>
          <el-input
            v-model="formData.displayName"
            :placeholder="`예: ${DOMAIN_GUIDANCE.examples.correct.slice(0, 3).join(', ')}`"
            maxlength="100"
          />
          <div v-if="dialogMode === 'create'" style="font-size: 11px; color: #909399; margin-top: 2px">
            코드는 자동 생성됩니다 (예: D01, D01-01)
          </div>
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="formData.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>

        <!-- 고급 옵션 (생성 시에만 표시) -->
        <template v-if="dialogMode === 'create'">
          <div
            style="cursor: pointer; color: #909399; font-size: 12px; margin: 8px 0 12px; user-select: none"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '▼' : '▶' }} 고급 옵션
          </div>
          <template v-if="showAdvanced">
            <el-form-item label="코드 별칭">
              <el-input v-model="formData.code" placeholder="비워두면 자동 생성 (예: SALES)" maxlength="20" />
              <div style="font-size: 11px; color: #909399; margin-top: 2px">
                대문자/숫자/하이픈만 가능. 비워두면 D01 형태로 자동 부여
              </div>
            </el-form-item>
            <el-form-item label="정렬 순서">
              <el-input-number v-model="formData.sortOrder" :min="0" :max="999" />
            </el-form-item>
          </template>
        </template>
        <template v-else>
          <el-form-item label="정렬 순서">
            <el-input-number v-model="formData.sortOrder" :min="0" :max="999" />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">취소</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          :disabled="!formData.displayName.trim()"
          @click="handleDialogSubmit"
        >
          {{ dialogMode === 'create' ? '생성' : '저장' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-domains-view {
  height: 100%;
  overflow-y: auto;
}
.admin-domains-view :deep(.el-card__header) {
  padding: 10px 16px;
}
.admin-domains-view :deep(.el-card__body) {
  padding: 12px 16px;
}
</style>
