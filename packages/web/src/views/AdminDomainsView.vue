<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { taxonomyApi } from '@/api/taxonomy'
import type { DomainMasterEntity, FacetMasterEntity } from '@kms/shared'

const domains = ref<DomainMasterEntity[]>([])
const facets = ref<Record<string, FacetMasterEntity[]>>({})
const loading = ref(true)
const selectedDomain = ref<string | null>(null)

const FACET_LABELS: Record<string, string> = {
  carrier: '보험사',
  product: '상품',
  docType: '문서유형',
}

onMounted(async () => {
  try {
    const { data } = await taxonomyApi.getDomains()
    domains.value = data
  } finally {
    loading.value = false
  }
})

async function handleDomainClick(domain: DomainMasterEntity) {
  selectedDomain.value = domain.code
  const required = domain.requiredFacets as string[]
  for (const facetType of required) {
    if (!facets.value[facetType]) {
      const { data } = await taxonomyApi.getFacets(facetType, domain.code)
      facets.value[facetType] = data
    }
  }
}

function getSelectedDomain(): DomainMasterEntity | undefined {
  return domains.value.find((d) => d.code === selectedDomain.value)
}
</script>

<template>
  <div v-loading="loading">
    <h2 style="margin: 0 0 20px; font-size: 22px">도메인 / 분류 관리</h2>

    <div style="display: flex; gap: 20px">
      <!-- 도메인 목록 -->
      <el-card shadow="never" style="width: 400px">
        <template #header>
          <span style="font-weight: 600">도메인 목록</span>
        </template>
        <el-table
          :data="domains"
          size="small"
          highlight-current-row
          @row-click="handleDomainClick"
          :header-cell-style="{ background: '#fafafa' }"
          style="cursor: pointer"
        >
          <el-table-column prop="code" label="코드" width="140" />
          <el-table-column prop="displayName" label="이름" min-width="120" />
          <el-table-column label="상태" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
                {{ row.isActive ? '활성' : '비활성' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top: 12px; font-size: 12px; color: #909399">
          도메인 추가/수정은 관리자 API를 통해 가능합니다.
        </div>
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
              v-for="f in (getSelectedDomain()?.requiredFacets as string[] ?? [])"
              :key="f"
              size="small"
              style="margin-left: 6px"
            >
              {{ FACET_LABELS[f] ?? f }}
            </el-tag>
          </div>

          <div style="margin-bottom: 16px">
            <strong>SSOT Key:</strong>
            <el-tag
              v-for="k in (getSelectedDomain()?.ssotKey as string[] ?? [])"
              :key="k"
              size="small"
              type="warning"
              style="margin-left: 6px"
            >
              {{ FACET_LABELS[k] ?? k }}
            </el-tag>
          </div>

          <!-- Facet 데이터 -->
          <div v-for="facetType in (getSelectedDomain()?.requiredFacets as string[] ?? [])" :key="facetType" style="margin-bottom: 20px">
            <h4>{{ FACET_LABELS[facetType] ?? facetType }}</h4>
            <el-table
              :data="(facets[facetType] ?? []).filter((f: FacetMasterEntity) => f.isActive)"
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
            </el-table>
          </div>
        </el-card>
      </div>

      <el-card v-else shadow="never" style="flex: 1">
        <el-empty description="도메인을 선택하세요" />
      </el-card>
    </div>
  </div>
</template>
