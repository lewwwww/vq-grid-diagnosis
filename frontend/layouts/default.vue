<template>
  <div class="home-container">
    <el-container>
      <!-- 侧边栏 -->
      <el-aside :width="isCollapse ? '64px' : '200px'" class="sidebar">
        <div class="logo">
          <img v-if="!isCollapse" src="/logo.svg" alt="Logo" />
          <span v-if="!isCollapse">智能电网</span>
        </div>

        <el-menu
          :default-active="activeMenu"
          :collapse="isCollapse"
          :unique-opened="true"
          router
        >
          <!-- 运维人员菜单 -->
          <template v-if="userStore.isOperator || userStore.isAdmin">
            <el-menu-item index="/dashboard">
              <el-icon><Monitor /></el-icon>
              <template #title>监控大屏</template>
            </el-menu-item>

            <el-menu-item index="/diagnosis">
              <el-icon><Search /></el-icon>
              <template #title>故障诊断</template>
            </el-menu-item>

            <el-menu-item index="/alert">
              <el-icon><Bell /></el-icon>
              <template #title>预警管理</template>
            </el-menu-item>

            <el-menu-item index="/device">
              <el-icon><Box /></el-icon>
              <template #title>设备管理</template>
            </el-menu-item>
          </template>

          <!-- 管理部门菜单 -->
          <template v-if="userStore.isManager || userStore.isAdmin">
            <el-menu-item index="/analysis">
              <el-icon><DataAnalysis /></el-icon>
              <template #title>安全态势</template>
            </el-menu-item>

            <el-menu-item index="/settings">
              <el-icon><Setting /></el-icon>
              <template #title>系统设置</template>
            </el-menu-item>
          </template>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
        <!-- 顶部导航栏 -->
        <el-header class="header">
          <div class="header-left">
            <el-icon class="collapse-icon" @click="toggleCollapse">
              <Fold v-if="!isCollapse" />
              <Expand v-else />
            </el-icon>
            <el-breadcrumb separator="/">
              <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
              <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
            </el-breadcrumb>
          </div>

          <div class="header-right">
            <el-dropdown @command="handleCommand">
              <span class="user-info">
                <el-avatar :size="32" icon="UserFilled" />
                <span class="username">{{ userStore.userInfo?.realName || userStore.userInfo?.username }}</span>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                  <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <!-- 内容区 -->
        <el-main class="main-content">
          <slot />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { ElMessageBox } from 'element-plus'
import {
  Monitor, Search, TrendCharts, Bell, Box,
  DataAnalysis, Connection, Setting, Fold, Expand
} from '@element-plus/icons-vue'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()

const isCollapse = ref(false)
const activeMenu = computed(() => route.path)

const currentPageTitle = computed(() => {
  const titleMap: Record<string, string> = {
    '/dashboard': '监控大屏',
    '/diagnosis': '故障诊断',
    '/alert': '预警管理',
    '/device': '设备管理',
    '/analysis': '安全态势',
    '/settings': '系统设置',
    '/profile': '个人中心'
  }
  return titleMap[route.path] || '首页'
})

const toggleCollapse = () => {
  isCollapse.value = !isCollapse.value
}

const handleCommand = async (command: string) => {
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      })
      await userStore.logout()
    } catch (error) {
      // 用户取消
    }
  } else if (command === 'profile') {
    router.push('/profile')
  }
}

onMounted(() => {
  userStore.restoreState()
  if (!userStore.isLogin) {
    router.push('/login')
  }
})
</script>


<style scoped lang="scss">
.home-container {
  width: 100%;
  height: 100vh;
  background: $bg-color;
}

.el-container {
  height: 100%;
}

.sidebar {
  background: linear-gradient(180deg, #1A1F2E 0%, #151A27 100%);
  transition: width $transition-normal;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 100;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    width: 1px;
    height: 100%;
    background: linear-gradient(180deg, transparent, rgba(0, 212, 255, 0.3), transparent);
  }

  .logo {
    height: $header-height;
    display: flex;
    align-items: center;
    justify-content: center;
    color: $text-white;
    font-size: 20px;
    font-weight: $font-weight-bold;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.2);
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(0, 212, 255, 0.1), transparent);
      animation: shimmer 3s infinite;
    }

    img {
      width: 36px;
      height: 36px;
      margin-right: 12px;
      filter: drop-shadow(0 0 8px rgba(0, 212, 255, 0.5));
    }

    span {
      background: linear-gradient(135deg, $primary-color 0%, #667eea 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      letter-spacing: 1px;
    }
  }

  :deep(.el-menu) {
    border-right: none;
    background: transparent;
    padding: $spacing-md;

    .el-menu-item {
      color: $text-secondary;
      border-radius: $border-radius-md;
      margin-bottom: $spacing-sm;
      transition: all $transition-normal;
      position: relative;
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 3px;
        height: 100%;
        background: $primary-color;
        transform: scaleY(0);
        transition: transform $transition-normal;
      }

      &:hover {
        background: rgba(0, 212, 255, 0.1);
        color: $primary-light;
        transform: translateX(4px);

        &::before {
          transform: scaleY(1);
        }
      }

      &.is-active {
        background: linear-gradient(90deg, rgba(0, 212, 255, 0.2), rgba(0, 212, 255, 0.05));
        color: $primary-color;
        font-weight: $font-weight-semibold;
        box-shadow: 0 0 20px rgba(0, 212, 255, 0.2);

        &::before {
          transform: scaleY(1);
        }

        .el-icon {
          color: $primary-color;
          filter: drop-shadow(0 0 4px rgba(0, 212, 255, 0.5));
        }
      }

      .el-icon {
        font-size: 18px;
        transition: all $transition-normal;
      }
    }
  }
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: $bg-card;
  border-bottom: 1px solid $border-color;
  padding: 0 $spacing-xl;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  position: relative;
  z-index: 99;

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(90deg, transparent, $primary-color, transparent);
    opacity: 0;
    transition: opacity $transition-normal;
  }

  &:hover::after {
    opacity: 0.5;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: $spacing-lg;

    .collapse-icon {
      font-size: 22px;
      cursor: pointer;
      transition: all $transition-normal;
      color: $text-secondary;
      padding: $spacing-sm;
      border-radius: $border-radius-md;

      &:hover {
        color: $primary-color;
        background: rgba(0, 212, 255, 0.1);
        transform: rotate(180deg);
      }
    }

    :deep(.el-breadcrumb) {
      .el-breadcrumb__item {
        .el-breadcrumb__inner {
          color: $text-secondary;
          font-weight: $font-weight-medium;
          transition: color $transition-fast;

          &:hover {
            color: $primary-color;
          }
        }

        &:last-child .el-breadcrumb__inner {
          color: $text-primary;
          font-weight: $font-weight-semibold;
        }
      }

      .el-breadcrumb__separator {
        color: $text-placeholder;
      }
    }
  }

  .header-right {
    .user-info {
      display: flex;
      align-items: center;
      gap: $spacing-md;
      cursor: pointer;
      padding: $spacing-sm $spacing-md;
      border-radius: $border-radius-full;
      transition: all $transition-normal;

      &:hover {
        background: rgba(0, 212, 255, 0.1);

        .username {
          color: $primary-color;
        }
      }

      :deep(.el-avatar) {
        border: 2px solid $primary-color;
        box-shadow: 0 0 12px rgba(0, 212, 255, 0.3);
      }

      .username {
        font-size: 14px;
        font-weight: $font-weight-medium;
        color: $text-primary;
        transition: color $transition-fast;
      }
    }
  }
}

.main-content {
  background: $bg-color;
  padding: $spacing-xl;
  overflow-y: auto;
  position: relative;

  &::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image:
      radial-gradient(circle at 10% 20%, rgba(0, 212, 255, 0.03) 0%, transparent 50%),
      radial-gradient(circle at 90% 80%, rgba(102, 126, 234, 0.03) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
  }

  > * {
    position: relative;
    z-index: 1;
  }
}

@keyframes shimmer {
  0% {
    left: -100%;
  }
  100% {
    left: 200%;
  }
}
</style>
