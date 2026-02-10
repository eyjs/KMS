<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { taxonomyApi } from '@/api/taxonomy'
import { useDomainStore } from '@/stores/domain'
import { FACET_TYPE_LABELS, DOMAIN_MAX_DEPTH, DOMAIN_LEVEL_LABELS, DOMAIN_GUIDANCE } from '@kms/shared'
import type { DomainMasterEntity, FacetMasterEntity, CreateDomainDto, UpdateDomainDto, CreateFacetDto, UpdateFacetDto } from '@kms/shared'

const TIER_LABELS: Record<string, string> = {
  HOT: '수시 갱신',
  WARM: '정기 갱신',
  COLD: '장기 보관',
}

function facetLabel(key: string): string {
  return FACET_TYPE_LABELS[key] ?? key
}

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

// 도메인 깊이 계산
function getDomainDepth(code: string): number {
  let depth = 0
  let current = domainStore.domainsFlat.find((d) => d.code === code)
  while (current?.parentCode) {
    depth++
    current = domainStore.domainsFlat.find((d) => d.code === current!.parentCode)
  }
  return depth
}

function canAddChild(domain: FlatDomainRow): boolean {
  return getDomainDepth(domain.code) + 1 < DOMAIN_MAX_DEPTH
}

function getNewDomainLevelLabel(): string {
  if (!formData.value.parentCode) return DOMAIN_LEVEL_LABELS[0] ?? '도메인'
  const depth = getDomainDepth(formData.value.parentCode) + 1
  return DOMAIN_LEVEL_LABELS[depth] ?? '도메인'
}

// 도메인 CRUD
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const dialogLoading = ref(false)
const showAdvanced = ref(false)

const formData = ref({
  code: '',
  displayName: '',
  description: '',
  requiredFacets: '',
  ssotKey: '',
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
    requiredFacets: '',
    ssotKey: '',
    sortOrder: 0,
    parentCode: null,
  }
  dialogVisible.value = true
}

function openCreateChildDialog(parent: FlatDomainRow) {
  if (!canAddChild(parent)) {
    const maxLabel = DOMAIN_LEVEL_LABELS[DOMAIN_MAX_DEPTH - 1] ?? '최하위'
    ElMessage.warning(`도메인은 "${maxLabel}" 단계까지 가능합니다. ${DOMAIN_GUIDANCE.facetGuide}`)
    return
  }
  dialogMode.value = 'create'
  showAdvanced.value = false
  formData.value = {
    code: '',
    displayName: '',
    description: '',
    requiredFacets: '',
    ssotKey: '',
    sortOrder: 0,
    parentCode: parent.code,
  }
  dialogVisible.value = true
}

function openEditDialog(domain: FlatDomainRow) {
  dialogMode.value = 'edit'
  // 수정 시 code는 전체 코드 그대로 표시 (disabled이므로)
  formData.value = {
    code: domain.code,
    displayName: domain.displayName,
    description: domain.description ?? '',
    requiredFacets: (domain.requiredFacets ?? []).join(', '),
    ssotKey: (domain.ssotKey ?? []).join(', '),
    sortOrder: domain.sortOrder,
    parentCode: domain.parentCode ?? null,
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
        displayName: formData.value.displayName,
        parentCode: formData.value.parentCode ?? undefined,
        description: formData.value.description || undefined,
        requiredFacets: parseCommaSeparated(formData.value.requiredFacets),
        ssotKey: parseCommaSeparated(formData.value.ssotKey),
        sortOrder: formData.value.sortOrder,
      }
      // 고급 옵션에서 별칭을 입력한 경우에만 코드 전달
      if (formData.value.code.trim()) {
        dto.code = formData.value.code.trim()
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
  <div v-loading="loading" style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 8px; font-size: 20px">도메인 / 분류 관리</h2>
    <div style="margin-bottom: 12px; padding: 10px 14px; background: #f4f4f5; border-radius: 6px; font-size: 13px; color: #606266; line-height: 1.6">
      <strong>도메인</strong> = 업무 영역 (영업, 수수료, 계약 등) &nbsp;|&nbsp;
      <strong>분류(Facet)</strong> = 보험사, 상품, 문서유형 → 오른쪽 패널에서 관리
    </div>

    <div style="display: flex; gap: 16px">
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
          <el-table-column label="" width="160" align="center">
            <template #default="{ row }">
              <el-tooltip
                v-if="!canAddChild(row)"
                :content="`업무프로세스 단계까지 도달. ${DOMAIN_GUIDANCE.facetGuide}`"
                placement="top"
              >
                <el-button text size="small" type="info" disabled @click.stop>
                  하위 추가
                </el-button>
              </el-tooltip>
              <el-button v-else text size="small" type="success" @click.stop="openCreateChildDialog(row)">
                하위 추가
              </el-button>
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

          <div style="margin-bottom: 12px">
            <span style="font-size: 13px; color: #606266">문서 등록 시 필수 분류:</span>
            <el-tag
              v-for="f in (getSelectedDomain()?.requiredFacets ?? [])"
              :key="f"
              size="small"
              style="margin-left: 6px"
            >
              {{ facetLabel(f as string) }}
            </el-tag>
          </div>

          <div style="margin-bottom: 12px">
            <span style="font-size: 13px; color: #606266">중복 방지 기준:</span>
            <el-tag
              v-for="k in (getSelectedDomain()?.ssotKey ?? [])"
              :key="k"
              size="small"
              type="warning"
              style="margin-left: 6px"
            >
              {{ facetLabel(k as string) }}
            </el-tag>
            <span style="font-size: 11px; color: #909399; margin-left: 8px">
              같은 조합에 활성 문서 1개만 허용
            </span>
          </div>

          <!-- 분류 항목 -->
          <div v-for="facetType in (getSelectedDomain()?.requiredFacets ?? [])" :key="facetType" style="margin-bottom: 16px">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px">
              <h4 style="margin: 0; font-size: 14px">{{ facetLabel(facetType as string) }}</h4>
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
              <el-table-column label="갱신주기" width="90" align="center">
                <template #default="{ row }">
                  <el-tag v-if="row.tier" size="small" type="info">{{ TIER_LABELS[row.tier] ?? row.tier }}</el-tag>
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
          <div style="color: #f56c6c">주의: {{ DOMAIN_GUIDANCE.examples.wrong.join(', ') }} (분류로 관리)</div>
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
          <el-input v-model="formData.displayName" :placeholder="`예: ${DOMAIN_GUIDANCE.examples.correct.slice(0, 3).join(', ')}`" maxlength="100" />
          <div v-if="dialogMode === 'create'" style="font-size: 11px; color: #909399; margin-top: 2px">
            코드는 자동 생성됩니다 (예: D01, D01-01)
          </div>
        </el-form-item>
        <el-form-item label="설명">
          <el-input v-model="formData.description" type="textarea" :rows="2" maxlength="500" />
        </el-form-item>

        <!-- 고급 옵션 (접힌 상태) -->
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
            <el-form-item label="필수 분류">
              <el-input v-model="formData.requiredFacets" placeholder="예: carrier, product, docType" />
              <div style="font-size: 11px; color: #909399; margin-top: 2px">문서 등록 시 반드시 선택해야 하는 분류 (carrier=보험사, product=상품, docType=문서유형)</div>
            </el-form-item>
            <el-form-item label="중복 방지 기준">
              <el-input v-model="formData.ssotKey" placeholder="예: carrier, product, docType" />
              <div style="font-size: 11px; color: #909399; margin-top: 2px">같은 분류 조합에 활성 문서를 1개만 허용</div>
            </el-form-item>
            <el-form-item label="정렬 순서">
              <el-input-number v-model="formData.sortOrder" :min="0" :max="999" />
            </el-form-item>
          </template>
        </template>
        <template v-else>
          <el-form-item label="필수 분류">
            <el-input v-model="formData.requiredFacets" placeholder="예: carrier, product, docType" />
            <div style="font-size: 11px; color: #909399; margin-top: 2px">문서 등록 시 반드시 선택해야 하는 분류 (carrier=보험사, product=상품, docType=문서유형)</div>
          </el-form-item>
          <el-form-item label="중복 방지 기준">
            <el-input v-model="formData.ssotKey" placeholder="예: carrier, product, docType" />
            <div style="font-size: 11px; color: #909399; margin-top: 2px">같은 분류 조합에 활성 문서를 1개만 허용</div>
          </el-form-item>
          <el-form-item label="정렬 순서">
            <el-input-number v-model="formData.sortOrder" :min="0" :max="999" />
          </el-form-item>
        </template>
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
      :title="facetDialogMode === 'create' ? `${facetLabel(facetDialogType)} 추가` : `${facetLabel(facetDialogType)} 수정`"
      width="460px"
      :close-on-click-modal="false"
    >
      <el-form label-width="100px" label-position="left">
        <el-form-item v-if="facetDialogMode === 'edit'" label="코드">
          <el-input :model-value="facetForm.code" disabled />
        </el-form-item>
        <el-form-item label="이름" required>
          <el-input v-model="facetForm.displayName" placeholder="예: 삼성생명" maxlength="100" />
          <div v-if="facetDialogMode === 'create'" style="font-size: 11px; color: #909399; margin-top: 2px">
            코드는 자동 생성됩니다 (예: C001, P001, T001)
          </div>
        </el-form-item>
        <el-form-item label="갱신주기">
          <el-select v-model="facetForm.tier" clearable placeholder="선택 (옵션)" style="width: 100%">
            <el-option label="수시 갱신" value="HOT" />
            <el-option label="정기 갱신" value="WARM" />
            <el-option label="장기 보관" value="COLD" />
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
