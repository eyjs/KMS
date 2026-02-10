import { ref } from 'vue'

export interface RecentDocEntry {
  id: string
  domain: string
  docCode: string | null
  fileName: string | null
  visitedAt: string
}

const STORAGE_KEY = 'kms-recent-docs'
const MAX_ITEMS = 20

function load(): RecentDocEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as RecentDocEntry[]) : []
  } catch {
    return []
  }
}

function save(entries: RecentDocEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

const recentDocs = ref<RecentDocEntry[]>(load())

export function useRecentDocs() {
  function addVisit(doc: { id: string; domain: string; docCode?: string | null; fileName?: string | null }) {
    const entries = recentDocs.value.filter((e) => e.id !== doc.id)
    entries.unshift({
      id: doc.id,
      domain: doc.domain,
      docCode: doc.docCode ?? null,
      fileName: doc.fileName ?? null,
      visitedAt: new Date().toISOString(),
    })
    recentDocs.value = entries.slice(0, MAX_ITEMS)
    save(recentDocs.value)
  }

  return { recentDocs, addVisit }
}
