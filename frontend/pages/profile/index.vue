<template>
  <div class="profile-page">
    <el-row :gutter="20">
      <!-- 左侧：个人信息卡片 -->
      <el-col :span="8">
        <el-card class="profile-card">
          <template #header>
            <div class="card-header">
              <span>个人信息</span>
            </div>
          </template>

          <div class="profile-info">
            <div class="avatar-section">
              <el-avatar :size="100" :icon="UserFilled" />
              <div class="user-name">{{ userInfo?.realName || userInfo?.username }}</div>
              <el-tag :type="getRoleType(userInfo?.roleCode)">{{ userInfo?.roleName }}</el-tag>
            </div>

            <el-descriptions :column="1" border class="info-descriptions">
              <el-descriptions-item label="用户名">{{ userInfo?.username }}</el-descriptions-item>
              <el-descriptions-item label="真实姓名">{{ userInfo?.realName }}</el-descriptions-item>
              <el-descriptions-item label="邮箱">{{ userInfo?.email || '-' }}</el-descriptions-item>
              <el-descriptions-item label="手机号">{{ userInfo?.phone || '-' }}</el-descriptions-item>
              <el-descriptions-item label="部门">{{ userInfo?.department }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="userInfo?.status === 1 ? 'success' : 'danger'">
                  {{ userInfo?.status === 1 ? '正常' : '禁用' }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </el-card>
      </el-col>

      <!-- 右侧：编辑信息 -->
      <el-col :span="16">
        <el-card class="edit-card">
          <template #header>
            <div class="card-header">
              <span>编辑资料</span>
            </div>
          </template>

          <el-tabs v-model="activeTab">
            <el-tab-pane label="基本信息" name="basic">
              <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="100px" style="max-width: 500px">
                <el-form-item label="真实姓名" prop="realName">
                  <el-input v-model="editForm.realName" placeholder="请输入真实姓名" />
                </el-form-item>
                <el-form-item label="邮箱" prop="email">
                  <el-input v-model="editForm.email" placeholder="请输入邮箱" />
                </el-form-item>
                <el-form-item label="手机号" prop="phone">
                  <el-input v-model="editForm.phone" placeholder="请输入手机号" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleUpdateInfo" :loading="updating">保存修改</el-button>
                  <el-button @click="handleResetForm">重置</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>

            <el-tab-pane label="修改密码" name="password">
              <el-form :model="passwordForm" :rules="passwordRules" ref="passwordFormRef" label-width="100px" style="max-width: 500px">
                <el-form-item label="原密码" prop="oldPassword">
                  <el-input v-model="passwordForm.oldPassword" type="password" placeholder="请输入原密码" show-password />
                </el-form-item>
                <el-form-item label="新密码" prop="newPassword">
                  <el-input v-model="passwordForm.newPassword" type="password" placeholder="请输入新密码" show-password />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                  <el-input v-model="passwordForm.confirmPassword" type="password" placeholder="请再次输入新密码" show-password />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleUpdatePassword" :loading="updatingPassword">修改密码</el-button>
                  <el-button @click="handleResetPasswordForm">重置</el-button>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { UserFilled } from '@element-plus/icons-vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '~/stores/user'

definePageMeta({
  layout: 'default'
})

const userStore = useUserStore()
if (typeof window !== 'undefined' && !userStore.userInfo) {
  userStore.restoreState()
}
const userInfo = computed(() => userStore.userInfo)

const activeTab = ref('basic')
const updating = ref(false)
const updatingPassword = ref(false)

// 编辑表单
const editFormRef = ref<FormInstance>()
const editForm = reactive({
  realName: '',
  email: '',
  phone: ''
})

const editRules: FormRules = {
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  phone: [
    { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号', trigger: 'blur' }
  ]
}

// 密码表单
const passwordFormRef = ref<FormInstance>()
const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== passwordForm.newPassword) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const passwordRules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码长度在 8 到 20 个字符', trigger: 'blur' }
  ],
  confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }]
}



// 初始化表单
const initForm = () => {
  editForm.realName = userInfo.value?.realName || ''
  editForm.email = userInfo.value?.email || ''
  editForm.phone = userInfo.value?.phone || ''
}

// 更新基本信息
const handleUpdateInfo = async () => {
  if (!editFormRef.value) return

  await editFormRef.value.validate(async (valid) => {
    if (valid) {
      updating.value = true
      try {
        const res = await $fetch('/api/v1/user/profile', {
          method: 'PUT',
          headers: userStore.getAuthHeaders(),
          body: editForm
        })
        if ((res as any).code !== 200) {
          throw new Error((res as any).message || '鏇存柊澶辫触')
        }
        await userStore.getUserInfo()
        ElMessage.success('信息更新成功')
      } catch (error: any) {
        ElMessage.error(error.message || '更新失败')
      } finally {
        updating.value = false
      }
    }
  })
}

// 重置表单
const handleResetForm = () => {
  initForm()
}

// 修改密码
const handleUpdatePassword = async () => {
  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (valid) {
      updatingPassword.value = true
      try {
        const res = await $fetch('/api/v1/user/password', {
          method: 'PUT',
          headers: userStore.getAuthHeaders(),
          body: {
            oldPassword: passwordForm.oldPassword,
            newPassword: passwordForm.newPassword
          }
        })
        if ((res as any).code !== 200) {
          throw new Error((res as any).message || '淇敼澶辫触')
        }
        ElMessage.success('密码修改成功，请重新登录')
        passwordFormRef.value?.resetFields()
        // 3秒后退出登录
        setTimeout(() => {
          userStore.logout()
        }, 3000)
      } catch (error: any) {
        ElMessage.error(error.message || '修改失败')
      } finally {
        updatingPassword.value = false
      }
    }
  })
}

// 重置密码表单
const handleResetPasswordForm = () => {
  passwordFormRef.value?.resetFields()
}

// 获取角色类型
const getRoleType = (roleCode?: string) => {
  const types: Record<string, any> = {
    ADMIN: 'danger',
    MANAGER: 'warning',
    OPERATOR: 'success'
  }
  return types[roleCode || ''] || 'info'
}

watch(userInfo, () => {
  initForm()
}, { immediate: true })

onMounted(async () => {
  if (!userInfo.value && userStore.isLogin) {
    try {
      await userStore.getUserInfo()
    } catch {
      initForm()
    }
  }
})
</script>

<style scoped lang="scss">
.profile-page {
  padding: 20px;
}

.profile-card {
  .profile-info {
    .avatar-section {
      text-align: center;
      padding: 20px 0;
      border-bottom: 1px solid $border-color;
      margin-bottom: 20px;

      .user-name {
        font-size: 20px;
        font-weight: 600;
        color: $text-primary;
        margin: 16px 0 8px;
      }
    }

    .info-descriptions {
      margin-top: 20px;
    }
  }
}

.edit-card {
  min-height: 500px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: $text-primary;
}
</style>
