<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { client } from '@/api/client'
import { groupsApi } from '@/api/groups'
import { categoriesApi } from '@/api/categories'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Search } from '@element-plus/icons-vue'
import { useDomainStore } from '@/stores/domain'
import { ROLE_LABELS } from '@kms/shared'
import type {
  PermissionGroupEntity,
  UserGroupMembershipEntity,
  GroupFolderAccessEntity,
  DomainCategoryEntity,
  FolderPermission,
} from '@kms/shared'

const FOLDER_PERMISSION_LABELS: Record<string, string> = {
  NONE: '접근 불가',
  READ: '읽기',
  WRITE: '쓰기',
}

// ============================================================
// 타입 정의
// ============================================================

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: string
}

interface TreeItem {
  id: number
  label: string
  code: string
  domainCode: string
  children?: TreeItem[]
}

// ============================================================
// 상태
// ============================================================

const domainStore = useDomainStore()
const activeTab = ref('users')

// 사용자 권한 탭
const users = ref<UserItem[]>([])
const usersLoading = ref(false)
const searchKeyword = ref('')
const selectedUser = ref<UserItem | null>(null)
const userGroups = ref<PermissionGroupEntity[]>([])
const userGroupsLoading = ref(false)
const allGroups = ref<PermissionGroupEntity[]>([])
const savingUserGroups = ref(false)
const selectedGroupIds = ref<string[]>([])

// 권한 그룹 탭
const groups = ref<PermissionGroupEntity[]>([])
const groupsLoading = ref(false)
const selectedGroup = ref<PermissionGroupEntity | null>(null)
const groupMembers = ref<UserGroupMembershipEntity[]>([])
const groupMembersLoading = ref(false)
const groupFolders = ref<GroupFolderAccessEntity[]>([])
const groupFoldersLoading = ref(false)
const groupDetailTab = ref('members')

// 그룹 생성/수정 다이얼로그
const showGroupDialog = ref(false)
const editingGroup = ref<PermissionGroupEntity | null>(null)
const groupForm = ref({ name: '', description: '' })
const savingGroup = ref(false)

// 멤버 추가 다이얼로그
const showAddMemberDialog = ref(false)
const memberSearchKeyword = ref('')
const addingMember = ref(false)

// 폴더 권한 추가 다이얼로그
const showFolderAccessDialog = ref(false)
const folderAccessForm = ref({
  domainCode: '',
  categoryId: null as number | null,
  accessType: 'READ' as 'READ' | 'WRITE',
  includeChildren: true,
})
const categories = ref<DomainCategoryEntity[]>([])
const categoriesLoading = ref(false)
const addingFolderAccess = ref(false)

// ============================================================
// 계산 속성
// ============================================================

const filteredUsers = computed(() => {
  if (!searchKeyword.value.trim()) return users.value
  const kw = searchKeyword.value.toLowerCase()
  return users.value.filter(
    (u) =>
      u.name.toLowerCase().includes(kw) ||
      u.email.toLowerCase().includes(kw),
  )
})

const usersNotInGroup = computed(() => {
  if (!selectedGroup.value) return []
  const memberIds = new Set(groupMembers.value.map((m) => m.userId))
  const kw = memberSearchKeyword.value.toLowerCase()
  return users.value
    .filter((u) => !memberIds.has(u.id) && u.isActive)
    .filter((u) =>
      !kw || u.name.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw),
    )
})

const categoryTree = computed((): TreeItem[] => {
  function toTree(cats: DomainCategoryEntity[]): TreeItem[] {
    return cats.map((c) => ({
      id: c.id,
      label: c.name,
      code: c.code,
      domainCode: c.domainCode,
      children: c.children?.length ? toTree(c.children) : undefined,
    }))
  }
  return toTree(categories.value)
})

// ============================================================
// 사용자 권한 탭 로직
// ============================================================

async function loadUsers() {
  usersLoading.value = true
  try {
    const { data } = await client.get<UserItem[]>('/auth/users')
    users.value = data
  } catch {
    users.value = []
  } finally {
    usersLoading.value = false
  }
}

async function loadAllGroups() {
  try {
    const { data } = await groupsApi.list()
    allGroups.value = data
  } catch {
    allGroups.value = []
  }
}

async function selectUser(user: UserItem) {
  selectedUser.value = user
  userGroupsLoading.value = true
  try {
    const { data } = await groupsApi.getUserGroups(user.id)
    userGroups.value = data
    selectedGroupIds.value = data.map((g) => g.id)
  } catch {
    userGroups.value = []
    selectedGroupIds.value = []
  } finally {
    userGroupsLoading.value = false
  }
}

async function saveUserGroups() {
  if (!selectedUser.value) return
  savingUserGroups.value = true
  try {
    await groupsApi.updateUserGroups(selectedUser.value.id, selectedGroupIds.value)
    ElMessage.success('소속 그룹이 저장되었습니다')
    // 그룹 목록도 새로고침 (멤버 수 반영)
    await loadAllGroups()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '저장 실패'
    ElMessage.error(msg)
  } finally {
    savingUserGroups.value = false
  }
}

// ============================================================
// 권한 그룹 탭 로직
// ============================================================

async function loadGroups() {
  groupsLoading.value = true
  try {
    const { data } = await groupsApi.list()
    groups.value = data
    allGroups.value = data
  } catch {
    groups.value = []
  } finally {
    groupsLoading.value = false
  }
}

async function selectGroup(group: PermissionGroupEntity) {
  selectedGroup.value = group
  groupDetailTab.value = 'members'
  await Promise.all([loadGroupMembers(), loadGroupFolders()])
}

async function loadGroupMembers() {
  if (!selectedGroup.value) return
  groupMembersLoading.value = true
  try {
    const { data } = await groupsApi.getMembers(selectedGroup.value.id)
    groupMembers.value = data
  } catch {
    groupMembers.value = []
  } finally {
    groupMembersLoading.value = false
  }
}

async function loadGroupFolders() {
  if (!selectedGroup.value) return
  groupFoldersLoading.value = true
  try {
    const { data } = await groupsApi.getFolderAccess(selectedGroup.value.id)
    groupFolders.value = data
  } catch {
    groupFolders.value = []
  } finally {
    groupFoldersLoading.value = false
  }
}

function openCreateGroupDialog() {
  editingGroup.value = null
  groupForm.value = { name: '', description: '' }
  showGroupDialog.value = true
}

function openEditGroupDialog(group: PermissionGroupEntity) {
  editingGroup.value = group
  groupForm.value = { name: group.name, description: group.description || '' }
  showGroupDialog.value = true
}

async function saveGroup() {
  if (!groupForm.value.name.trim()) {
    ElMessage.warning('그룹 이름을 입력하세요')
    return
  }
  savingGroup.value = true
  try {
    if (editingGroup.value) {
      const { data } = await groupsApi.update(editingGroup.value.id, groupForm.value)
      const idx = groups.value.findIndex((g) => g.id === data.id)
      if (idx >= 0) groups.value[idx] = data
      if (selectedGroup.value?.id === data.id) selectedGroup.value = data
      ElMessage.success('그룹이 수정되었습니다')
    } else {
      const { data } = await groupsApi.create(groupForm.value)
      groups.value.push(data)
      ElMessage.success('그룹이 생성되었습니다')
    }
    showGroupDialog.value = false
    await loadAllGroups()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '저장 실패'
    ElMessage.error(msg)
  } finally {
    savingGroup.value = false
  }
}

async function deleteGroup(group: PermissionGroupEntity) {
  try {
    await ElMessageBox.confirm(
      `"${group.name}" 그룹을 삭제하시겠습니까? 모든 멤버십과 폴더 권한이 함께 삭제됩니다.`,
      '그룹 삭제',
      { type: 'warning' },
    )
    await groupsApi.remove(group.id)
    groups.value = groups.value.filter((g) => g.id !== group.id)
    if (selectedGroup.value?.id === group.id) selectedGroup.value = null
    ElMessage.success('그룹이 삭제되었습니다')
    await loadAllGroups()
  } catch {
    // 취소
  }
}

async function toggleGroupActive(group: PermissionGroupEntity) {
  try {
    const { data } = await groupsApi.update(group.id, { isActive: !group.isActive })
    const idx = groups.value.findIndex((g) => g.id === data.id)
    if (idx >= 0) groups.value[idx] = data
    if (selectedGroup.value?.id === data.id) selectedGroup.value = data
    ElMessage.success(`그룹이 ${data.isActive ? '활성화' : '비활성화'}되었습니다`)
  } catch {
    ElMessage.error('상태 변경 실패')
  }
}

// 멤버 관리
function openAddMemberDialog() {
  memberSearchKeyword.value = ''
  showAddMemberDialog.value = true
}

async function addMember(user: UserItem) {
  if (!selectedGroup.value) return
  addingMember.value = true
  try {
    await groupsApi.addMember(selectedGroup.value.id, user.id)
    await loadGroupMembers()
    await loadGroups()
    ElMessage.success(`${user.name}님이 그룹에 추가되었습니다`)
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '추가 실패'
    ElMessage.error(msg)
  } finally {
    addingMember.value = false
  }
}

async function removeMember(member: UserGroupMembershipEntity) {
  if (!selectedGroup.value) return
  try {
    await ElMessageBox.confirm(
      `${member.user?.name}님을 그룹에서 제거하시겠습니까?`,
      '멤버 제거',
      { type: 'warning' },
    )
    await groupsApi.removeMember(selectedGroup.value.id, member.userId)
    await loadGroupMembers()
    await loadGroups()
    ElMessage.success('멤버가 제거되었습니다')
  } catch {
    // 취소
  }
}

// 폴더 권한 관리
async function openFolderAccessDialog() {
  folderAccessForm.value = {
    domainCode: '',
    categoryId: null,
    accessType: 'READ',
    includeChildren: true,
  }
  categories.value = []
  showFolderAccessDialog.value = true
}

async function onDomainChange() {
  if (!folderAccessForm.value.domainCode) {
    categories.value = []
    return
  }
  categoriesLoading.value = true
  try {
    const { data } = await categoriesApi.getByDomain(folderAccessForm.value.domainCode)
    categories.value = data
  } catch {
    categories.value = []
  } finally {
    categoriesLoading.value = false
  }
}

async function addFolderAccess() {
  if (!selectedGroup.value || !folderAccessForm.value.categoryId) {
    ElMessage.warning('폴더를 선택하세요')
    return
  }
  addingFolderAccess.value = true
  try {
    await groupsApi.setFolderAccess(selectedGroup.value.id, {
      categoryId: folderAccessForm.value.categoryId,
      accessType: folderAccessForm.value.accessType,
      includeChildren: folderAccessForm.value.includeChildren,
    })
    await loadGroupFolders()
    await loadGroups()
    showFolderAccessDialog.value = false
    ElMessage.success('폴더 권한이 추가되었습니다')
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '추가 실패'
    ElMessage.error(msg)
  } finally {
    addingFolderAccess.value = false
  }
}

async function removeFolderAccess(access: GroupFolderAccessEntity) {
  if (!selectedGroup.value) return
  try {
    await ElMessageBox.confirm(
      `"${access.folderName}" 폴더에 대한 권한을 삭제하시겠습니까?`,
      '폴더 권한 삭제',
      { type: 'warning' },
    )
    await groupsApi.removeFolderAccess(selectedGroup.value.id, access.categoryId)
    await loadGroupFolders()
    await loadGroups()
    ElMessage.success('폴더 권한이 삭제되었습니다')
  } catch {
    // 취소
  }
}

function getDomainName(code: string): string {
  return domainStore.domainsFlat.find((d) => d.code === code)?.displayName ?? code
}

// ============================================================
// 초기화
// ============================================================

onMounted(async () => {
  await Promise.all([loadUsers(), loadGroups()])
  await domainStore.loadDomains()
})
</script>

<template>
  <div style="height: 100%; overflow-y: auto">
    <h2 style="margin: 0 0 12px; font-size: 20px">권한 관리</h2>

    <el-tabs v-model="activeTab">
      <!-- ============================================================ -->
      <!-- 사용자 권한 탭 -->
      <!-- ============================================================ -->
      <el-tab-pane label="사용자 권한" name="users">
        <div style="display: flex; gap: 16px; height: calc(100vh - 180px)">
          <!-- 사용자 목록 -->
          <el-card shadow="never" style="flex: 1; overflow: hidden; display: flex; flex-direction: column">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span style="font-weight: 600">사용자 목록</span>
                <el-input
                  v-model="searchKeyword"
                  placeholder="이름 또는 이메일 검색"
                  :prefix-icon="Search"
                  clearable
                  style="width: 200px"
                  size="small"
                />
              </div>
            </template>
            <el-table
              v-loading="usersLoading"
              :data="filteredUsers"
              size="small"
              :header-cell-style="{ background: '#fafafa' }"
              highlight-current-row
              style="flex: 1"
              @current-change="selectUser"
            >
              <el-table-column prop="name" label="이름" width="100" />
              <el-table-column prop="email" label="이메일" min-width="160" />
              <el-table-column label="역할" width="80">
                <template #default="{ row }">
                  {{ ROLE_LABELS[row.role] ?? row.role }}
                </template>
              </el-table-column>
              <el-table-column label="상태" width="60" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.isActive ? 'success' : 'danger'" size="small">
                    {{ row.isActive ? '활성' : '비활성' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 사용자 그룹 설정 패널 -->
          <el-card shadow="never" style="width: 360px; overflow: hidden; display: flex; flex-direction: column">
            <template #header>
              <span style="font-weight: 600">
                {{ selectedUser ? `${selectedUser.name} 소속 그룹` : '사용자를 선택하세요' }}
              </span>
            </template>

            <div v-if="!selectedUser" style="text-align: center; color: #909399; padding: 40px 0">
              왼쪽 목록에서 사용자를 선택하면<br>소속 그룹을 설정할 수 있습니다.
            </div>

            <div v-else v-loading="userGroupsLoading" style="flex: 1; overflow-y: auto">
              <div style="margin-bottom: 12px; font-size: 13px; color: #606266">
                기본 역할: <el-tag size="small">{{ ROLE_LABELS[selectedUser.role] ?? selectedUser.role }}</el-tag>
              </div>

              <el-checkbox-group v-model="selectedGroupIds" style="display: flex; flex-direction: column; gap: 8px">
                <el-checkbox
                  v-for="group in allGroups"
                  :key="group.id"
                  :value="group.id"
                  :disabled="!group.isActive"
                  style="margin: 0"
                >
                  <span>{{ group.name }}</span>
                  <span v-if="!group.isActive" style="color: #909399; font-size: 12px"> (비활성)</span>
                </el-checkbox>
              </el-checkbox-group>

              <div v-if="allGroups.length === 0" style="text-align: center; color: #909399; padding: 20px 0">
                등록된 권한 그룹이 없습니다
              </div>
            </div>

            <div v-if="selectedUser" style="padding-top: 12px; border-top: 1px solid #ebeef5">
              <el-button type="primary" :loading="savingUserGroups" @click="saveUserGroups" style="width: 100%">
                저장
              </el-button>
            </div>
          </el-card>
        </div>
      </el-tab-pane>

      <!-- ============================================================ -->
      <!-- 권한 그룹 탭 -->
      <!-- ============================================================ -->
      <el-tab-pane label="권한 그룹" name="groups">
        <div style="display: flex; gap: 16px; height: calc(100vh - 180px)">
          <!-- 그룹 목록 -->
          <el-card shadow="never" style="width: 400px; overflow: hidden; display: flex; flex-direction: column">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span style="font-weight: 600">그룹 목록</span>
                <el-button type="primary" size="small" :icon="Plus" @click="openCreateGroupDialog">
                  새 그룹
                </el-button>
              </div>
            </template>
            <el-table
              v-loading="groupsLoading"
              :data="groups"
              size="small"
              :header-cell-style="{ background: '#fafafa' }"
              highlight-current-row
              style="flex: 1"
              @current-change="selectGroup"
            >
              <el-table-column prop="name" label="그룹명" min-width="120" />
              <el-table-column label="멤버" width="60" align="center">
                <template #default="{ row }">{{ row.memberCount ?? 0 }}</template>
              </el-table-column>
              <el-table-column label="폴더" width="60" align="center">
                <template #default="{ row }">{{ row.folderCount ?? 0 }}</template>
              </el-table-column>
              <el-table-column label="상태" width="60" align="center">
                <template #default="{ row }">
                  <el-tag
                    :type="row.isActive ? 'success' : 'danger'"
                    size="small"
                    style="cursor: pointer"
                    @click.stop="toggleGroupActive(row)"
                  >
                    {{ row.isActive ? '활성' : '비활성' }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <!-- 그룹 상세 패널 -->
          <el-card shadow="never" style="flex: 1; overflow: hidden; display: flex; flex-direction: column">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center">
                <span style="font-weight: 600">
                  {{ selectedGroup ? selectedGroup.name : '그룹을 선택하세요' }}
                </span>
                <div v-if="selectedGroup">
                  <el-button size="small" @click="openEditGroupDialog(selectedGroup)">수정</el-button>
                  <el-button size="small" type="danger" @click="deleteGroup(selectedGroup)">삭제</el-button>
                </div>
              </div>
            </template>

            <div v-if="!selectedGroup" style="text-align: center; color: #909399; padding: 60px 0">
              왼쪽 목록에서 그룹을 선택하면<br>멤버와 폴더 권한을 관리할 수 있습니다.
            </div>

            <template v-else>
              <div v-if="selectedGroup.description" style="margin-bottom: 12px; color: #606266; font-size: 13px">
                {{ selectedGroup.description }}
              </div>

              <el-tabs v-model="groupDetailTab" style="flex: 1; display: flex; flex-direction: column">
                <!-- 멤버 탭 -->
                <el-tab-pane label="멤버" name="members" style="flex: 1; overflow-y: auto">
                  <div style="margin-bottom: 12px">
                    <el-button size="small" :icon="Plus" @click="openAddMemberDialog">멤버 추가</el-button>
                  </div>
                  <el-table
                    v-loading="groupMembersLoading"
                    :data="groupMembers"
                    size="small"
                    :header-cell-style="{ background: '#fafafa' }"
                  >
                    <el-table-column label="이름" width="100">
                      <template #default="{ row }">{{ row.user?.name }}</template>
                    </el-table-column>
                    <el-table-column label="이메일" min-width="160">
                      <template #default="{ row }">{{ row.user?.email }}</template>
                    </el-table-column>
                    <el-table-column label="추가일" width="100">
                      <template #default="{ row }">
                        {{ new Date(row.joinedAt).toLocaleDateString('ko-KR') }}
                      </template>
                    </el-table-column>
                    <el-table-column width="60" align="center">
                      <template #default="{ row }">
                        <el-button size="small" text type="danger" :icon="Delete" @click="removeMember(row)" />
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-if="!groupMembersLoading && groupMembers.length === 0" description="멤버가 없습니다" />
                </el-tab-pane>

                <!-- 폴더 권한 탭 -->
                <el-tab-pane label="폴더 권한" name="folders" style="flex: 1; overflow-y: auto">
                  <div style="margin-bottom: 12px">
                    <el-button size="small" :icon="Plus" @click="openFolderAccessDialog">폴더 권한 추가</el-button>
                  </div>
                  <el-table
                    v-loading="groupFoldersLoading"
                    :data="groupFolders"
                    size="small"
                    :header-cell-style="{ background: '#fafafa' }"
                  >
                    <el-table-column label="도메인" width="100">
                      <template #default="{ row }">{{ getDomainName(row.domainCode) }}</template>
                    </el-table-column>
                    <el-table-column label="폴더" min-width="140">
                      <template #default="{ row }">
                        <span>{{ row.folderName }}</span>
                        <span style="color: #909399; font-size: 11px; margin-left: 4px">({{ row.folderCode }})</span>
                      </template>
                    </el-table-column>
                    <el-table-column label="권한" width="70" align="center">
                      <template #default="{ row }">
                        <el-tag :type="row.accessType === 'WRITE' ? 'warning' : 'info'" size="small">
                          {{ FOLDER_PERMISSION_LABELS[row.accessType] }}
                        </el-tag>
                      </template>
                    </el-table-column>
                    <el-table-column label="하위" width="60" align="center">
                      <template #default="{ row }">
                        <el-icon v-if="row.includeChildren" style="color: #67c23a"><component is="Check" /></el-icon>
                        <span v-else style="color: #909399">-</span>
                      </template>
                    </el-table-column>
                    <el-table-column width="60" align="center">
                      <template #default="{ row }">
                        <el-button size="small" text type="danger" :icon="Delete" @click="removeFolderAccess(row)" />
                      </template>
                    </el-table-column>
                  </el-table>
                  <el-empty v-if="!groupFoldersLoading && groupFolders.length === 0" description="폴더 권한이 없습니다" />
                </el-tab-pane>
              </el-tabs>
            </template>
          </el-card>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- 그룹 생성/수정 다이얼로그 -->
    <el-dialog
      v-model="showGroupDialog"
      :title="editingGroup ? '그룹 수정' : '새 그룹'"
      width="400px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="그룹 이름" required>
          <el-input v-model="groupForm.name" placeholder="예: 영업팀, 수수료TF" maxlength="100" />
        </el-form-item>
        <el-form-item label="설명">
          <el-input
            v-model="groupForm.description"
            type="textarea"
            :rows="3"
            placeholder="그룹에 대한 설명 (선택)"
            maxlength="500"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGroupDialog = false">취소</el-button>
        <el-button type="primary" :loading="savingGroup" @click="saveGroup">
          {{ editingGroup ? '수정' : '생성' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 멤버 추가 다이얼로그 -->
    <el-dialog v-model="showAddMemberDialog" title="멤버 추가" width="480px" destroy-on-close>
      <el-input
        v-model="memberSearchKeyword"
        placeholder="이름 또는 이메일로 검색"
        :prefix-icon="Search"
        clearable
        style="margin-bottom: 12px"
      />
      <el-table
        :data="usersNotInGroup"
        size="small"
        :header-cell-style="{ background: '#fafafa' }"
        max-height="300"
      >
        <el-table-column prop="name" label="이름" width="100" />
        <el-table-column prop="email" label="이메일" min-width="160" />
        <el-table-column width="80" align="center">
          <template #default="{ row }">
            <el-button size="small" type="primary" :loading="addingMember" @click="addMember(row)">추가</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="usersNotInGroup.length === 0" description="추가할 수 있는 사용자가 없습니다" />
    </el-dialog>

    <!-- 폴더 권한 추가 다이얼로그 -->
    <el-dialog v-model="showFolderAccessDialog" title="폴더 권한 추가" width="480px" destroy-on-close>
      <el-form label-position="top">
        <el-form-item label="도메인" required>
          <el-select
            v-model="folderAccessForm.domainCode"
            placeholder="도메인 선택"
            style="width: 100%"
            @change="onDomainChange"
          >
            <el-option
              v-for="d in domainStore.domainsFlat"
              :key="d.code"
              :label="d.displayName"
              :value="d.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="폴더" required>
          <el-tree-select
            v-model="folderAccessForm.categoryId"
            :data="categoryTree"
            :props="{ label: 'label', children: 'children', value: 'id' }"
            placeholder="폴더 선택"
            check-strictly
            style="width: 100%"
            :loading="categoriesLoading"
            :disabled="!folderAccessForm.domainCode"
          />
        </el-form-item>
        <el-form-item label="권한" required>
          <el-radio-group v-model="folderAccessForm.accessType">
            <el-radio value="READ">읽기</el-radio>
            <el-radio value="WRITE">쓰기</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="하위 폴더 포함">
          <el-switch v-model="folderAccessForm.includeChildren" />
          <span style="margin-left: 8px; font-size: 12px; color: #909399">
            {{ folderAccessForm.includeChildren ? '하위 폴더에도 동일한 권한 적용' : '선택한 폴더에만 적용' }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFolderAccessDialog = false">취소</el-button>
        <el-button type="primary" :loading="addingFolderAccess" @click="addFolderAccess">추가</el-button>
      </template>
    </el-dialog>
  </div>
</template>
