<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AppLayout from '@/components/layout/AppLayout.vue'

const auth = useAuthStore()
auth.init()
</script>

<template>
  <AppLayout v-if="auth.isAuthenticated" />
  <router-view v-else />
</template>
