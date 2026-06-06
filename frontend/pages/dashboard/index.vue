<template>
  <div class="dashboard-container">
    <!-- 顶部统计卡片 - 使用新的 StatCard 组件 -->
    <el-row :gutter="24" class="stats-row">
      <el-col :span="6">
        <StatCard
          :value="statistics.totalCount || 0"
          label="设备总数"
          :icon="Grid"
          type="primary"
        />
      </el-col>

      <el-col :span="6">
        <StatCard
          :value="statistics.onlineCount || 0"
          label="在线设备"
          :icon="CircleCheck"
          type="success"
          :trend="5.2"
        />
      </el-col>

      <el-col :span="6">
        <StatCard
          :value="statistics.faultCount || 0"
          label="故障设备"
          :icon="Warning"
          type="danger"
          :trend="-2.1"
        />
      </el-col>

      <el-col :span="6">
        <StatCard
          :value="statistics.offlineCount || 0"
          label="离线设备"
          :icon="CircleClose"
          type="info"
        />
      </el-col>
    </el-row>

    <!-- 2D地图拓扑图和实时数据 -->
    <el-row :gutter="24" class="main-row">
      <el-col :span="16">
        <ModernCard
          title="电网设备地理分布图"
          :icon="Location"
          badge="北京地区"
          badge-type="info"
        >
          <template #extra>
            <el-button type="primary" size="small" @click="refreshData">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </template>
          <div ref="topologyChartRef" style="width: 100%; height: 550px;"></div>
        </ModernCard>
      </el-col>

      <el-col :span="8">
        <ModernCard title="设备状态列表" :icon="List">
          <el-scrollbar height="550px">
            <div class="device-list">
              <div
                v-for="device in deviceList"
                :key="device.id"
                class="device-item"
                @click="handleDeviceClick(device)"
              >
                <div class="device-info">
                  <div class="device-name">{{ device.deviceName }}</div>
                  <div class="device-code">{{ device.deviceCode }}</div>
                </div>
                <StatusTag :status="device.status" :pulse="device.status === 2" />
              </div>
            </div>
          </el-scrollbar>
        </ModernCard>
      </el-col>
    </el-row>

    <!-- 故障类型统计和设备类型分布 -->
    <el-row :gutter="24" class="chart-row">
      <el-col :span="12">
        <ModernCard title="故障类型统计" :icon="PieChart">
          <div ref="faultTypeChartRef" style="width: 100%; height: 350px;"></div>
        </ModernCard>
      </el-col>

      <el-col :span="12">
        <ModernCard title="设备类型分布" :icon="DataAnalysis">
          <div ref="typeChartRef" style="width: 100%; height: 350px;"></div>
        </ModernCard>
      </el-col>
    </el-row>

    <!-- 设备详情对话框 -->
    <el-dialog
      v-model="deviceDialogVisible"
      title="设备详情"
      width="600px"
      :close-on-click-modal="false"
    >
      <div v-if="selectedDevice" class="device-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备名称">{{ selectedDevice.deviceName }}</el-descriptions-item>
          <el-descriptions-item label="设备编号">{{ selectedDevice.deviceCode }}</el-descriptions-item>
          <el-descriptions-item label="设备类型">{{ getDeviceTypeName(selectedDevice.deviceType) }}</el-descriptions-item>
          <el-descriptions-item label="设备状态">
            <StatusTag :status="selectedDevice.status" />
          </el-descriptions-item>
          <el-descriptions-item label="电压等级">{{ selectedDevice.voltageLevel || '-' }}</el-descriptions-item>
          <el-descriptions-item label="设备型号">{{ selectedDevice.model || '-' }}</el-descriptions-item>
          <el-descriptions-item label="安装位置" :span="2">{{ selectedDevice.location }}</el-descriptions-item>
          <el-descriptions-item label="制造商">{{ selectedDevice.manufacturer || '-' }}</el-descriptions-item>
          <el-descriptions-item label="安装日期">{{ selectedDevice.installDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="经度">{{ selectedDevice.longitude || '-' }}</el-descriptions-item>
          <el-descriptions-item label="纬度">{{ selectedDevice.latitude || '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { Grid, CircleCheck, Warning, CircleClose, Refresh, Location, List, PieChart, DataAnalysis } from '@element-plus/icons-vue'
import * as echarts from 'echarts'

// 数据
const statistics = ref({})
const deviceList = ref([])
const topologyData = ref([])
const selectedDevice = ref(null)
const deviceDialogVisible = ref(false)

// 图表引用
const topologyChartRef = ref(null)
const faultTypeChartRef = ref(null)
const typeChartRef = ref(null)

let topologyChart = null
let faultTypeChart = null
let typeChart = null

// 设备类型映射
const deviceTypeMap = {
  'TRANSFORMER': '变压器',
  'CIRCUIT_BREAKER': '断路器',
  'SWITCH': '开关',
  'CAPACITOR': '电容器',
  1: '变压器',
  2: '断路器',
  3: '隔离开关',
  4: '电容器',
  5: '电抗器',
  6: '其他'
}

const getDeviceTypeName = (type) => deviceTypeMap[type] || '未知'

// 加载数据
const loadData = async () => {
  try {
    // 加载统计数据
    const statsRes = await $fetch('/api/v1/device/statistics')
    statistics.value = statsRes.data

    // 加载设备列表
    const devicesRes = await $fetch('/api/v1/device/page?page=1&size=100')
    deviceList.value = devicesRes.data.records

    // 初始化图表
    initTopologyChart()
    initFaultTypeChart()
    initTypeChart()
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

// 刷新数据
const refreshData = () => {
  loadData()
}

// 处理设备点击
const handleDeviceClick = (device) => {
  selectedDevice.value = device
  deviceDialogVisible.value = true
}

// 初始化2D地图拓扑图
const initTopologyChart = () => {
  if (!topologyChartRef.value) return

  topologyChart = echarts.init(topologyChartRef.value)

  // 准备散点数据 - 使用真实经纬度
  const scatterData = deviceList.value
    .filter(device => device.longitude && device.latitude)
    .map(device => ({
      name: device.deviceName,
      value: [device.longitude, device.latitude],
      deviceInfo: device,
      itemStyle: {
        color: device.status === 1 ? '#00E676' : device.status === 2 ? '#FF3D71' : '#7A8599'
      }
    }))

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26, 35, 50, 0.95)',
      borderColor: '#2A3545',
      textStyle: { color: '#E0E6ED' },
      formatter: (params) => {
        if (params.componentSubType === 'scatter') {
          const device = params.data.deviceInfo
          const statusText = device.status === 1 ? '在线' : device.status === 2 ? '故障' : '离线'
          return `
            <div style="padding: 5px;">
              <strong>${device.deviceName}</strong><br/>
              设备编号: ${device.deviceCode}<br/>
              设备类型: ${getDeviceTypeName(device.deviceType)}<br/>
              状态: <span style="color: ${device.status === 1 ? '#00E676' : device.status === 2 ? '#FF3D71' : '#7A8599'}">${statusText}</span><br/>
              位置: ${device.location}<br/>
              电压等级: ${device.voltageLevel || '-'}
            </div>
          `
        }
        return params.name
      }
    },
    grid: { left: 60, right: 20, top: 40, bottom: 40 },
    xAxis: {
      type: 'value', name: '经度', min: 115.5, max: 117.5,
      splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { formatter: '{value}°E', color: '#A8B2C1' },
      nameTextStyle: { color: '#A8B2C1' }
    },
    yAxis: {
      type: 'value', name: '纬度', min: 39.3, max: 41.2,
      splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { formatter: '{value}°N', color: '#A8B2C1' },
      nameTextStyle: { color: '#A8B2C1' }
    },
    legend: {
      data: ['在线设备', '故障设备', '离线/维护'],
      top: 5, right: 10,
      textStyle: { color: '#A8B2C1' }
    },
    series: [
      {
        name: '在线设备',
        type: 'scatter',
        data: scatterData.filter(d => d.deviceInfo.status === 1),
        symbolSize: 10,
        itemStyle: { color: '#00E676' }
      },
      {
        name: '故障设备',
        type: 'effectScatter',
        data: scatterData.filter(d => d.deviceInfo.status === 2),
        symbolSize: 16,
        showEffectOn: 'render',
        rippleEffect: { brushType: 'stroke', scale: 4, period: 3 },
        itemStyle: { color: '#FF3D71', shadowBlur: 10, shadowColor: '#FF3D71' },
        zlevel: 2
      },
      {
        name: '离线/维护',
        type: 'scatter',
        data: scatterData.filter(d => d.deviceInfo.status !== 1 && d.deviceInfo.status !== 2),
        symbolSize: 8,
        itemStyle: { color: '#7A8599' }
      }
    ]
  }

  topologyChart.setOption(option)

  // 添加点击事件
  topologyChart.on('click', (params) => {
    if (params.data?.deviceInfo) {
      handleDeviceClick(params.data.deviceInfo)
    }
  })
}

// 初始化故障类型统计图
const initFaultTypeChart = () => {
  if (!faultTypeChartRef.value) return

  faultTypeChart = echarts.init(faultTypeChartRef.value)

  // 故障类型名称映射
  const faultTypeNames = {
    0: '正常',
    1: '单相接地故障',
    2: '相间短路故障',
    3: '三相短路故障',
    4: '两相接地故障',
    5: '三相接地短路'
  }

  // 故障类型颜色
  const faultTypeColors = {
    0: '#00E676',  // 正常 - 绿色
    1: '#FFB300',  // 单相接地 - 黄色
    2: '#FF6D00',  // 相间短路 - 橙色
    3: '#FF3D71',  // 三相短路 - 红色
    4: '#FF5252',  // 两相接地 - 深红
    5: '#D50000'   // 三相接地短路 - 暗红
  }

  const faultTypeData = statistics.value.faultTypeDistribution || {}
  const data = Object.keys(faultTypeData).map(key => ({
    value: faultTypeData[key],
    name: faultTypeNames[key] || `故障类型${key}`,
    itemStyle: { color: faultTypeColors[key] }
  }))

  const option = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(26, 35, 50, 0.95)',
      borderColor: '#2A3545',
      textStyle: { color: '#E0E6ED' },
      formatter: '{b}: {c} ({d}%)'
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: { color: '#A8B2C1' }
    },
    series: [{
      name: '故障类型',
      type: 'pie',
      radius: '50%',
      data: data,
      label: { color: '#A8B2C1' },
      emphasis: {
        itemStyle: {
          shadowBlur: 10,
          shadowOffsetX: 0,
          shadowColor: 'rgba(0, 0, 0, 0.5)'
        }
      }
    }]
  }

  faultTypeChart.setOption(option)
}

// 初始化设备类型分布图
const initTypeChart = () => {
  if (!typeChartRef.value) return

  typeChart = echarts.init(typeChartRef.value)

  // 设备类型映射
  const typeLabels = {
    'TRANSFORMER': '变压器',
    'CIRCUIT_BREAKER': '断路器',
    'DISCONNECT_SWITCH': '隔离开关',
    'CAPACITOR': '电容器',
    'REACTOR': '电抗器',
    'BUSBAR': '母线'
  }

  // 获取实际有数据的设备类型
  const typeKeys = Object.keys(statistics.value.typeDistribution || {})
  const xAxisData = typeKeys.map(key => typeLabels[key] || key)
  const seriesData = typeKeys.map(key => statistics.value.typeDistribution[key] || 0)

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(26, 35, 50, 0.95)',
      borderColor: '#2A3545',
      textStyle: { color: '#E0E6ED' }
    },
    xAxis: {
      type: 'category',
      data: xAxisData,
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: {
        color: '#A8B2C1',
        interval: 0,  // 显示所有标签
        rotate: 0     // 不旋转
      }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } },
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' }
    },
    series: [{
      data: seriesData,
      type: 'bar',
      itemStyle: {
        borderRadius: [6, 6, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: '#00D4FF' },
          { offset: 1, color: '#0088CC' }
        ])
      }
    }]
  }

  typeChart.setOption(option)
}

// 窗口大小改变时重新渲染图表
const handleResize = () => {
  topologyChart?.resize()
  faultTypeChart?.resize()
  typeChart?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  topologyChart?.dispose()
  faultTypeChart?.dispose()
  typeChart?.dispose()
})
</script>

<style scoped lang="scss">
.dashboard-container {
  width: 100%;
  min-height: 100%;
  animation: fadeIn 0.5s ease-out;
}

.stats-row {
  margin-bottom: $spacing-xl;

  :deep(.el-col) {
    animation: fadeIn 0.6s ease-out;

    @for $i from 1 through 4 {
      &:nth-child(#{$i}) {
        animation-delay: #{$i * 0.1}s;
      }
    }
  }
}

.main-row {
  margin-bottom: $spacing-xl;
}

.device-list {
  .device-item {
    padding: $spacing-md;
    border-bottom: 1px solid $border-color;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all $transition-normal;
    border-radius: $border-radius-md;
    margin-bottom: $spacing-xs;

    &:hover {
      background: rgba(0, 212, 255, 0.05);
      transform: translateX(4px);
      border-color: rgba(0, 212, 255, 0.3);
    }

    .device-info {
      flex: 1;
      min-width: 0;
    }

    .device-name {
      font-size: $font-size-md;
      font-weight: $font-weight-medium;
      color: $text-primary;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .device-code {
      font-size: $font-size-xs;
      color: $text-secondary;
      font-family: 'Courier New', monospace;
    }
  }
}

.chart-row {
  margin-bottom: $spacing-xl;
}

.device-detail {
  padding: $spacing-md;

  :deep(.el-descriptions) {
    .el-descriptions__header {
      margin-bottom: $spacing-md;
    }

    .el-descriptions__label {
      font-weight: $font-weight-semibold;
      color: $text-secondary;
    }

    .el-descriptions__content {
      color: $text-primary;
    }
  }
}

// 对话框样式增强
:deep(.el-dialog) {
  background: $bg-card;
  border: 1px solid $border-color;
  box-shadow: $box-shadow-xl;

  .el-dialog__header {
    background: rgba(0, 0, 0, 0.1);
    border-bottom: 1px solid $border-color;
    padding: $spacing-lg $spacing-xl;

    .el-dialog__title {
      font-size: $font-size-lg;
      font-weight: $font-weight-semibold;
      color: $text-primary;
    }
  }

  .el-dialog__body {
    padding: $spacing-xl;
  }
}
</style>

