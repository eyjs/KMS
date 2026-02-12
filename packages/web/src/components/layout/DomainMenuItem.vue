<script setup lang="ts">
import type { DomainMasterEntity } from '@kms/shared'

const props = withDefaults(
  defineProps<{
    domain: DomainMasterEntity
    showChildren?: boolean
  }>(),
  {
    showChildren: true,
  },
)
</script>

<template>
  <el-sub-menu v-if="showChildren && domain.children?.length" :index="domain.code">
    <template #title>
      <el-icon><component is="Folder" /></el-icon>
      <span>{{ domain.displayName }}</span>
    </template>
    <el-menu-item :index="`/d/${domain.code}`">
      <el-icon><component is="Document" /></el-icon>
      <span>{{ domain.displayName }} 전체</span>
    </el-menu-item>
    <domain-menu-item
      v-for="child in domain.children"
      :key="child.code"
      :domain="child"
    />
  </el-sub-menu>
  <el-menu-item v-else :index="`/d/${domain.code}`">
    <el-icon><component is="Folder" /></el-icon>
    <span>{{ domain.displayName }}</span>
  </el-menu-item>
</template>
