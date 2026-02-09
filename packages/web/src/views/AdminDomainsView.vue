<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { taxonomyApi } from '@/api/taxonomy'
import { useDomainStore } from '@/stores/domain'
import type { DomainMasterEntity, FacetMasterEntity, CreateDomainDto, UpdateDomainDto, CreateFacetDto, UpdateFacetDto } from '@kms/shared'

const domainStore = useDomainStore()
const facets = ref<Record<string, FacetMasterEntity[]>>({})
const loading = ref(false)
const selectedDomain = ref<string | null>(null)

interface FlatDomainRow extends DomainMasterEntity {
  depth: number
}

// 스토어의 트리를 flat으로 변환 (들여쓰기용)
const domainsWithDepth = computed<FlatDomainRow[]>(() => {
  const result: FlatDomainRow[] = []
  function walk(nodes: DomainMasterEntity[], depth: number) {
    for (const node of nodes) {
      result.push({ ...node, depth })
      if (node.children?.length) {
        walk(node.children, depth + 1)
      }
    }
  }
  walk(domainStore.domainTree, 0)
  return result
})

onMounted(async () => {
  loading.value = true
  try {
    await domainStore.loadDomains()
  } finally {
    loading.value = false
  }
})

async function handleDomainClick(domain: FlatDomainRow) {
  selectedDomain.value = domain.code
  try {
    await loadFacetsForDomain(domain)
  } catch {
    ElMessage.error('분류 데이터를 불러올 수 없습니다')
  }
}

async function loadFacetsForDomain(domain: DomainMasterEntity) {
  const required = (domain.requiredFacets ?? []) as string[]
  const results = await Promise.all(
    required.map((ft) =>
      taxonomyApi.getFacets(ft, domain.code).then(({ data }) => ({ ft, data })),
    ),
  )
  for (const { ft, data } of results) {
    facets.value[`${domain.code}:${ft}`] = data
  }
}

function getSelectedDomain(): DomainMasterEntity | undefined {
  return domainStore.domainsFlat.find((d) => d.code === selectedDomain.value)
}

function getFacetData(facetType: string): FacetMasterEntity[] {
  return facets.value[`${selectedDomain.value}:${facetType}`] ?? []
}

// 도메인 CRUD
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)

const formData = ref({
  code: '',
  displayName: '',
  description: '',
  requiredFacets: '',
  ssotKey: '',
  sortOrder: 0,
})

function openCreateDialog() {
  dialogMode.value = 'create'
  formData.value = {
    code: '',
    displayName: '',
    description: '',
    requiredFacets: '',
    ssotKey: '',
    sortOrder: 0,
  }
  dialogVisible.value = true
}

function openEditDialog(domain: FlatDomainRow) {
  dialogMode.value = 'edit'
  formData.value = {
    code: domain.code,
    displayName: domain.displayName,
    description: domain.description ?? '',
    requiredFacets: (domain.requiredFacets ?? []).join(', '),
    ssotKey: (domain.ssotKey ?? []).join(', '),
    sortOrder: domain.sortOrder,
  }
  dialogVisible.value = true
}

function parseCommaSeparated(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

async function handleDialogSubmit() {
  dialogLoading.value = true
  try {
    if (dialogMode.value === 'create') {
      const dto: CreateDomainDto = {
        code: formData.value.code,
        displayName: formData.value.displayName,
        description: formData.value.description || undefined,
        requiredFacets: parseCommaSeparated(formData.value.requiredFacets),
        ssotKey: parseCommaSeparated(formData.value.ssotKey),
        sortOrder: formData.value.sortOrder,
      }
      await taxonomyApi.createDomain(dto)
      ElMessage.success('도메인이 생성되었습니다')
    } else {
      const dto: UpdateDomainDto = {
        displayName: formData.value.displayName,
        description: formData.value.description || undefined,
        requiredFacets: parseCommaSeparated(formData.value.requiredFacets),
        ssotKey: parseCommaSeparated(formData.value.ssotKey),
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

async function handleDelete(domain: FlatDomainRow) {
  try {
    await ElMessageBox.confirm(
      `"${domain.displayName}" 도메인을 삭제하시겠습니까?`,
      '도메인 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteDomain(domain.code)
    ElMessage.success('도메인이 삭제되었습니다')
    if (selectedDomain.value === domain.code) {
      selectedDomain.value = null
    }
    await domainStore.reloadDomains()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
}

// ============================================================
// Facet CRUD
// ============================================================

const facetDialogVisible = ref(false)
const facetDialogMode = ref<'create' | 'edit'>('create')
const facetDialogLoading = ref(false)
const facetDialogType = ref('')

const facetForm = ref({
  id: 0,
  facetType: '',
  code: '',
  displayName: '',
  tier: '',
  maxAgeDays: undefined as number | undefined,
  sortOrder: 0,
})

function openFacetCreateDialog(facetType: string) {
  facetDialogMode.value = 'create'
  facetDialogType.value = facetType
  facetForm.value = {
    id: 0,
    facetType,
    code: '',
    displayName: '',
    tier: '',
    maxAgeDays: undefined,
    sortOrder: 0,
  }
  facetDialogVisible.value = true
}

function openFacetEditDialog(facet: FacetMasterEntity) {
  facetDialogMode.value = 'edit'
  facetDialogType.value = facet.facetType
  facetForm.value = {
    id: facet.id,
    facetType: facet.facetType,
    code: facet.code,
    displayName: facet.displayName,
    tier: facet.tier ?? '',
    maxAgeDays: facet.maxAgeDays ?? undefined,
    sortOrder: facet.sortOrder,
  }
  facetDialogVisible.value = true
}

async function handleFacetSubmit() {
  facetDialogLoading.value = true
  try {
    if (facetDialogMode.value === 'create') {
      const dto: CreateFacetDto = {
        facetType: facetForm.value.facetType,
        code: facetForm.value.code,
        displayName: facetForm.value.displayName,
        domain: selectedDomain.value ?? undefined,
        tier: facetForm.value.tier ? (facetForm.value.tier as 'HOT' | 'WARM' | 'COLD') : undefined,
        maxAgeDays: facetForm.value.maxAgeDays,
        sortOrder: facetForm.value.sortOrder,
      }
      await taxonomyApi.createFacet(dto)
      ElMessage.success('분류가 추가되었습니다')
    } else {
      const dto: UpdateFacetDto = {
        displayName: facetForm.value.displayName,
        tier: facetForm.value.tier ? (facetForm.value.tier as 'HOT' | 'WARM' | 'COLD') : undefined,
        maxAgeDays: facetForm.value.maxAgeDays,
        sortOrder: facetForm.value.sortOrder,
      }
      await taxonomyApi.updateFacet(facetForm.value.id, dto)
      ElMessage.success('분류가 수정되었습니다')
    }
    facetDialogVisible.value = false
    // 해당 도메인의 facet 새로고침
    const domain = getSelectedDomain()
    if (domain) await loadFacetsForDomain(domain)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '오류가 발생했습니다'
    ElMessage.error(msg)
  } finally {
    facetDialogLoading.value = false
  }
}

async function handleFacetDelete(facet: FacetMasterEntity) {
  try {
    await ElMessageBox.confirm(
      `"${facet.displayName}" 분류를 삭제하시겠습니까?`,
      '분류 삭제',
      { confirmButtonText: '삭제', cancelButtonText: '취소', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    await taxonomyApi.deleteFacet(facet.id)
    ElMessage.success('분류가 삭제되었습니다')
    const domain = getSelectedDomain()
    if (domain) await loadFacetsForDomain(domain)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '삭제 중 오류가 발생했습니다'
    ElMessage.error(msg)
  }
}
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 20px; font-size: 22px">도메인 / 분류 관리</h2>

    <div style="display: flex; gap: 20px">
      <!-- 도메인 목록 -->
      <el-card shadow="never" style="width: 560px">
        <template #header>
          <div style="display: flex; justify-content: space-between; align-items: center">
            <span style="font-weight: 600">도메인 목록</span>
            <el-button type="primary" size="small" @click="openCreateDialog">
              루트 도메인 추가
            </el-button>
          </div>
        </template>
        <el-table
          :data="domainsWithDepth"
          size="small"
          highlight-current-row
          @row-click="handleDomainClick"
          :header-cell-style="{ background: '#fafafa' }"
          style="cursor: pointer"
        >
          <el-table-column label="코드" width="140">
            <template #default="{ row }">
              <span :style="{ paddingLeft: row.depth * 16 + 'px' }">
                {{ row.code }}
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="displayName" label="이름" min-width="120" />
          <el-table-column prop="sortOrder" label="순서" width="60" align="center" />
          <el-table-column label="상태" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
                {{ row.isActive ? '활성' : '비활성' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="" width="100" align="center">
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
      </el-card>

      <!-- 분류 상세 -->
      <div style="flex: 1" v-if="selectedDomain">
        <el-card shadow="never">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span style="font-weight: 600">{{ getSelectedDomain()?.displayName }} 분류 구조</span>
              <el-tag size="small">{{ selectedDomain }}</el-tag>
            </div>
          </template>

          <div style="margin-bottom: 16px">
            <strong>필수 Facet:</strong>
            <el-tag
              v-for="f in (getSelectedDomain()?.requiredFacets ?? [])"
              :key="f"
              size="small"
              style="margin-left: 6px"
            >
              {{ f }}
            </el-tag>
          </div>

          <div style="margin-bottom: 16px">
            <strong>SSOT Key:</strong>
            <el-tag
              v-for="k in (getSelectedDomain()?.ssotKey ?? [])"
              :key="k"
              size="small"
              type="warning"
              style="margin-left: 6px"
            >
              {{ k }}
            </el-tag>
          </div>

          <!-- Facet 데이터 -->
          <div v-for="facetType in (getSelectedDomain()?.requiredFacets ?? [])" :key="facetType" style="margin-bottom: 20px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <h4 style="margin: 0">{{ facetType }}</h4>
              <el-button type="primary" size="small" @click="openFacetCreateDialog(facetType as string)">
                추가
              </el-button>
            </div>
            <el-table
              :data="getFacetData(facetType as string).filter((f: FacetMasterEntity) => f.isActive)"
              size="small"
              :header-cell-style="{ background: '#fafafa' }"
            >
              <el-table-column prop="code" label="코드" width="160" />
              <el-table-column prop="displayName" label="이름" min-width="150" />
              <el-table-column prop="sortOrder" label="순서" width="60" align="center" />
              <el-table-column label="Tier" width="70" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.tier" size="small" type="info">{{ row.tier }}</el-tag>
                  <span v-else style="color: #c0c4cc">-</span>
                </template>
              </el-table-column>
              <el-table-column label="" width="100" align="center">
                <template #default="{ row }">
                  <el-button text size="small" type="primary" @click="openFacetEditDialog(row)">
                    수정
                  </el-button>
                  <el-button text size="small" type="danger" @click="handleFacetDelete(row)">
                    삭제
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </div>

      <el-card v-else shadow="never" style="flex: 1">
        <el-empty description="도메인을 선택하세요" />
      </el-card>
    </div>

    <!-- 도메인 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogMode === 'create' ? '루트 도메인 추가' : '도메인 수정'"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-form label-width="110px" label-position="left">
        <el-form-item label="코드" required>
          <el-input
            v-model="formData.code"
            :disabled="dialogMode === 'edit'"
            placeholder="예: GA-SALES"
            maxlength="20"
          />
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="formData.displayName" placeholder="예: GA 영업" maxlength="100" />
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="formData.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>
        <el-form-item label="필수 Facet">
          <el-input v-model="formData.requiredFacets" placeholder="쉼표 구분 (예: carrier, product, docType)" />
        </el-form-item>
        <el-form-item label="SSOT Key">
          <el-input v-model="formData.ssotKey" placeholder="쉼표 구분 (예: carrier, product, docType)" />
        </el-form-item>
        <el-form-item label="정렬 순서">
          <el-input-number v-model="formData.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="handleDialogSubmit">
          {{ dialogMode === 'create' ? '생성' : '저장' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Facet 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="facetDialogVisible"
      :title="facetDialogMode === 'create' ? `${facetDialogType} 분류 추가` : `${facetDialogType} 분류 수정`"
      width="460px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" label-position="left">
        <el-form-item label="코드" required>
          <el-input
            v-model="facetForm.code"
            :disabled="facetDialogMode === 'edit'"
            placeholder="예: INS-SAMSUNG"
            maxlength="50"
          />
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="facetForm.displayName" placeholder="예: 삼성생명" maxlength="100" />
        </el-form-item>
        <el-form-item label="Tier">
          <el-select v-model="facetForm.tier" clearable placeholder="선택 (옵션)" style="width: 100%">
            <el-option label="HOT" value="HOT" />
            <el-option label="WARM" value="WARM" />
            <el-option label="COLD" value="COLD" />
          </el-select>
        </el-form-item>
        <el-form-item label="유효기간 (일)">
          <el-input-number v-model="facetForm.maxAgeDays" :min="1" :max="9999" placeholder="일" />
        </el-form-item>
        <el-form-item label="정렬 순서">
          <el-input-number v-model="facetForm.sortOrder" :min="0" :max="999" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="facetDialogVisible = false">취소</el-button>
        <el-button type="primary" :loading="facetDialogLoading" @click="handleFacetSubmit">
          {{ facetDialogMode === 'create' ? '추가' : '저장' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
