/**
 * 图表通用逻辑 - 可复用组合式函数
 */
import { ref, onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'

interface ChartOptions {
  option: Ref<EChartsOption> | EChartsOption
  theme?: string
  autoResize?: boolean
}

export function useChart(chartRef: Ref<HTMLElement | undefined>, options: ChartOptions) {
  const { option, theme = 'default', autoResize = true } = options

  let chartInstance: echarts.ECharts | null = null
  const loading = ref(false)

  /**
   * 初始化图表
   */
  const initChart = () => {
    if (!chartRef.value) return

    chartInstance = echarts.init(chartRef.value, theme)
    const chartOption = typeof option === 'object' && 'value' in option ? option.value : option
    chartInstance.setOption(chartOption)
  }

  /**
   * 更新图表
   */
  const updateChart = (newOption?: EChartsOption) => {
    if (!chartInstance) return

    const chartOption = newOption || (typeof option === 'object' && 'value' in option ? option.value : option)
    chartInstance.setOption(chartOption, true)
  }

  /**
   * 调整图表大小
   */
  const resizeChart = () => {
    chartInstance?.resize()
  }

  /**
   * 显示加载动画
   */
  const showLoading = () => {
    loading.value = true
    chartInstance?.showLoading()
  }

  /**
   * 隐藏加载动画
   */
  const hideLoading = () => {
    loading.value = false
    chartInstance?.hideLoading()
  }

  /**
   * 销毁图表
   */
  const disposeChart = () => {
    chartInstance?.dispose()
    chartInstance = null
  }

  /**
   * 获取图表实例
   */
  const getChartInstance = () => chartInstance

  // 监听配置变化
  if (typeof option === 'object' && 'value' in option) {
    watch(option, () => updateChart(), { deep: true })
  }

  // 生命周期
  onMounted(() => {
    initChart()
    if (autoResize) {
      window.addEventListener('resize', resizeChart)
    }
  })

  onUnmounted(() => {
    if (autoResize) {
      window.removeEventListener('resize', resizeChart)
    }
    disposeChart()
  })

  return {
    chartInstance: getChartInstance,
    loading,
    initChart,
    updateChart,
    resizeChart,
    showLoading,
    hideLoading,
    disposeChart
  }
}

