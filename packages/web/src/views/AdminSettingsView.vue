<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { taxonomyApi } from '@/api/taxonomy'
import { useFacetTypes } from '@/composables/useFacetTypes'
import type { FacetTypeMasterEntity, CreateFacetTypeDto, UpdateFacetTypeDto } from '@kms/shared'

const { loadFacetTypes: refreshGlobalCache } = useFacetTypes()

const facetTypes = ref<FacetTypeMasterEntity[]>([])
const loading = ref(false)

onMounted(() => loadFacetTypes())

async function loadFacetTypes() {
  loading.value = true
  try {
    const { data } = await taxonomyApi.getFacetTypes()
    facetTypes.value = data
    // 전역 composable 캐시도 동기화
    await refreshGlobalCache(true)
  } catch {
    ElMessage.error('분류 유형을 불러올 수 없습니다')
  } finally {
    loading.value = false
  }
}

// 다이얼로그
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)

const form = ref({
  code: '',
  displayName: '',
  codePrefix: '',
  description: '',
  sortOrder: 0,
})

function openCreateDialog() {
  dialogMode.value = 'create'
  form.value = { code: '', displayName: '', codePrefix: '', description: '', sortOrder: 0 }
  dialogVisible.value = true
}

function openEditDialog(ft: FacetTypeMasterEntity) {
  dialogMode.value = 'edit'
  form.value = {
    code: ft.code,
    displayName: ft.displayName,
    codePrefix: ft.codePrefix,
    description: ft.description ?? '',
    sortOrder: ft.sortOrder,
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!form.value.code.trim() || !form.value.displayName.trim() || !form.value.codePrefix.trim()) {
    ElMessage.warning('코드, 이름, 접두어는 필수입니다')
    return
  }

  dialogLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      const dto: CreateFacetTypeDto = {
        code: form.value.code.trim(),
        displayName: form.value.displayName.trim(),
        codePrefix: form.value.codePrefix.trim(),
        description: form.value.description.trim() || undefined,
        sortOrder: form.value.sortOrder,
      }
      await taxonomyApi.createFacetType(dto)
      ElMessage.success('분류 유형이 생성되었습니다')
    } else {
      const dto: UpdateFacetTypeDto = {
        displayName: form.value.displayName.trim(),
        codePrefix: form.value.codePrefix.trim(),
        description: form.value.description.trim() || undefined,
        sortOrder: form.value.sortOrder,
      }
      await taxonomyApi.updateFacetType(form.value.code, dto)
      ElMessage.success('분류 유형이 수정되었습니다')
    }
    dialogVisible.value = false
    await loadFacetTypes()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류가 발생했습니다'
    ElMessage.error(msg)
  } finally {
    dialogLoading.value = false
  }
}

async function handleDelete(ft: FacetTypeMasterEntity) {
  try {
    await ElMessageBox.confirm(
      `"${ft.displayName}" 분류 유형을 삭제하시겠습니까?`,
      '분류 유형 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteFacetType(ft.code)
    ElMessage.success('분류 유형이 삭제되었습니다')
    await loadFacetTypes()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
}
</script>

<template>
  <div v-loading="loading" style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 12px; font-size: 20px">시스템 설정</h2>

    <!-- 분류 유형 관리 -->
    <el-card shadow="never">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: 600">분류 유형 (Facet Types)</span>
          <el-button type="primary" size="small" @click="openCreateDialog">추가</el-button>
        </div>
      </template>
      <div style="margin-bottom: 12px; font-size: 13px; color: #606266; line-height: 1.6">
        문서 분류에 사용할 유형을 관리합니다. 도메인에서 필수 분류로 지정하면 문서 등록 시 해당 유형의 값을 선택해야 합니다.
      </div>
      <el-table :data="facetTypes" size="small" :header-cell-style="{ background: '#fafafa' }">
        <el-table-column prop="code" label="코드" width="140" />
        <el-table-column prop="displayName" label="이름" width="140" />
        <el-table-column prop="codePrefix" label="코드 접두어" width="100" align="center" />
        <el-table-column prop="description" label="설명" min-width="200">
          <template #default="{ row }">
            <span style="color: #606266">{{ row.description ?? '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="sortOrder" label="순서" width="70" align="center" />
        <el-table-column label="" width="120" align="center">
          <template #default="{ row }">
            <el-button text size="small" type="primary" @click="openEditDialog(row)">수정</el-button>
            <el-button text size="small" type="danger" @click="handleDelete(row)">삭제</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 다이얼로그 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '분류 유형 추가' : '분류 유형 수정'"
      width="460px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" label-position="left">
        <el-form-item label="코드" required>
          <el-input
            v-model="form.code"
            :disabled="dialogMode === 'edit'"
            placeholder="예: carrier, region"
            maxlength="50"
          />
          <div v-if="dialogMode === 'create'" style="font-size: 11px; color: #909399; margin-top: 2px">
            영문자로 시작, 영문자/숫자만 허용. 생성 후 변경 불가.
          </div>
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="form.displayName" placeholder="예: 보험사, 지역" maxlength="100" />
        </el-form-item>
        <el-form-item label="코드 접두어" required>
          <el-input v-model="form.codePrefix" placeholder="예: C, R" maxlength="5" style="width: 120px" />
          <div style="font-size: 11px; color: #909399; margin-top: 2px">
            분류 값의 자동 생성 코드 접두어 (예: C → C001, C002)
          </div>
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="form.description" type="textarea" :rows="2" placeholder="분류 유형에 대한 설명" maxlength="500" />
        </el-form-item>
        <el-form-item label="정렬 순서">
          <el-input-number v-model="form.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="handleSubmit">
          {{ dialogMode === 'create' ? '추가' : '저장' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
