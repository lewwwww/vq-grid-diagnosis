<template>
  <span :class="['status-tag', `status-${tagType}`, { 'has-icon': showIcon, 'is-pulse': pulse }]">
    <span v-if="showIcon" class="status-dot"></span>
    <el-icon v-if="showIcon && iconComponent" class="tag-icon">
      <component :is="iconComponent" />
    </el-icon>
    <span class="tag-label">{{ label }}</span>
  </span>
</template>

<script setup lang="ts">
import { SuccessFilled, WarningFilled, CircleCloseFilled, InfoFilled } from '@element-plus/icons-vue'

interface Props {
  status: string | number
  statusMap?: Record<string | number, { label: string; type: string; icon?: any }>
  showIcon?: boolean
  pulse?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showIcon: true,
  pulse: false,
  statusMap: () => ({
    // 设备状态
    0: { label: '离线', type: 'info', icon: InfoFilled },
    1: { label: '在线', type: 'success', icon: SuccessFilled },
    2: { label: '故障', type: 'danger', icon: CircleCloseFilled },
    3: { label: '维护', type: 'warning', icon: WarningFilled },

    // 故障等级
    'NORMAL': { label: '正常', type: 'success', icon: SuccessFilled },
    'GENERAL': { label: '一般', type: 'info', icon: InfoFilled },
    'SERIOUS': { label: '严重', type: 'warning', icon: WarningFilled },
    'URGENT': { label: '紧急', type: 'danger', icon: CircleCloseFilled },

    // 预警等级
    'LEVEL_1': { label: '一般', type: 'info' },
    'LEVEL_2': { label: '严重', type: 'warning' },
    'LEVEL_3': { label: '紧急', type: 'danger' },
  })
})

const currentStatus = computed(() => props.statusMap[props.status] || { label: '未知', type: 'info' })

const label = computed(() => currentStatus.value.label)
const tagType = computed(() => currentStatus.value.type)
const iconComponent = computed(() => currentStatus.value.icon)
</script>

<style scoped lang="scss">
.status-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: $border-radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  transition: all $transition-normal;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }

  &:hover::before {
    left: 100%;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .tag-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .tag-label {
    line-height: 1;
    white-space: nowrap;
  }

  // 成功状态
  &.status-success {
    background: linear-gradient(135deg, rgba(0, 230, 118, 0.15), rgba(0, 200, 83, 0.1));
    color: $success-color;
    border: 1px solid rgba(0, 230, 118, 0.3);

    .status-dot {
      background: $success-color;
      box-shadow: 0 0 8px $success-color;
    }

    &.is-pulse .status-dot {
      animation: pulse-success 2s ease-in-out infinite;
    }
  }

  // 警告状态
  &.status-warning {
    background: linear-gradient(135deg, rgba(255, 179, 0, 0.15), rgba(255, 143, 0, 0.1));
    color: $warning-color;
    border: 1px solid rgba(255, 179, 0, 0.3);

    .status-dot {
      background: $warning-color;
      box-shadow: 0 0 8px $warning-color;
    }

    &.is-pulse .status-dot {
      animation: pulse-warning 2s ease-in-out infinite;
    }
  }

  // 危险状态
  &.status-danger {
    background: linear-gradient(135deg, rgba(255, 61, 113, 0.15), rgba(245, 0, 87, 0.1));
    color: $danger-color;
    border: 1px solid rgba(255, 61, 113, 0.3);

    .status-dot {
      background: $danger-color;
      box-shadow: 0 0 8px $danger-color;
    }

    &.is-pulse .status-dot {
      animation: pulse-danger 2s ease-in-out infinite;
    }
  }

  // 信息状态
  &.status-info {
    background: linear-gradient(135deg, rgba(0, 188, 212, 0.15), rgba(0, 151, 167, 0.1));
    color: $info-color;
    border: 1px solid rgba(0, 188, 212, 0.3);

    .status-dot {
      background: $info-color;
      box-shadow: 0 0 8px $info-color;
    }

    &.is-pulse .status-dot {
      animation: pulse-info 2s ease-in-out infinite;
    }
  }
}

@keyframes pulse-success {
  0%, 100% {
    box-shadow: 0 0 8px $success-color;
  }
  50% {
    box-shadow: 0 0 16px $success-color, 0 0 24px $success-color;
  }
}

@keyframes pulse-warning {
  0%, 100% {
    box-shadow: 0 0 8px $warning-color;
  }
  50% {
    box-shadow: 0 0 16px $warning-color, 0 0 24px $warning-color;
  }
}

@keyframes pulse-danger {
  0%, 100% {
    box-shadow: 0 0 8px $danger-color;
  }
  50% {
    box-shadow: 0 0 16px $danger-color, 0 0 24px $danger-color;
  }
}

@keyframes pulse-info {
  0%, 100% {
    box-shadow: 0 0 8px $info-color;
  }
  50% {
    box-shadow: 0 0 16px $info-color, 0 0 24px $info-color;
  }
}
</style>

