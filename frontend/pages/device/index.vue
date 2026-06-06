<template>
  <div class="device-page">
    <TablePage
      :data="data"
      :total="total"
      :loading="loading"
      @search="handleSearch"
      @reset="handleReset"
      @refresh="handleRefresh"
      @page-change="handlePageChange"
      @selection-change="handleSelectionChange"
    >
      <!-- 搜索栏 -->
      <template #search>
        <el-form :inline="true" :model="queryParams" class="search-form">
          <el-form-item label="设备名称">
            <el-input
              v-model="queryParams.deviceName"
              placeholder="请输入设备名称"
              clearable
            />
          </el-form-item>
          <el-form-item label="设备类型">
            <el-select
              v-model="queryParams.deviceType"
              placeholder="请选择设备类型"
              clearable
            >
              <el-option label="变压器" value="TRANSFORMER" />
              <el-option label="线路" value="LINE" />
              <el-option label="断路器" value="BREAKER" />
              <el-option label="发电机" value="GENERATOR" />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select
              v-model="queryParams.status"
              placeholder="请选择状态"
              clearable
            >
              <el-option label="离线" :value="0" />
              <el-option label="在线" :value="1" />
              <el-option label="故障" :value="2" />
              <el-option label="维护" :value="3" />
            </el-select>
          </el-form-item>
        </el-form>
      </template>

      <!-- 工具栏左侧 -->
      <template #toolbar-left>
        <el-button v-if="isAdmin" type="primary" @click="handleAdd">
          <el-icon><Plus /></el-icon>
          新增设备
        </el-button>
        <el-upload
          v-if="isAdmin"
          ref="uploadRef"
          :auto-upload="false"
          :show-file-list="false"
          :on-change="handleFileChange"
          accept=".xlsx,.xls,.csv"
          style="display: inline-block; margin-left: 10px;"
        >
          <el-button type="success">
            <el-icon><Upload /></el-icon>
            自动导入
          </el-button>
        </el-upload>
        <el-button v-if="isAdmin" type="info" @click="handleDownloadTemplate">
          <el-icon><Download /></el-icon>
          下载模板
        </el-button>
        <el-button
          v-if="isAdmin"
          type="danger"
          :disabled="selectedRows.length === 0"
          @click="handleBatchDelete"
        >
          <el-icon><Delete /></el-icon>
          批量删除
        </el-button>
      </template>

      <!-- 表格列 -->
      <el-table-column v-if="isAdmin" type="selection" width="55" />
      <el-table-column prop="id" label="设备ID" width="80" />
      <el-table-column prop="deviceCode" label="设备编号" width="150" />
      <el-table-column prop="deviceName" label="设备名称" width="150" />
      <el-table-column prop="substation" label="所属变电站" width="180" />
      <el-table-column prop="deviceType" label="设备类型" width="120">
        <template #default="{ row }">
          <el-tag>{{ getDeviceTypeLabel(row.deviceType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="location" label="位置" width="150" />
      <el-table-column prop="voltage" label="电压(kV)" width="100" />
      <el-table-column prop="current" label="电流(A)" width="100" />
      <el-table-column prop="power" label="功率(MW)" width="100" />
      <el-table-column prop="status" label="状态" width="100">
        <template #default="{ row }">
          <StatusTag :status="row.status" />
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="创建时间" width="180" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleView(row)">
            查看
          </el-button>
          <el-button v-if="isAdmin" link type="primary" @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button v-if="isAdmin" link type="danger" @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </TablePage>

    <!-- 查看设备详情抽屉 -->
    <el-drawer
      v-model="viewDrawerVisible"
      title="设备详情"
      size="600px"
      direction="rtl"
    >
      <div v-if="viewDevice" class="device-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="设备编号">
            {{ viewDevice.deviceCode }}
          </el-descriptions-item>
          <el-descriptions-item label="设备名称">
            {{ viewDevice.deviceName }}
          </el-descriptions-item>
          <el-descriptions-item label="所属变电站">
            {{ viewDevice.substation || '未设置' }}
          </el-descriptions-item>
          <el-descriptions-item label="设备类型">
            {{ viewDevice.deviceType }}
          </el-descriptions-item>
          <el-descriptions-item label="所属区域">
            {{ viewDevice.location }}
          </el-descriptions-item>
          <el-descriptions-item label="电压等级">
            {{ viewDevice.voltageLevel }}
          </el-descriptions-item>
          <el-descriptions-item label="额定电压">
            {{ viewDevice.voltage }} V
          </el-descriptions-item>
          <el-descriptions-item label="额定电流">
            {{ viewDevice.current }} A
          </el-descriptions-item>
          <el-descriptions-item label="额定功率">
            {{ viewDevice.power }} kW
          </el-descriptions-item>
          <el-descriptions-item label="运行状态">
            <StatusTag :status="viewDevice.status" />
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ viewDevice.createTime }}
          </el-descriptions-item>
        </el-descriptions>

        <!-- 最近诊断记录 -->
        <el-divider content-position="left">最近诊断记录</el-divider>
        <el-table :data="deviceDiagnosis" border stripe max-height="300">
          <el-table-column prop="diagnosisTime" label="诊断时间" width="160" />
          <el-table-column prop="faultType" label="故障类型" width="120">
            <template #default="{ row }">
              <el-tag :type="row.faultType === 0 ? 'success' : 'danger'">
                {{ ['正常', '单相接地', '相间短路', '三相短路', '两相接地', '三相接地短路'][row.faultType] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="confidence" label="置信度" width="100">
            <template #default="{ row }">
              {{ row.confidence }}%
            </template>
          </el-table-column>
        </el-table>

        <!-- 最近预警记录 -->
        <el-divider content-position="left">最近预警记录</el-divider>
        <el-table :data="deviceAlerts" border stripe max-height="300">
          <el-table-column prop="alertTime" label="预警时间" width="160" />
          <el-table-column prop="level" label="预警等级" width="100">
            <template #default="{ row }">
              <el-tag :type="row.level === 3 ? 'danger' : row.level === 2 ? 'warning' : 'info'">
                {{ ['', '一般', '严重', '紧急'][row.level] }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="type" label="预警类型" width="140" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 0 ? 'danger' : row.status === 1 ? 'warning' : 'success'">
                {{ ['待处理', '处理中', '已处理'][row.status] }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-drawer>

    <!-- 新增/编辑对话框 -->
    <FormDialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :form-data="formData"
      :rules="formRules"
      :loading="formLoading"
      @confirm="handleFormConfirm"
    >
      <template #default="{ formData }">
        <el-form-item label="设备编号" prop="deviceCode">
          <el-input v-model="formData.deviceCode" placeholder="请输入设备编号" />
        </el-form-item>
        <el-form-item label="设备名称" prop="deviceName">
          <el-input v-model="formData.deviceName" placeholder="请输入设备名称" />
        </el-form-item>
        <el-form-item label="设备类型" prop="deviceType">
          <el-select v-model="formData.deviceType" placeholder="请选择设备类型">
            <el-option label="变压器" value="TRANSFORMER" />
            <el-option label="线路" value="LINE" />
            <el-option label="断路器" value="BREAKER" />
            <el-option label="发电机" value="GENERATOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="位置" prop="location">
          <el-input v-model="formData.location" placeholder="请输入位置" />
        </el-form-item>
        <el-form-item label="电压(kV)" prop="voltage">
          <el-input-number v-model="formData.voltage" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="电流(A)" prop="current">
          <el-input-number v-model="formData.current" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="功率(MW)" prop="power">
          <el-input-number v-model="formData.power" :min="0" :precision="2" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="formData.status">
            <el-radio :label="0">离线</el-radio>
            <el-radio :label="1">在线</el-radio>
            <el-radio :label="2">故障</el-radio>
            <el-radio :label="3">维护</el-radio>
          </el-radio-group>
        </el-form-item>
      </template>
    </FormDialog>
  </div>
</template>

<script setup lang="ts">
import { Plus, Delete, Download, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import type { UploadFile } from 'element-plus'
import TablePage from '~/components/common/TablePage.vue'
import FormDialog from '~/components/common/FormDialog.vue'
import StatusTag from '~/components/common/StatusTag.vue'
import { useUserStore } from '~/stores/user'

// 用户权限
const userStore = useUserStore()
const isAdmin = computed(() => userStore.isAdmin)

// 表格数据
const loading = ref(false)
const data = ref([])
const total = ref(0)
const selectedRows = ref([])
const queryParams = reactive({ page: 1, size: 10, deviceName: '', deviceType: '', status: null })

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({ page: String(queryParams.page), size: String(queryParams.size) })
    if (queryParams.deviceName) params.set('deviceName', queryParams.deviceName)
    if (queryParams.deviceType) params.set('deviceType', queryParams.deviceType)
    if (queryParams.status !== null && queryParams.status !== undefined) params.set('status', String(queryParams.status))
    const res = await $fetch(`/api/v1/device/page?${params}`)
    data.value = res.data.records
    total.value = res.data.total
  } catch { data.value = []; total.value = 0 }
  finally { loading.value = false }
}

const handleSearch = () => { queryParams.page = 1; loadData() }
const handleReset = () => { queryParams.deviceName = ''; queryParams.deviceType = ''; queryParams.status = null; handleSearch() }
const handleRefresh = () => loadData()
const handlePageChange = ({ page, size }: any) => { queryParams.page = page; queryParams.size = size; loadData() }
const handleSelectionChange = (sel: any[]) => { selectedRows.value = sel }

// 表单逻辑
const dialogVisible = ref(false)
const dialogTitle = ref('新增设备')
const formLoading = ref(false)
const isEdit = ref(false)
const editId = ref<number>()

const formData = reactive({
  deviceCode: '',
  deviceName: '',
  deviceType: '',
  location: '',
  voltage: 0,
  current: 0,
  power: 0,
  status: 1
})

const formRules = {
  deviceCode: [{ required: true, message: '请输入设备编号', trigger: 'blur' }],
  deviceName: [{ required: true, message: '请输入设备名称', trigger: 'blur' }],
  deviceType: [{ required: true, message: '请选择设备类型', trigger: 'change' }],
  location: [{ required: true, message: '请输入位置', trigger: 'blur' }]
}

// 新增
const handleAdd = () => {
  isEdit.value = false
  dialogTitle.value = '新增设备'
  Object.assign(formData, {
    deviceCode: '',
    deviceName: '',
    deviceType: '',
    location: '',
    voltage: 0,
    current: 0,
    power: 0,
    status: 1
  })
  dialogVisible.value = true
}

// 编辑
const handleEdit = (row: any) => {
  isEdit.value = true
  editId.value = row.id
  dialogTitle.value = '编辑设备'
  Object.assign(formData, row)
  dialogVisible.value = true
}

// 查看
const viewDrawerVisible = ref(false)
const viewDevice = ref<any>(null)
const deviceDiagnosis = ref<any[]>([])
const deviceAlerts = ref<any[]>([])

const handleView = async (row: any) => {
  viewDevice.value = row
  viewDrawerVisible.value = true

  // 加载设备的诊断记录
  try {
    const diagnosisRes = await $fetch(`/api/v1/diagnosis/page?deviceId=${row.id}&page=1&size=5`)
    deviceDiagnosis.value = diagnosisRes.data?.records || []
  } catch (error) {
    deviceDiagnosis.value = []
  }

  // 加载设备的预警记录
  try {
    const alertRes = await $fetch(`/api/v1/alert/page?deviceId=${row.id}&page=1&size=5`)
    deviceAlerts.value = alertRes.data?.records || []
  } catch (error) {
    deviceAlerts.value = []
  }
}

// 表单提交
const handleFormConfirm = async () => {
  formLoading.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/v1/device/${editId.value}`, { method: 'PUT', body: formData })
      ElMessage.success('更新成功')
    } else {
      await $fetch('/api/v1/device', { method: 'POST', body: formData })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    loadData()
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    formLoading.value = false
  }
}

// 删除
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm('确定要删除该设备吗？', '提示', { type: 'warning' })
    await $fetch(`/api/v1/device/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.toString() !== 'cancel') ElMessage.error('删除失败')
  }
}

// 批量删除
const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确定要删除选中的 ${selectedRows.value.length} 个设备吗？`, '提示', { type: 'warning' })
    for (const row of selectedRows.value) {
      await $fetch(`/api/v1/device/${(row as any).id}`, { method: 'DELETE' })
    }
    ElMessage.success('批量删除成功')
    loadData()
  } catch (error: any) {
    if (error !== 'cancel' && error?.toString() !== 'cancel') ElMessage.error('批量删除失败')
  }
}

// 文件上传处理
const handleFileChange = async (file: UploadFile) => {
  if (!file.raw) return

  const loading = ElLoading.service({ text: '正在解析文件...' })

  try {
    // 创建 FormData
    const formData = new FormData()
    formData.append('file', file.raw)

    // 上传文件
    const result = await $fetch('/api/v1/device/import', {
      method: 'POST',
      body: formData
    })

    loading.close()

    if (result.code === 200) {
      // 显示导入结果
      if (result.data.skipped > 0 && result.data.duplicates) {
        // 有重复设备，显示详细信息
        ElMessageBox.alert(
          `成功导入 ${result.data.imported} 个设备\n跳过 ${result.data.skipped} 个重复设备：\n\n${result.data.duplicates.join('\n')}`,
          '导入完成',
          {
            confirmButtonText: '确定',
            type: 'warning',
            dangerouslyUseHTMLString: false
          }
        )
      } else {
        ElMessage.success(`成功导入 ${result.data.imported} 个设备`)
      }
      loadData()
    } else {
      ElMessage.error(result.message || '导入失败')
    }
  } catch (error: any) {
    loading.close()
    ElMessage.error(error.data?.message || '导入失败')
  }
}

// 下载模板
const handleDownloadTemplate = () => {
  // 创建 CSV 模板内容
  const template = [
    ['设备编号', '设备名称', '所属变电站', '设备类型', '位置', '电压等级', '电压(V)', '电流(A)', '功率(MW)', '状态', '经度', '纬度', '制造商', '型号', '安装日期'],
    ['SH-PD-220-0001', '变压器#001', '浦东新区1号变电站', 'TRANSFORMER', '上海市浦东新区', '220kV', '220000', '500', '100', '1', '121.5447', '31.2304', 'ABB', 'TZ-220-500', '2023-01-15 10:00:00'],
    ['SH-HP-110-0002', '断路器#002', '黄浦区2号变电站', 'CIRCUIT_BREAKER', '上海市黄浦区', '110kV', '110000', '300', '50', '1', '121.4737', '31.2304', '西门子', 'CB-110-300', '2023-02-20 14:30:00'],
    ['SH-XH-035-0003', '隔离开关#003', '徐汇区3号变电站', 'DISCONNECTOR', '上海市徐汇区', '35kV', '35000', '150', '20', '1', '121.4367', '31.1880', '施耐德', 'DS-35-150', '2023-03-10 09:15:00']
  ]

  // 转换为 CSV 格式
  const csvContent = template.map(row => row.join(',')).join('\n')

  // 创建 Blob 并下载
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '设备导入模板.csv'
  link.click()
  URL.revokeObjectURL(url)

  ElMessage.success('模板下载成功！请填写设备信息后导入')
}

// 获取设备类型标签
const getDeviceTypeLabel = (type: string) => {
  const map: Record<string, string> = {
    TRANSFORMER: '变压器',
    CIRCUIT_BREAKER: '断路器',
    DISCONNECTOR: '隔离开关',
    BUSBAR: '母线',
    CAPACITOR: '电容器',
    REACTOR: '电抗器',
    LINE: '线路',
    BREAKER: '断路器',
    GENERATOR: '发电机'
  }
  return map[type] || type
}

onMounted(() => { loadData() })
</script>

<style scoped lang="scss">
.device-page {
  padding: 20px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 0;
  }

  :deep(.el-input),
  :deep(.el-select) {
    width: 220px;
  }

  :deep(.el-select .el-input) {
    width: 220px;
  }
}

.device-detail {
  padding: 10px;

  .el-divider {
    margin: 20px 0;
  }
}

@media (max-width: 1200px) {
  .search-form {
    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-select .el-input) {
      width: 180px;
    }
  }
}

@media (max-width: 768px) {
  .search-form {
    display: block;

    :deep(.el-form-item) {
      display: flex;
      margin-bottom: 12px;
    }

    :deep(.el-form-item__content),
    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-select .el-input) {
      width: 100%;
    }
  }
}
</style>
