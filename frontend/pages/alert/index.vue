<template>
  <div class="alert-page">
    <!-- 搜索栏 -->
    <el-card class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="预警等级">
          <el-select v-model="searchForm.level" placeholder="请选择预警等级" clearable>
            <el-option label="全部" :value="null" />
            <el-option label="一般" :value="1" />
            <el-option label="严重" :value="2" />
            <el-option label="紧急" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="处理状态">
          <el-select v-model="searchForm.status" placeholder="请选择处理状态" clearable>
            <el-option label="全部" :value="null" />
            <el-option label="待处理" :value="0" />
            <el-option label="处理中" :value="1" />
            <el-option label="已处理" :value="2" />
          </el-select>
        </el-form-item>
        <el-form-item label="预警时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
              <el-icon :size="32"><Bell /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.total }}</div>
              <div class="stat-label">总预警数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
              <el-icon :size="32"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.pending }}</div>
              <div class="stat-label">待处理</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
              <el-icon :size="32"><Loading /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.processing }}</div>
              <div class="stat-label">处理中</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
              <el-icon :size="32"><CircleCheck /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.completed }}</div>
              <div class="stat-label">已处理</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 预警列表 -->
    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>预警列表</span>
          <div>
            <el-button type="success" @click="navigateToNotifications">
              <el-icon><Message /></el-icon>
              查看通知记录
            </el-button>
            <el-button type="primary" @click="handleAddRule">
              <el-icon><Plus /></el-icon>
              添加预警规则
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="deviceName" label="设备名称" width="130" />
        <el-table-column prop="substation" label="所属变电站" width="150" />
        <el-table-column prop="confidence" label="置信度" width="100" sortable>
          <template #default="{ row }">
            <el-tag :type="getConfidenceTag(row.confidence)" effect="dark">
              {{ row.confidence }}%
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="level" label="预警等级" width="120">
          <template #default="{ row }">
            <el-tag :type="getLevelTag(row.level)" effect="dark">
              {{ getLevelName(row.level) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="type" label="预警类型" width="140" />
        <el-table-column prop="message" label="预警信息" min-width="200" show-overflow-tooltip />
        <el-table-column prop="alertTime" label="预警时间" width="180" />
        <el-table-column prop="status" label="处理状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status)">
              {{ getStatusName(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handler" label="处理人" width="100" />
        <el-table-column label="操作" width="250" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">查看详情</el-button>
            <el-button link type="success" @click="handleProcess(row)" v-if="row.status !== 2">
              处理
            </el-button>
            <el-button link type="warning" @click="handleNotify(row)">发送通知</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
        class="pagination"
      />
    </el-card>

    <!-- 预警详情对话框 -->
    <el-dialog v-model="detailVisible" title="预警详情" width="800px">
      <div v-if="currentAlert" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="预警ID">{{ currentAlert.id }}</el-descriptions-item>
          <el-descriptions-item label="设备名称">{{ currentAlert.deviceName }}</el-descriptions-item>
          <el-descriptions-item label="所属变电站">{{ currentAlert.substation || '未知' }}</el-descriptions-item>
          <el-descriptions-item label="置信度">
            <el-tag :type="getConfidenceTag(currentAlert.confidence)" effect="dark">
              {{ currentAlert.confidence }}%
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="预警等级">
            <el-tag :type="getLevelTag(currentAlert.level)" effect="dark">
              {{ getLevelName(currentAlert.level) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="预警类型">{{ currentAlert.type }}</el-descriptions-item>
          <el-descriptions-item label="通知方式">
            <el-tag type="primary" size="small">系统通知</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="预警时间">{{ currentAlert.alertTime }}</el-descriptions-item>
          <el-descriptions-item label="处理状态">
            <el-tag :type="getStatusTag(currentAlert.status)">
              {{ getStatusName(currentAlert.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="处理人">{{ currentAlert.handler || '未分配' }}</el-descriptions-item>
          <el-descriptions-item label="处理时间">{{ currentAlert.handleTime || '未处理' }}</el-descriptions-item>
          <el-descriptions-item label="预警信息" :span="2">{{ currentAlert.message }}</el-descriptions-item>
          <el-descriptions-item label="处理备注" :span="2">{{ currentAlert.remark || '无' }}</el-descriptions-item>
        </el-descriptions>

        <!-- 多级预警说明 -->
        <el-alert
          :title="getAlertLevelDescription(currentAlert.confidence)"
          :type="getAlertLevelType(currentAlert.confidence)"
          style="margin-top: 20px"
          :closable="false"
        >
          <template #default>
            <div style="line-height: 1.8;">
              <strong>多级预警机制：</strong><br/>
              • 高危预警（置信度 > 80%）：紧急等级，触发系统通知<br/>
              • 中危预警（置信度 50-80%）：严重等级，触发系统通知<br/>
              • 低危预警（置信度 30-50%）：一般等级，触发系统通知
            </div>
          </template>
        </el-alert>
      </div>
    </el-dialog>

    <!-- 处理预警对话框 -->
    <el-dialog v-model="processVisible" title="处理预警" width="600px">
      <el-form :model="processForm" label-width="100px">
        <el-form-item label="处理人">
          <el-input v-model="processForm.handler" readonly />
        </el-form-item>
        <el-form-item label="处理状态">
          <el-radio-group v-model="processForm.status">
            <el-radio :label="1">处理中</el-radio>
            <el-radio :label="2">已处理</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理备注">
          <el-input
            v-model="processForm.remark"
            type="textarea"
            :rows="4"
            placeholder="请输入处理备注"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="processVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitProcess">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="notifyVisible" title="发送通知" width="620px">
      <el-form :model="notifyForm" label-width="100px">
        <el-form-item label="设备名称">
          <el-input :model-value="notifyForm.deviceName" readonly />
        </el-form-item>
        <el-form-item label="通知内容">
          <el-input v-model="notifyForm.content" type="textarea" :rows="4" readonly />
        </el-form-item>
        <el-form-item label="接收账号">
          <el-select
            v-model="notifyForm.recipientIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="请选择接收人"
            style="width: 100%;"
          >
            <el-option
              v-for="user in notifyCandidates"
              :key="user.id"
              :label="`${user.realName || user.username} (${user.roleName})`"
              :value="user.id"
            />
          </el-select>
          <div style="margin-top:8px;color:#909399;font-size:12px;">
            默认已勾选除当前登录账号外的所有启用用户
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="notifyVisible = false">取消</el-button>
        <el-button type="primary" @click="submitNotify">发送</el-button>
      </template>
    </el-dialog>

    <!-- 预警规则对话框 -->
    <el-dialog v-model="ruleVisible" title="预警规则配置" width="700px">
      <el-alert
        title="预警规则说明"
        type="info"
        :closable="false"
        style="margin-bottom: 20px"
      >
        <p style="margin: 0; line-height: 1.8;">
          预警规则基于 Node IDs 故障诊断模型，当设备诊断结果为故障类型时自动触发预警。<br/>
          支持的预警类型：单相接地、相间短路、三相短路、两相接地、三相接地短路。
        </p>
      </el-alert>

      <el-form :model="ruleForm" label-width="120px">
        <el-form-item label="规则名称">
          <el-input v-model="ruleForm.name" placeholder="请输入规则名称，例如：高压设备故障预警" />
        </el-form-item>

        <el-form-item label="预警类型">
          <el-select v-model="ruleForm.type" placeholder="请选择预警类型">
            <el-option label="单相接地预警" value="单相接地预警" />
            <el-option label="相间短路预警" value="相间短路预警" />
            <el-option label="三相短路预警" value="三相短路预警" />
            <el-option label="两相接地预警" value="两相接地预警" />
            <el-option label="三相接地短路预警" value="三相接地短路预警" />
          </el-select>
        </el-form-item>

        <el-form-item label="预警等级">
          <el-select v-model="ruleForm.level" placeholder="请选择预警等级">
            <el-option label="一般（单相接地）" :value="1" />
            <el-option label="严重（相间短路、两相接地）" :value="2" />
            <el-option label="紧急（三相短路、三相接地短路）" :value="3" />
          </el-select>
        </el-form-item>

        <el-form-item label="置信度阈值">
          <el-slider
            v-model="ruleForm.confidenceThreshold"
            :min="50"
            :max="100"
            :step="5"
            show-input
          />
          <span style="color: #909399; font-size: 12px;">
            当诊断置信度 ≥ {{ ruleForm.confidenceThreshold }}% 时触发预警
          </span>
        </el-form-item>

        <el-form-item label="通知方式">
          <el-checkbox-group v-model="ruleForm.notifyMethods">
            <el-checkbox label="系统通知" />
          </el-checkbox-group>
          <div style="color: #909399; font-size: 12px; margin-top: 8px;">
            使用浏览器通知 API 推送桌面通知
          </div>
        </el-form-item>

        <el-form-item label="通知人员">
          <el-input
            v-model="ruleForm.notifyUsers"
            placeholder="请输入通知人员姓名，多个用逗号分隔，例如：张伟,李强,王芳"
          />
        </el-form-item>

        <el-form-item label="启用状态">
          <el-switch v-model="ruleForm.enabled" />
          <span style="margin-left: 12px; color: #909399; font-size: 12px;">
            {{ ruleForm.enabled ? '规则已启用' : '规则已禁用' }}
          </span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitRule">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Warning, Loading, CircleCheck, Plus, Message } from '@element-plus/icons-vue'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const currentHandlerName = computed(() => userStore.userInfo?.realName || userStore.userInfo?.username || '当前用户')

// 导航到通知记录页面
const navigateToNotifications = () => {
  navigateTo('/alert/notifications')
}

// 搜索表单
const searchForm = reactive({
  level: null,
  status: null,
  dateRange: []
})

// 统计数据
const stats = reactive({
  total: 0,
  pending: 0,
  processing: 0,
  completed: 0
})

// 表格数据
const tableData = ref([])
const loading = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

// 详情对话框
const detailVisible = ref(false)
const currentAlert = ref(null)

// 处理对话框
const processVisible = ref(false)
const processForm = reactive({
  status: 1,
  remark: '',
  handler: ''
})
const notifyVisible = ref(false)
const notifyCandidates = ref([])
const notifyForm = reactive({
  alertId: null,
  deviceId: null,
  deviceName: '',
  content: '',
  recipientIds: [] as number[]
})

// 规则对话框
const ruleVisible = ref(false)
const ruleForm = reactive({
  name: '',
  level: 1,
  type: '',
  confidenceThreshold: 80,
  notifyMethods: ['系统通知'],
  notifyUsers: '',
  enabled: true
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(pagination.page),
      size: String(pagination.size),
    })
    if (searchForm.level) params.set('level', String(searchForm.level))
    if (searchForm.status !== null && searchForm.status !== undefined) params.set('status', String(searchForm.status))

    // 处理日期范围
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      const [startDate, endDate] = searchForm.dateRange
      // 格式化为 YYYY-MM-DD
      const formatDate = (date) => {
        const d = new Date(date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      params.set('startDate', formatDate(startDate))
      params.set('endDate', formatDate(endDate))
    }

    const res = await $fetch(`/api/v1/alert/page?${params}`)
    tableData.value = res.data.records
    pagination.total = res.data.total
    stats.total = res.data.stats.total
    stats.pending = res.data.stats.pending
    stats.processing = res.data.stats.processing
    stats.completed = res.data.stats.completed
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

// 分页改变
const handlePageChange = () => {
  loadData()
}

// 每页数量改变
const handleSizeChange = () => {
  pagination.page = 1
  loadData()
}

// 重置
const handleReset = () => {
  searchForm.level = null
  searchForm.status = null
  searchForm.dateRange = []
  handleSearch()
}

// 查看详情
const handleView = (row: any) => {
  currentAlert.value = row
  detailVisible.value = true
}

// 处理预警
const handleProcess = (row: any) => {
  currentAlert.value = row
  processForm.status = 1
  processForm.remark = ''
  processForm.handler = currentHandlerName.value
  processVisible.value = true
}

// 提交处理
const handleSubmitProcess = async () => {
  try {
    await $fetch(`/api/v1/alert/${currentAlert.value.id}`, {
      method: 'PUT',
      body: { status: processForm.status, remark: processForm.remark, handler: processForm.handler }
    })
    ElMessage.success('处理成功')
    processVisible.value = false
    if (currentAlert.value) {
      currentAlert.value = {
        ...currentAlert.value,
        status: processForm.status,
        remark: processForm.remark,
        handler: processForm.handler,
        handleTime: processForm.status === 2 ? new Date().toISOString().slice(0, 19).replace('T', ' ') : currentAlert.value.handleTime
      }
    }
    loadData()
  } catch {
    ElMessage.error('处理失败')
  }
}

// 发送通知
const handleNotify = async (row: any) => {
  try {
    await ElMessageBox.confirm(
      `确认向相关人员发送预警通知？\n\n设备：${row.deviceName}\n预警类型：${row.type}\n预警等级：${getLevelName(row.level)}\n预警信息：${row.message}`,
      '发送通知',
      {
        confirmButtonText: '发送',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
  } catch (error) {
    if (error !== 'cancel') {
      console.error('发送通知失败:', error)
      ElMessage.error('发送通知失败')
    }
    return
  }

  try {
    const res = await $fetch('/api/v1/user')
    const currentUserId = userStore.userInfo?.id
    notifyCandidates.value = (res.data || []).filter((user: any) => user.status === 1)
    notifyForm.alertId = row.id
    notifyForm.deviceId = row.deviceId
    notifyForm.deviceName = row.deviceName
    notifyForm.content = `${row.type} - ${getLevelName(row.level)}：${row.message}`
    notifyForm.recipientIds = notifyCandidates.value
      .filter((user: any) => user.id !== currentUserId)
      .map((user: any) => user.id)
    notifyVisible.value = true
  } catch (error) {
    console.error('加载接收人失败:', error)
    ElMessage.error('加载接收人失败')
  }
}

const submitNotify = async () => {
  if (!notifyForm.recipientIds.length) {
    ElMessage.warning('请至少选择一个接收人')
    return
  }

  try {
    const res = await $fetch('/api/v1/notification/send', {
      method: 'POST',
      body: {
        alertId: notifyForm.alertId,
        deviceId: notifyForm.deviceId,
        deviceName: notifyForm.deviceName,
        type: '系统通知',
        content: notifyForm.content,
        recipientIds: notifyForm.recipientIds,
        senderId: userStore.userInfo?.id,
        senderUsername: userStore.userInfo?.username,
        senderName: currentHandlerName.value
      }
    })

    notifyVisible.value = false
    if (res.data?.blocked) {
      ElMessage.warning(res.message || '系统内通知已关闭')
      return
    }

    ElMessage.success({
      message: `通知已发送，接收人：${(res.data?.recipients || []).join('、')}`,
      duration: 3000,
      showClose: true
    })
  } catch (error) {
    console.error('发送通知失败:', error)
    ElMessage.error('发送通知失败')
  }
}

// 添加规则
const handleAddRule = () => {
  ruleForm.name = ''
  ruleForm.level = 1
  ruleForm.type = ''
  ruleForm.confidenceThreshold = 80
  ruleForm.notifyMethods = ['系统通知']
  ruleForm.notifyUsers = ''
  ruleForm.enabled = true
  ruleVisible.value = true
}

// 提交规则
const handleSubmitRule = () => {
  // 验证表单
  if (!ruleForm.name) {
    ElMessage.warning('请输入规则名称')
    return
  }
  if (!ruleForm.type) {
    ElMessage.warning('请选择预警类型')
    return
  }
  if (ruleForm.notifyMethods.length === 0) {
    ElMessage.warning('请选择至少一种通知方式')
    return
  }
  if (!ruleForm.notifyUsers) {
    ElMessage.warning('请输入通知人员')
    return
  }

  // 模拟保存规则
  ElMessage.success({
    message: `预警规则配置成功！\n规则名称：${ruleForm.name}\n预警类型：${ruleForm.type}\n置信度阈值：${ruleForm.confidenceThreshold}%\n通知方式：${ruleForm.notifyMethods.join('、')}`,
    duration: 3000,
    showClose: true
  })
  ruleVisible.value = false
}

// 获取等级名称
const getLevelName = (level: number) => {
  const names = ['', '一般', '严重', '紧急']
  return names[level] || '未知'
}

// 获取等级标签
const getLevelTag = (level: number) => {
  const tags = ['', 'info', 'warning', 'danger']
  return tags[level] || 'info'
}

// 获取状态名称
const getStatusName = (status: number) => {
  const names = ['待处理', '处理中', '已处理']
  return names[status] || '未知'
}

// 获取状态标签
const getStatusTag = (status: number) => {
  const tags = ['danger', 'warning', 'success']
  return tags[status] || 'info'
}

// 获取置信度标签颜色
const getConfidenceTag = (confidence: number) => {
  if (confidence > 80) return 'danger'   // 高危 - 红色
  if (confidence >= 50) return 'warning' // 中危 - 橙色
  return 'info'                          // 低危 - 蓝色
}

// 获取预警等级描述
const getAlertLevelDescription = (confidence: number) => {
  if (confidence > 80) return '🔴 高危预警（置信度 > 80%）'
  if (confidence >= 50) return '🟠 中危预警（置信度 50-80%）'
  return '🔵 低危预警（置信度 30-50%）'
}

// 获取预警等级类型
const getAlertLevelType = (confidence: number) => {
  if (confidence > 80) return 'error'
  if (confidence >= 50) return 'warning'
  return 'info'
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.alert-page {
  padding: 20px;
}

.search-card {
  margin-bottom: 20px;
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

  :deep(.el-select),
  :deep(.el-select .el-input) {
    width: 180px;
  }

  :deep(.el-date-editor.el-input__wrapper),
  :deep(.el-date-editor.el-range-editor),
  :deep(.el-date-editor) {
    width: 360px;
  }
}

.stats-row {
  margin-bottom: 20px;

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 20px;

      .stat-icon {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .stat-info {
        flex: 1;

        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: $text-primary;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: $text-secondary;
        }
      }
    }
  }
}

.table-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .pagination {
    margin-top: 20px;
    justify-content: flex-end;
  }
}

.detail-content {
  padding: 10px 0;
}

@media (max-width: 1200px) {
  .search-form {
    :deep(.el-date-editor.el-input__wrapper),
    :deep(.el-date-editor.el-range-editor),
    :deep(.el-date-editor) {
      width: 320px;
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
    :deep(.el-select),
    :deep(.el-select .el-input),
    :deep(.el-date-editor.el-input__wrapper),
    :deep(.el-date-editor.el-range-editor),
    :deep(.el-date-editor) {
      width: 100%;
    }
  }
}
</style>
