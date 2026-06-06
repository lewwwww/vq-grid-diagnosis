<template>
  <div class="prediction-chart" ref="chartRef"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  predictions: Array<{
    date: string
    voltage: number
    current: number
    power: number
    temperature: number
    fault_probability: number
  }>
}>()

const chartRef = ref<HTMLElement>()
let chartInstance: echarts.ECharts | null = null

const initChart = () => {
  if (!chartRef.value) return
  
  chartInstance = echarts.init(chartRef.value)
  updateChart()
}

const updateChart = () => {
  if (!chartInstance || !props.predictions.length) return
  
  const dates = props.predictions.map(p => p.date)
  const faultProb = props.predictions.map(p => (p.fault_probability * 100).toFixed(2))
  const voltage = props.predictions.map(p => p.voltage)
  const temperature = props.predictions.map(p => p.temperature)
  
  const option = {
    title: {
      text: '故障演化预测曲线',
      left: 'center',
      textStyle: { color: '#E0E6ED' }
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(26, 35, 50, 0.95)',
      borderColor: '#2A3545',
      textStyle: { color: '#E0E6ED' }
    },
    legend: {
      data: ['故障概率', '电压', '温度'],
      top: 30,
      textStyle: { color: '#A8B2C1' }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' }
    },
    yAxis: [
      {
        type: 'value',
        name: '故障概率(%)',
        position: 'left',
        axisLabel: { formatter: '{value}%', color: '#A8B2C1' },
        splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } },
        axisLine: { lineStyle: { color: '#354050' } },
        nameTextStyle: { color: '#A8B2C1' }
      },
      {
        type: 'value',
        name: '电压(kV) / 温度(℃)',
        position: 'right',
        splitLine: { show: false },
        axisLine: { lineStyle: { color: '#354050' } },
        axisLabel: { color: '#A8B2C1' },
        nameTextStyle: { color: '#A8B2C1' }
      }
    ],
    series: [
      {
        name: '故障概率',
        type: 'line',
        data: faultProb,
        smooth: true,
        itemStyle: { color: '#FF3D71' },
        lineStyle: { color: '#FF3D71' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(255, 61, 113, 0.3)' },
            { offset: 1, color: 'rgba(255, 61, 113, 0.05)' }
          ])
        }
      },
      {
        name: '电压',
        type: 'line',
        yAxisIndex: 1,
        data: voltage,
        smooth: true,
        itemStyle: { color: '#00D4FF' },
        lineStyle: { color: '#00D4FF' }
      },
      {
        name: '温度',
        type: 'line',
        yAxisIndex: 1,
        data: temperature,
        smooth: true,
        itemStyle: { color: '#FFB300' },
        lineStyle: { color: '#FFB300' }
      }
    ]
  }
  
  chartInstance.setOption(option)
}

watch(() => props.predictions, () => {
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
.prediction-chart {
  width: 100%;
  height: 100%;
  min-height: 400px;
}
</style>

