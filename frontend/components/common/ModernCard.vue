<template>
  <div :class="['modern-card', { 'is-hoverable': hoverable, 'is-glass': glass }]">
    <div v-if="$slots.header || title" class="card-header">
      <slot name="header">
        <div class="header-content">
          <div class="header-left">
            <el-icon v-if="icon" class="header-icon">
              <component :is="icon" />
            </el-icon>
            <span class="header-title">{{ title }}</span>
            <el-tag v-if="badge" size="small" :type="badgeType" class="header-badge">
              {{ badge }}
            </el-tag>
          </div>
          <div v-if="$slots.extra" class="header-right">
            <slot name="extra"></slot>
          </div>
        </div>
      </slot>
    </div>
    
    <div class="card-body">
      <slot></slot>
    </div>
    
    <div v-if="$slots.footer" class="card-footer">
      <slot name="footer"></slot>
    </div>
    
    <div v-if="loading" class="card-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loading } from '@element-plus/icons-vue'

interface Props {
  title?: string
  icon?: any
  badge?: string
  badgeType?: 'success' | 'warning' | 'danger' | 'info'
  hoverable?: boolean
  glass?: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  hoverable: true,
  glass: false,
  loading: false,
  badgeType: 'primary'
})
</script>

<style scoped lang="scss">
.modern-card {
  background: $bg-card;
  border: 1px solid $border-color;
  border-radius: $border-radius-lg;
  overflow: hidden;
  transition: all $transition-normal;
  position: relative;

  &.is-hoverable:hover {
    transform: translateY(-2px);
    box-shadow: $box-shadow-lg;
    border-color: $border-color-light;
  }

  &.is-glass {
    background: rgba(30, 36, 51, 0.8);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .card-header {
    padding: $spacing-lg $spacing-xl;
    border-bottom: 1px solid $border-color;
    background: rgba(0, 0, 0, 0.1);

    .header-content {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: $spacing-md;
      flex: 1;
    }

    .header-icon {
      font-size: 20px;
      color: $primary-color;
    }

    .header-title {
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $text-primary;
      letter-spacing: 0.5px;
    }

    .header-badge {
      margin-left: $spacing-sm;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
    }
  }

  .card-body {
    padding: $spacing-xl;
  }

  .card-footer {
    padding: $spacing-lg $spacing-xl;
    border-top: 1px solid $border-color;
    background: rgba(0, 0, 0, 0.05);
  }

  .card-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(30, 36, 51, 0.9);
    backdrop-filter: blur(4px);
    z-index: 10;

    .el-icon {
      font-size: 32px;
      color: $primary-color;
    }
  }
}
</style>

