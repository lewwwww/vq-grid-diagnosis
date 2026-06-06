<template>
  <div class="login-container">
    <!-- 背景动画 -->
    <div class="bg-animation">
      <div class="grid-line" v-for="i in 20" :key="'h-' + i" :style="{ top: i * 5 + '%' }"></div>
      <div class="grid-line vertical" v-for="i in 20" :key="'v-' + i" :style="{ left: i * 5 + '%' }"></div>
    </div>

    <div class="login-box">
      <div class="login-header">
        <div class="logo">⚡</div>
        <h1>智能电网故障诊断系统</h1>
      </div>

      <!-- 标签页 -->
      <el-tabs v-model="activeTab" class="login-tabs">
        <!-- 登录表单 -->
        <el-tab-pane label="登录" name="login">
          <el-form
            ref="loginFormRef"
            :model="loginForm"
            :rules="loginRules"
            class="login-form"
            @keyup.enter="handleLogin"
          >
            <el-form-item prop="username">
              <el-input
                v-model="loginForm.username"
                placeholder="请输入用户名"
                size="large"
                prefix-icon="User"
                clearable
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-form-item>
              <div class="form-footer">
                <el-checkbox v-model="loginForm.remember">记住密码</el-checkbox>
              </div>
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                class="login-button"
                @click="handleLogin"
              >
                {{ loading ? '登录中...' : '登录' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <!-- 注册表单 -->
        <el-tab-pane label="注册" name="register">
          <el-form
            ref="registerFormRef"
            :model="registerForm"
            :rules="registerRules"
            class="login-form"
          >
            <el-form-item prop="username">
              <el-input
                v-model="registerForm.username"
                placeholder="请输入用户名"
                size="large"
                prefix-icon="User"
                clearable
              />
            </el-form-item>

            <el-form-item prop="realName">
              <el-input
                v-model="registerForm.realName"
                placeholder="请输入真实姓名"
                size="large"
                prefix-icon="Avatar"
                clearable
              />
            </el-form-item>

            <el-form-item prop="email">
              <el-input
                v-model="registerForm.email"
                placeholder="请输入邮箱"
                size="large"
                prefix-icon="Message"
                clearable
              />
            </el-form-item>

            <el-form-item prop="phone">
              <el-input
                v-model="registerForm.phone"
                placeholder="请输入手机号（可选）"
                size="large"
                prefix-icon="Phone"
                clearable
              />
            </el-form-item>

            <el-form-item prop="roleCode">
              <el-select
                v-model="registerForm.roleCode"
                placeholder="请选择角色（默认：运维人员）"
                size="large"
                style="width: 100%"
              >
                <el-option label="电网运维人员（监控+诊断+预警+设备管理）" value="OPERATOR" />
              </el-select>
            </el-form-item>

            <el-form-item prop="department">
              <el-input
                v-model="registerForm.department"
                placeholder="请输入部门（可选）"
                size="large"
                prefix-icon="OfficeBuilding"
                clearable
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                prefix-icon="Lock"
                show-password
              />
            </el-form-item>

            <el-form-item prop="confirmPassword">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="请确认密码"
                size="large"
                prefix-icon="Lock"
                show-password
                @keyup.enter="handleRegister"
              />
            </el-form-item>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="registerLoading"
                class="login-button"
                @click="handleRegister"
              >
                {{ registerLoading ? '注册中...' : '注册' }}
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/user'

definePageMeta({
  layout: 'blank'
})

const userStore = useUserStore()
const router = useRouter()

// 当前标签页
const activeTab = ref('login')

// 登录表单
const loginFormRef = ref<FormInstance>()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
  remember: false
})

const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 4, max: 20, message: '用户名长度在 4 到 20 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{4,20}$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码长度在 8 到 20 个字符', trigger: 'blur' }
  ]
}

// 注册表单
const registerFormRef = ref<FormInstance>()
const registerLoading = ref(false)

const registerForm = reactive({
  username: '',
  realName: '',
  email: '',
  phone: '',
  roleCode: 'OPERATOR',
  department: '',
  password: '',
  confirmPassword: ''
})

const validateConfirmPassword = (rule: any, value: any, callback: any) => {
  if (value === '') {
    callback(new Error('请再次输入密码'))
  } else if (value !== registerForm.password) {
    callback(new Error('两次输入密码不一致'))
  } else {
    callback()
  }
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 4, max: 20, message: '用户名长度在 4 到 20 个字符', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{4,20}$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  realName: [
    { required: true, message: '请输入真实姓名', trigger: 'blur' }
  ],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, max: 20, message: '密码长度在 8 到 20 个字符', trigger: 'blur' },
    { pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{8,20}$/, message: '密码必须包含大小写字母和数字', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

// 登录
const handleLogin = async () => {
  if (!loginFormRef.value) return

  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true
      try {
        await userStore.login(loginForm)
        ElMessage.success('登录成功')

        // 根据角色跳转到不同页面
        if (userStore.isOperator) {
          router.push('/dashboard')
        } else {
          router.push('/dashboard')
        }
      } catch (error) {
        console.error('登录失败:', error)
      } finally {
        loading.value = false
      }
    }
  })
}

// 注册
const handleRegister = async () => {
  if (!registerFormRef.value) return

  await registerFormRef.value.validate(async (valid) => {
    if (valid) {
      registerLoading.value = true
      try {
        const { confirmPassword, ...registerData } = registerForm
        await userStore.register(registerData)
        ElMessage.success('注册成功，请登录')
        activeTab.value = 'login'
        // 清空注册表单
        Object.keys(registerForm).forEach(key => {
          registerForm[key as keyof typeof registerForm] = ''
        })
      } catch (error: any) {
        ElMessage.error(error.message || '注册失败')
      } finally {
        registerLoading.value = false
      }
    }
  })
}
</script>

<style scoped lang="scss">
.login-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #0F2027 0%, #203A43 50%, #2C5364 100%);
  position: relative;
  overflow: hidden;

  // 动态背景粒子效果
  &::before {
    content: '';
    position: absolute;
    width: 200%;
    height: 200%;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(0, 212, 255, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%);
    animation: float 20s ease-in-out infinite;
  }
}

.bg-animation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0.05;
  pointer-events: none;

  .grid-line {
    position: absolute;
    width: 100%;
    height: 1px;
    background: linear-gradient(90deg, transparent, $primary-color, transparent);
    animation: pulse 4s ease-in-out infinite;

    &.vertical {
      width: 1px;
      height: 100%;
      background: linear-gradient(180deg, transparent, $primary-color, transparent);
    }

    @for $i from 1 through 20 {
      &:nth-child(#{$i}) {
        animation-delay: #{$i * 0.1}s;
      }
    }
  }
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) rotate(0deg);
  }
  33% {
    transform: translate(30px, -30px) rotate(120deg);
  }
  66% {
    transform: translate(-20px, 20px) rotate(240deg);
  }
}

.login-box {
  width: 480px;
  padding: 48px;
  background: rgba(30, 36, 51, 0.85);
  backdrop-filter: blur(20px);
  border-radius: $border-radius-xl;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.1) inset;
  z-index: 1;
  animation: fadeIn 0.6s ease-out;
  border: 1px solid rgba(255, 255, 255, 0.1);

  &:hover {
    box-shadow:
      0 12px 48px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 212, 255, 0.3) inset;
    transition: all $transition-normal;
  }
}

.login-header {
  text-align: center;
  margin-bottom: 40px;

  .logo {
    font-size: 64px;
    margin-bottom: 20px;
    filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
    animation: float 3s ease-in-out infinite;
  }

  h1 {
    font-size: 28px;
    font-weight: $font-weight-bold;
    background: linear-gradient(135deg, $primary-color 0%, #667eea 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 0 0 12px 0;
    letter-spacing: 1px;
  }

  p {
    font-size: 14px;
    color: $text-secondary;
    margin: 0;
    font-weight: $font-weight-light;
  }
}

.login-tabs {
  :deep(.el-tabs__nav-wrap) {
    &::after {
      display: none;
    }
  }

  :deep(.el-tabs__header) {
    margin-bottom: 32px;
  }

  :deep(.el-tabs__nav) {
    width: 100%;
    display: flex;
  }

  :deep(.el-tabs__item) {
    flex: 1;
    text-align: center;
    font-size: 16px;
    font-weight: $font-weight-medium;
    color: $text-secondary;
    transition: all $transition-normal;
    padding: 12px 20px;

    &:hover {
      color: $primary-light;
    }

    &.is-active {
      color: $primary-color;
      font-weight: $font-weight-semibold;
    }
  }

  :deep(.el-tabs__active-bar) {
    height: 3px;
    background: linear-gradient(90deg, $primary-color, #667eea);
    border-radius: $border-radius-full;
  }
}

.login-form {
  padding: 0;

  :deep(.el-form-item) {
    margin-bottom: 24px;
  }

  :deep(.el-input) {
    .el-input__wrapper {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: none;
      transition: all $transition-normal;
      border-radius: $border-radius-md;

      &:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(0, 212, 255, 0.3);
      }

      &.is-focus {
        background: rgba(255, 255, 255, 0.1);
        border-color: $primary-color;
        box-shadow: 0 0 0 3px rgba(0, 212, 255, 0.1);
      }
    }

    .el-input__inner {
      color: $text-primary;

      &::placeholder {
        color: $text-placeholder;
      }
    }

    .el-input__prefix,
    .el-input__suffix {
      color: $text-secondary;
    }
  }

  :deep(.el-checkbox) {
    .el-checkbox__label {
      color: $text-secondary;
      font-size: 14px;
    }

    .el-checkbox__inner {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.2);
    }

    &.is-checked {
      .el-checkbox__inner {
        background: $primary-color;
        border-color: $primary-color;
      }

      .el-checkbox__label {
        color: $primary-color;
      }
    }
  }

  .form-footer {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .login-button {
    width: 100%;
    height: 48px;
    font-size: 16px;
    font-weight: $font-weight-semibold;
    background: linear-gradient(135deg, $primary-color 0%, #667eea 100%);
    border: none;
    border-radius: $border-radius-md;
    transition: all $transition-normal;
    letter-spacing: 1px;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 212, 255, 0.4);
    }

    &:active {
      transform: translateY(0);
    }
  }
}

.login-footer {
  text-align: center;
  margin-top: 24px;

  p {
    font-size: 12px;
    color: $text-secondary;
  }
}
</style>

