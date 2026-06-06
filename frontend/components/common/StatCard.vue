<template>
  <div :class="['stat-card-modern', `stat-${type}`, { 'is-loading': loading }]">
    <div class="stat-background">
      <div class="stat-circle stat-circle-1"></div>
      <div class="stat-circle stat-circle-2"></div>
    </div>
    
    <div class="stat-content">
      <div class="stat-icon-wrapper">
        <div class="stat-icon">
          <slot name="icon">
            <el-icon><component :is="icon" /></el-icon>
          </slot>
        </div>
      </div>
      
      <div class="stat-info">
        <div class="stat-value">
          <span class="value-number">{{ formattedValue }}</span>
          <span v-if="unit" class="value-unit">{{ unit }}</span>
        </div>
        <div class="stat-label">{{ label }}</div>
        <div v-if="trend !== undefined" class="stat-trend">
          <el-icon :class="['trend-icon', trendClass]">
            <component :is="trendIcon" />
          </el-icon>
          <span :class="['trend-text', trendClass]">{{ Math.abs(trend) }}%</span>
        </div>
      </div>
    </div>
    
    <div v-if="loading" class="stat-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Grid, CircleCheck, Warning, CircleClose, TrendCharts, ArrowUp, ArrowDown, Loading } from '@element-plus/icons-vue'

interface Props {
  value: number | string
  label: string
  icon?: any
  type?: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  unit?: string
  trend?: number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  icon: Grid,
  type: 'primary',
  loading: false
})

const formattedValue = computed(() => {
  if (typeof props.value === 'number') {
    return props.value.toLocaleString()
  }
  return props.value
})

const trendIcon = computed(() => {
  return props.trend && props.trend > 0 ? ArrowUp : ArrowDown
})

const trendClass = computed(() => {
  if (!props.trend) return ''
  return props.trend > 0 ? 'trend-up' : 'trend-down'
})
</script>

<style scoped lang="scss">
.stat-card-modern {
  position: relative;
  padding: $spacing-xl;
  border-radius: $border-radius-lg;
  background: $bg-card;
  border: 1px solid $border-color;
  overflow: hidden;
  transition: all $transition-normal;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
    box-shadow: $box-shadow-lg;
    
    .stat-icon {
      transform: scale(1.1) rotate(5deg);
    }
    
    .stat-circle {
      transform: scale(1.2);
    }
  }

  .stat-background {
    position: absolute;
    top: 0;
    right: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    opacity: 0.1;
    pointer-events: none;

    .stat-circle {
      position: absolute;
      border-radius: 50%;
      transition: transform $transition-slow;
    }

    .stat-circle-1 {
      width: 150px;
      height: 150px;
      top: -50px;
      right: -50px;
    }

    .stat-circle-2 {
      width: 100px;
      height: 100px;
      bottom: -30px;
      right: 20px;
    }
  }

  .stat-content {
    position: relative;
    display: flex;
    align-items: center;
    gap: $spacing-lg;
    z-index: 1;
  }

  .stat-icon-wrapper {
    flex-shrink: 0;
  }

  .stat-icon {
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: $border-radius-lg;
    font-size: 32px;
    transition: all $transition-normal;

    :deep(.el-icon) {
      font-size: 32px;
    }
  }

  .stat-info {
    flex: 1;
    min-width: 0;
  }

  .stat-value {
    display: flex;
    align-items: baseline;
    gap: $spacing-xs;
    margin-bottom: $spacing-xs;

    .value-number {
      font-size: $font-size-xxxl;
      font-weight: $font-weight-bold;
      line-height: 1;
      color: $text-primary;
    }

    .value-unit {
      font-size: $font-size-sm;
      color: $text-secondary;
      font-weight: $font-weight-normal;
    }
  }

  .stat-label {
    font-size: $font-size-sm;
    color: $text-secondary;
    margin-bottom: $spacing-xs;
    font-weight: $font-weight-medium;
  }

  .stat-trend {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    .trend-icon {
      font-size: 14px;
    }

    .trend-up {
      color: $success-color;
    }

    .trend-down {
      color: $danger-color;
    }
  }

  .stat-loading {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(30, 36, 51, 0.8);
    backdrop-filter: blur(4px);
    z-index: 2;

    .el-icon {
      font-size: 32px;
      color: $primary-color;
    }
  }

  // 主题色
  &.stat-primary {
    .stat-icon {
      background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(0, 212, 255, 0.1));
      color: $primary-color;
      box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
    }

    .stat-circle {
      background: $primary-color;
    }

    &:hover {
      border-color: rgba(0, 212, 255, 0.5);
    }
  }

  &.stat-success {
    .stat-icon {
      background: linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 230, 118, 0.1));
      color: $success-color;
      box-shadow: 0 0 20px rgba(0, 230, 118, 0.3);
    }

    .stat-circle {
      background: $success-color;
    }

    &:hover {
      border-color: rgba(0, 230, 118, 0.5);
    }
  }

  &.stat-warning {
    .stat-icon {
      background: linear-gradient(135deg, rgba(255, 179, 0, 0.2), rgba(255, 179, 0, 0.1));
      color: $warning-color;
      box-shadow: 0 0 20px rgba(255, 179, 0, 0.3);
    }

    .stat-circle {
      background: $warning-color;
    }

    &:hover {
      border-color: rgba(255, 179, 0, 0.5);
    }
  }

  &.stat-danger {
    .stat-icon {
      background: linear-gradient(135deg, rgba(255, 61, 113, 0.2), rgba(255, 61, 113, 0.1));
      color: $danger-color;
      box-shadow: 0 0 20px rgba(255, 61, 113, 0.3);
    }

    .stat-circle {
      background: $danger-color;
    }

    &:hover {
      border-color: rgba(255, 61, 113, 0.5);
    }
  }

  &.stat-info {
    .stat-icon {
      background: linear-gradient(135deg, rgba(0, 188, 212, 0.2), rgba(0, 188, 212, 0.1));
      color: $info-color;
      box-shadow: 0 0 20px rgba(0, 188, 212, 0.3);
    }

    .stat-circle {
      background: $info-color;
    }

    &:hover {
      border-color: rgba(0, 188, 212, 0.5);
    }
  }
}
</style>

