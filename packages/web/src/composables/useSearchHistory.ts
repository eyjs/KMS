import { ref } from 'vue'

export interface SearchHistoryEntry {
  query: string
  searchedAt: string
}

const STORAGE_KEY = 'kms-search-history'
const MAX_ITEMS = 10

function load(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SearchHistoryEntry[]) : []
  } catch {
    return []
  }
}

function save(entries: SearchHistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

const searchHistory = ref<SearchHistoryEntry[]>(load())

export function useSearchHistory() {
  function addSearch(query: string) {
    const trimmed = query.trim()
    if (!trimmed) return
    const entries = searchHistory.value.filter((e) => e.query !== trimmed)
    entries.unshift({ query: trimmed, searchedAt: new Date().toISOString() })
    searchHistory.value = entries.slice(0, MAX_ITEMS)
    save(searchHistory.value)
  }

  function clearHistory() {
    searchHistory.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return { searchHistory, addSearch, clearHistory }
}
