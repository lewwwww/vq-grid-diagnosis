<template>
  <div class="notifications-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>通知记录</span>
          <el-tag type="success">{{ isAdmin ? '全部通知' : '我的通知' }}</el-tag>
        </div>
      </template>

      <el-table :data="notifications" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="alertId" label="预警ID" width="100" />
        <el-table-column prop="deviceName" label="设备名称" width="150" />
        <el-table-column prop="type" label="通知类型" width="120">
          <template #default="{ row }">
            <el-tag type="primary" size="small">
              {{ row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="recipient" label="接收人" width="150" />
        <el-table-column prop="senderName" label="发送人" width="120" />
        <el-table-column prop="content" label="通知内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="sendTime" label="发送时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === '已送达' ? 'success' : 'warning'" size="small">
              {{ row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        class="pagination"
        @size-change="handlePageChange"
        @current-change="handlePageChange"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()
const isAdmin = computed(() => userStore.userInfo?.roleCode === 'ADMIN')
const notifications = ref([])
const loading = ref(false)
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

const loadData = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(pagination.page),
      size: String(pagination.size)
    })
    if (!isAdmin.value && userStore.userInfo?.username) {
      params.set('recipientUsername', userStore.userInfo.username)
    }
    const res = await $fetch(`/api/v1/notification/page?${params.toString()}`)
    notifications.value = (res.data?.records || []).map((record: any) => ({
      ...record,
      recipient: record.recipientName || record.recipientUsername
    }))
    pagination.total = res.data?.total || 0
  } catch (error) {
    ElMessage.error('加载通知记录失败')
  } finally {
    loading.value = false
  }
}

const handlePageChange = () => {
  loadData()
}

onMounted(() => {
  userStore.restoreState()
  loadData()
})
</script>

<style scoped lang="scss">
.notifications-page {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}
</style>
