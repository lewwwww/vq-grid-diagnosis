<template>
  <div class="node-ids-chart" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  nodeIds: number[]  // 10维离散表征 (0-15)
}>()

const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return
  
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance) return
  
  const option = {
    title: {
      text: 'Node IDs 离散表征',
      left: 'center',
      textStyle: {
        color: '#E0E6ED',
        fontSize: 16
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(26, 35, 50, 0.95)',
      borderColor: '#2A3545',
      textStyle: { color: '#E0E6ED' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      data: ['特征1', '特征2', '特征3', '特征4', '特征5', '特征6', '特征7', '特征8', '特征9', '特征10'],
      axisLabel: { rotate: 45, color: '#A8B2C1' },
      axisLine: { lineStyle: { color: '#354050' } }
    },
    yAxis: {
      type: 'value',
      max: 15,
      min: 0,
      name: '离散值',
      splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' },
      nameTextStyle: { color: '#A8B2C1' }
    },
    series: [
      {
        name: 'Node IDs',
        type: 'bar',
        data: props.nodeIds,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00D4FF' },
            { offset: 1, color: '#00E676' }
          ])
        },
        label: {
          show: true,
          position: 'top',
          color: '#A8B2C1'
        }
      }
    ]
  }
  
  chartInstance.setOption(option)
}

watch(() => props.nodeIds, () => {
  updateChart()
}, { deep: true })

onMounted(() => {
  initChart()
  window.addEventListener('resize', () => chartInstance?.resize())
})

onUnmounted(() => {
  chartInstance?.dispose()
})
</script>

<style scoped>
.node-ids-chart {
  width: 100%;
  height: 100%;
  min-height: 300px;
}
</style>

