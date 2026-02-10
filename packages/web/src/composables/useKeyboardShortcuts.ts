import { onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'

export function useKeyboardShortcuts() {
  const router = useRouter()

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl+K (또는 Cmd+K): 검색 페이지로 이동
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      router.push('/search')
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeydown)
  })

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown)
  })
}
