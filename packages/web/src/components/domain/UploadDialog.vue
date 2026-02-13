<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="emit('update:visible', $event)"
    title="문서 업로드"
    width="550px"
    :close-on-click-modal="false"
    destroy-on-close
  >
    <el-form label-position="top">
      <!-- 파일 선택 (복수) -->
      <el-form-item label="파일 선택" required>
        <el-upload
          :auto-upload="false"
          :file-list="fileList"
          :on-change="onFileChange"
          :on-remove="onFileRemove"
          accept=".pdf,.md,.csv"
          multiple
          drag
        >
          <el-icon style="font-size: 32px; color: var(--el-text-color-placeholder)"><UploadFilled /></el-icon>
          <div>파일을 드래그하거나 클릭하여 선택하세요</div>
          <template #tip>
            <div class="el-upload__tip">PDF, Markdown, CSV만 허용 (최대 50MB, 20개)</div>
          </template>
        </el-upload>
      </el-form-item>

      <!-- 보안 등급 -->
      <el-form-item label="보안 등급">
        <el-select v-model="form.securityLevel" style="width: 100%">
          <el-option
            v-for="(label, key) in SECURITY_LEVEL_LABELS"
            :key="key"
            :label="label"
            :value="key"
          />
        </el-select>
      </el-form-item>

      <!-- 유효기간 -->
      <el-form-item label="유효기간 (선택)">
        <el-date-picker
          v-model="form.validUntil"
          type="date"
          placeholder="유효기간 미설정"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          clearable
        />
      </el-form-item>
    </el-form>

    <!-- 결과 표시 -->
    <div v-if="uploadResults.length > 0" style="margin-top: 12px">
      <el-divider content-position="left">업로드 결과</el-divider>
      <div v-for="(r, i) in uploadResults" :key="i" class="upload-result">
        <el-icon v-if="r.success" style="color: var(--el-color-success)"><CircleCheck /></el-icon>
        <el-icon v-else style="color: var(--el-color-danger)"><CircleClose /></el-icon>
        <span>{{ r.fileName }}</span>
        <el-tag v-if="r.success" size="small" type="success">{{ r.docCode }}</el-tag>
        <el-tag v-else size="small" type="danger">{{ r.error }}</el-tag>
      </div>
    </div>

    <template #footer>
      <el-button @click="emit('update:visible', false)">{{ uploadResults.length > 0 ? '닫기' : '취소' }}</el-button>
      <el-button
        v-if="uploadResults.length === 0"
        type="primary"
        :loading="uploading"
        :disabled="selectedFiles.length === 0"
        @click="submit"
      >
        업로드 ({{ selectedFiles.length }}개)
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { UploadFilled, CircleCheck, CircleClose } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/api/documents'
import { SECURITY_LEVEL_LABELS } from '@kms/shared'
import { getApiErrorMessage } from '@/utils'
import type { UploadFile } from 'element-plus'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  'update:visible': [value: boolean]
  uploaded: []
}>()

const uploading = ref(false)
const selectedFiles = ref<File[]>([])
const fileList = ref<UploadFile[]>([])
const uploadResults = ref<Array<{
  fileName: string
  success: boolean
  docCode?: string | null
  error?: string
}>>([])

const form = ref({
  securityLevel: 'INTERNAL',
  validUntil: '',
})

function onFileChange(file: UploadFile) {
  if (file.raw) {
    selectedFiles.value.push(file.raw)
  }
}

function onFileRemove(file: UploadFile) {
  const idx = selectedFiles.value.findIndex((f) => f.name === file.name)
  if (idx >= 0) selectedFiles.value.splice(idx, 1)
}

async function submit() {
  if (selectedFiles.value.length === 0) return
  uploading.value = true
  uploadResults.value = []

  try {
    if (selectedFiles.value.length === 1) {
      const file = selectedFiles.value[0]
      try {
        const res = await documentsApi.upload(file, {
          securityLevel: form.value.securityLevel,
          validUntil: form.value.validUntil || undefined,
        })
        uploadResults.value = [{
          fileName: file.name,
          success: true,
          docCode: res.data.docCode,
        }]
      } catch (err) {
        uploadResults.value = [{ fileName: file.name, success: false, error: getApiErrorMessage(err, '업로드 실패') }]
      }
    } else {
      const res = await documentsApi.bulkUpload(selectedFiles.value, form.value.securityLevel)
      uploadResults.value = res.data.results.map((r) => ({
        fileName: r.fileName,
        success: r.success,
        docCode: r.docCode,
        error: r.error,
      }))
    }

    const successCount = uploadResults.value.filter((r) => r.success).length
    if (successCount > 0) {
      ElMessage.success(`${successCount}개 파일 업로드 완료`)
      emit('uploaded')
    }
  } catch {
    ElMessage.error('업로드 실패')
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.upload-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}
</style>
