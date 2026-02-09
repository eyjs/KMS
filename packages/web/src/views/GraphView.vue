<script setup lang="ts">
import { ref, onMounted } from 'vue'

const container = ref<HTMLDivElement | null>(null)
const loading = ref(true)

onMounted(async () => {
  // vis-network 는 동적 import (SSR 방지)
  loading.value = false
  // TODO: Phase 2.3에서 전체 그래프 구현
  // 현재는 placeholder
})
</script>

<template>
  <div>
    <h2>관계 그래프</h2>
    <el-card v-loading="loading">
      <div ref="container" style="height: 600px; border: 1px solid #e6e6e6; border-radius: 4px">
        <el-empty description="Phase 2.3에서 구현 예정" />
      </div>
    </el-card>
  </div>
</template>
