<template>
  <div class="chart-card">
    <div class="chart-header">
      <div class="chart-title">
        <el-icon v-if="icon" class="title-icon">
          <component :is="icon" />
        </el-icon>
        <span>{{ title }}</span>
      </div>
      <div class="chart-extra">
        <slot name="extra"></slot>
      </div>
    </div>
    <div ref="chartRef" class="chart-container" :style="{ height }"></div>
  </div>
</template>

<script setup lang="ts">
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface Props {
  title: string
  icon?: any
  height?: string
  option?: EChartsOption
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: '400px',
  loading: false
})

const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value || !props.option) return

  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption(props.option)
}

const updateChart = () => {
  if (!chartInstance || !props.option) return
  chartInstance.setOption(props.option, true)
}

const resizeChart = () => {
  chartInstance?.resize()
}

watch(() => props.option, updateChart, { deep: true })

watch(() => props.loading, (loading) => {
  if (loading) {
    chartInstance?.showLoading()
  } else {
    chartInstance?.hideLoading()
  }
})

onMounted(() => {
  initChart()
  window.addEventListener('resize', resizeChart)
})

onUnmounted(() => {
  window.removeEventListener('resize', resizeChart)
  chartInstance?.dispose()
})

defineExpose({
  chartInstance,
  updateChart,
  resizeChart
})
</script>

<style scoped lang="scss">
.chart-card {
  background: $bg-card;
  border-radius: $border-radius-md;
  padding: $spacing-lg;
  border: 1px solid $border-color;
  transition: all $transition-normal;

  &:hover {
    border-color: $border-color-light;
    box-shadow: $box-shadow-md;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-lg;

    .chart-title {
      display: flex;
      align-items: center;
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $text-primary;

      .title-icon {
        margin-right: $spacing-sm;
        font-size: 20px;
        color: $primary-color;
      }
    }
  }

  .chart-container {
    width: 100%;
  }
}
</style>

