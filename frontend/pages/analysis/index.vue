<template>
  <div class="analysis-page">
    <!-- 全局安全评估 -->
    <el-row :gutter="20">
      <el-col :span="6">
        <el-card class="score-card">
          <div class="score-content">
            <div class="score-circle">
              <div class="score-value">{{ securityScore }}</div>
              <div class="score-label">安全评分</div>
            </div>
            <el-progress
              type="circle"
              :percentage="securityScore"
              :width="180"
              :stroke-width="12"
              :color="getScoreColor(securityScore)"
              :show-text="false"
            />
          </div>
        </el-card>
      </el-col>
      <el-col :span="18">
        <el-card>
          <template #header>
            <span>安全态势趋势</span>
          </template>
          <div ref="trendChartRef" class="trend-chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 统计卡片 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)">
              <el-icon :size="32"><Monitor /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.totalDevices }}</div>
              <div class="stat-label">设备总数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%)">
              <el-icon :size="32"><Warning /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.faultCount }}</div>
              <div class="stat-label">故障次数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)">
              <el-icon :size="32"><Bell /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.alertCount }}</div>
              <div class="stat-label">预警次数</div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-content">
            <div class="stat-icon" style="background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)">
              <el-icon :size="32"><TrendCharts /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-value">{{ stats.avgResponseTime }}h</div>
              <div class="stat-label">平均响应时间</div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 故障统计与风险区域 -->
    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>故障类型统计</span>
          </template>
          <div ref="faultTypeChartRef" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>风险区域分布</span>
          </template>
          <div ref="riskAreaChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 时间分布与设备健康度 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>故障时间分布</span>
          </template>
          <div ref="timeDistChartRef" class="chart"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header>
            <span>设备健康度排名</span>
          </template>
          <div ref="healthRankChartRef" class="chart"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 报表生成 -->
    <el-card style="margin-top: 20px">
      <template #header>
        <div class="card-header">
          <span>报表生成</span>
          <div>
            <el-date-picker
              v-model="reportDateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              style="margin-right: 10px"
            />
            <el-button type="primary" :loading="reportLoading" @click="handleGenerateReport">
              <el-icon><Document /></el-icon>
              生成报表
            </el-button>
            <el-button type="success" :loading="exportLoading" @click="handleExportReport">
              <el-icon><Download /></el-icon>
              导出Excel
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="reportData" stripe v-loading="reportLoading">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column prop="totalDevices" label="设备总数" width="100" />
        <el-table-column prop="onlineDevices" label="在线设备" width="100" />
        <el-table-column prop="faultCount" label="故障次数" width="100" />
        <el-table-column prop="alertCount" label="预警次数" width="100" />
        <el-table-column prop="avgResponseTime" label="平均响应(h)" width="120" />
        <el-table-column prop="securityScore" label="安全评分" width="100">
          <template #default="{ row }">
            <el-tag :type="getScoreTag(row.securityScore)">
              {{ row.securityScore }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="200" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Monitor, Warning, Bell, TrendCharts, Document, Download } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { exportExcel } from '~/utils/export'

interface TrendItem {
  date: string
  score: number
  onlineRate: number
  faultRate: number
}

interface FaultTypeItem {
  name: string
  value: number
  itemStyle?: { color: string }
}

interface RiskAreaItem {
  name: string
  value: number
  deviceCount: number
}

interface HourlyFaultItem {
  hour: string
  count: number
}

interface HealthRankItem {
  name: string
  health: number
}

interface ReportRow {
  date: string
  totalDevices: number
  onlineDevices: number
  faultCount: number
  alertCount: number
  avgResponseTime: number
  securityScore: number
  remark: string
}

interface ReportSummary {
  startDate: string
  endDate: string
  totalDays: number
  totalDevices: number
  onlineDevices: number
  totalFaultCount: number
  totalAlertCount: number
  avgResponseTime: number
  averageSecurityScore: number
}

interface OverviewData {
  securityScore: number
  stats: {
    totalDevices: number
    faultCount: number
    alertCount: number
    avgResponseTime: number
  }
  faultTypeStats: FaultTypeItem[]
  riskAreaStats: RiskAreaItem[]
  trendData: TrendItem[]
  hourlyFaults: HourlyFaultItem[]
  healthRank: HealthRankItem[]
  reportData: ReportRow[]
  reportSummary: ReportSummary
}

const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const parseDate = (value: string) => new Date(`${value}T00:00:00`)

const getDefaultReportRange = (): [Date, Date] => {
  const end = new Date()
  const start = new Date(end)
  start.setDate(end.getDate() - 6)
  return [start, end]
}

// 安全评分
const securityScore = ref(0)

// 统计数据
const stats = reactive({ totalDevices: 0, faultCount: 0, alertCount: 0, avgResponseTime: 0 })

// API数据
const overviewData = ref<OverviewData | null>(null)

// 图表引用
const trendChartRef = ref()
const faultTypeChartRef = ref()
const riskAreaChartRef = ref()
const timeDistChartRef = ref()
const healthRankChartRef = ref()

// 报表数据
const reportDateRange = ref<[Date, Date] | []>(getDefaultReportRange())
const reportData = ref<ReportRow[]>([])
const reportSummary = ref<ReportSummary | null>(null)
const reportLoading = ref(false)
const exportLoading = ref(false)

// 加载数据
const loadData = async () => {
  try {
    const res = await $fetch<{ data: OverviewData }>('/api/v1/analysis/overview')
    overviewData.value = res.data
    securityScore.value = res.data.securityScore
    stats.totalDevices = res.data.stats.totalDevices
    stats.faultCount = res.data.stats.faultCount
    stats.alertCount = res.data.stats.alertCount
    stats.avgResponseTime = res.data.stats.avgResponseTime
    reportData.value = res.data.reportData
    reportSummary.value = res.data.reportSummary
    reportDateRange.value = [
      parseDate(res.data.reportSummary.startDate),
      parseDate(res.data.reportSummary.endDate)
    ]
    nextTick(() => {
      initTrendChart()
      initFaultTypeChart()
      initRiskAreaChart()
      initTimeDistChart()
      initHealthRankChart()
    })
  } catch { ElMessage.error('加载分析数据失败') }
}

// 获取评分颜色
const getScoreColor = (score: number) => {
  if (score >= 90) return '#00E676'
  if (score >= 70) return '#FFB300'
  return '#FF3D71'
}

// 获取评分标签
const getScoreTag = (score: number) => {
  if (score >= 90) return 'success'
  if (score >= 70) return 'warning'
  return 'danger'
}

// 初始化趋势图表
const initTrendChart = () => {
  if (!trendChartRef.value) return
  if (!overviewData.value) return

  const chart = echarts.init(trendChartRef.value)
  const td = overviewData.value.trendData
  const dates = td.map(t => t.date)

  const option = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(26, 35, 50, 0.95)', borderColor: '#2A3545', textStyle: { color: '#E0E6ED' } },
    legend: { data: ['安全评分', '在线率', '故障率'], bottom: 10, textStyle: { color: '#A8B2C1' } },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' }
    },
    yAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } }, axisLine: { lineStyle: { color: '#354050' } }, axisLabel: { color: '#A8B2C1' } },
    series: [
      {
        name: '安全评分',
        type: 'line',
        data: td.map(t => t.score.toFixed(1)),
        smooth: true,
        lineStyle: { color: '#00E676' },
        itemStyle: { color: '#00E676' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(0, 230, 118, 0.3)' },
            { offset: 1, color: 'rgba(0, 230, 118, 0.05)' }
          ])
        }
      },
      {
        name: '在线率',
        type: 'line',
        data: td.map(t => t.onlineRate),
        smooth: true,
        lineStyle: { color: '#00D4FF' },
        itemStyle: { color: '#00D4FF' }
      },
      {
        name: '故障率',
        type: 'line',
        data: td.map(t => t.faultRate),
        smooth: true,
        lineStyle: { color: '#FF3D71' },
        itemStyle: { color: '#FF3D71' }
      }
    ]
  }
  chart.setOption(option)
}

// 初始化故障类型图表
const initFaultTypeChart = () => {
  if (!faultTypeChartRef.value) return
  if (!overviewData.value) return

  const chart = echarts.init(faultTypeChartRef.value)
  const option = {
    tooltip: { trigger: 'item', backgroundColor: 'rgba(26, 35, 50, 0.95)', borderColor: '#2A3545', textStyle: { color: '#E0E6ED' } },
    legend: { orient: 'vertical', right: 10, top: 'center', textStyle: { color: '#A8B2C1' } },
    series: [
      {
        name: '故障类型',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#1A2332',
          borderWidth: 2
        },
        label: { show: true, formatter: '{b}: {c} ({d}%)', color: '#A8B2C1' },
        data: overviewData.value.faultTypeStats
      }
    ]
  }
  chart.setOption(option)
}

// 初始化风险区域图表
const initRiskAreaChart = () => {
  if (!riskAreaChartRef.value) return
  if (!overviewData.value) return

  const chart = echarts.init(riskAreaChartRef.value)
  const ra = overviewData.value.riskAreaStats
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(26, 35, 50, 0.95)', borderColor: '#2A3545', textStyle: { color: '#E0E6ED' } },
    xAxis: {
      type: 'category',
      data: ra.map(r => r.name),
      axisLabel: { rotate: 30, fontSize: 10, color: '#A8B2C1' },
      axisLine: { lineStyle: { color: '#354050' } }
    },
    yAxis: { type: 'value', name: '风险指数', splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } }, axisLine: { lineStyle: { color: '#354050' } }, axisLabel: { color: '#A8B2C1' }, nameTextStyle: { color: '#A8B2C1' } },
    series: [
      {
        name: '风险指数',
        type: 'bar',
        data: ra.map(r => r.value),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: (params: any) => {
            const colors = ['#00E676', '#FFB300', '#FF3D71']
            if (params.value < 60) return colors[0]
            if (params.value < 80) return colors[1]
            return colors[2]
          }
        }
      }
    ]
  }
  chart.setOption(option)
}

// 初始化时间分布图表
const initTimeDistChart = () => {
  if (!timeDistChartRef.value) return
  if (!overviewData.value) return

  const chart = echarts.init(timeDistChartRef.value)
  const hf = overviewData.value.hourlyFaults
  const option = {
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(26, 35, 50, 0.95)', borderColor: '#2A3545', textStyle: { color: '#E0E6ED' } },
    xAxis: {
      type: 'category',
      data: hf.map(h => h.hour),
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' }
    },
    yAxis: { type: 'value', name: '故障次数', splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } }, axisLine: { lineStyle: { color: '#354050' } }, axisLabel: { color: '#A8B2C1' }, nameTextStyle: { color: '#A8B2C1' } },
    series: [
      {
        name: '故障次数',
        type: 'bar',
        data: hf.map(h => h.count),
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#00D4FF' },
            { offset: 1, color: '#0088CC' }
          ])
        }
      }
    ]
  }
  chart.setOption(option)
}

// 初始化健康度排名图表
const initHealthRankChart = () => {
  if (!healthRankChartRef.value) return
  if (!overviewData.value) return

  const chart = echarts.init(healthRankChartRef.value)
  const hr = overviewData.value.healthRank
  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(26, 35, 50, 0.95)', borderColor: '#2A3545', textStyle: { color: '#E0E6ED' } },
    grid: { left: '15%' },
    xAxis: { type: 'value', max: 100, splitLine: { lineStyle: { color: '#2A3545', type: 'dashed' } }, axisLine: { lineStyle: { color: '#354050' } }, axisLabel: { color: '#A8B2C1' } },
    yAxis: {
      type: 'category',
      data: hr.map(h => h.name),
      axisLine: { lineStyle: { color: '#354050' } },
      axisLabel: { color: '#A8B2C1' }
    },
    series: [
      {
        name: '健康度',
        type: 'bar',
        data: hr.map(h => h.health),
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#00E676' },
            { offset: 1, color: '#69F0AE' }
          ])
        }
      }
    ]
  }
  chart.setOption(option)
}

// 生成报表
const handleGenerateReport = async () => {
  if (!reportDateRange.value || reportDateRange.value.length !== 2) {
    ElMessage.warning('请选择报表时间范围')
    return
  }

  const [startDate, endDate] = reportDateRange.value as [Date, Date]
  reportLoading.value = true

  try {
    const res = await $fetch<{ data: { reportData: ReportRow[]; reportSummary: ReportSummary } }>('/api/v1/analysis/report', {
      query: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate)
      }
    })
    reportData.value = res.data.reportData
    reportSummary.value = res.data.reportSummary
    ElMessage.success('报表生成成功')
  } catch (error: any) {
    ElMessage.error(error?.statusMessage || '报表生成失败')
  } finally {
    reportLoading.value = false
  }
}

// 导出报表
const handleExportReport = async () => {
  if (!reportData.value.length || !reportSummary.value) {
    ElMessage.warning('请先生成可导出的报表')
    return
  }

  exportLoading.value = true

  try {
    const summaryRows = [
      { item: '统计范围', value: `${reportSummary.value.startDate} 至 ${reportSummary.value.endDate}` },
      { item: '报表天数', value: reportSummary.value.totalDays },
      { item: '设备总数', value: reportSummary.value.totalDevices },
      { item: '在线设备', value: reportSummary.value.onlineDevices },
      { item: '故障总数', value: reportSummary.value.totalFaultCount },
      { item: '预警总数', value: reportSummary.value.totalAlertCount },
      { item: '平均响应时间(h)', value: reportSummary.value.avgResponseTime },
      { item: '平均安全评分', value: reportSummary.value.averageSecurityScore }
    ]

    await exportExcel(reportData.value, `安全态势报表_${reportSummary.value.startDate}_${reportSummary.value.endDate}`, {
      sheets: [
        {
          name: '报表概览',
          data: summaryRows,
          columns: [
            { key: 'item', title: '指标' },
            { key: 'value', title: '值' }
          ]
        },
        {
          name: '安全态势日报',
          data: reportData.value,
          columns: [
            { key: 'date', title: '日期' },
            { key: 'totalDevices', title: '设备总数' },
            { key: 'onlineDevices', title: '在线设备' },
            { key: 'faultCount', title: '故障次数' },
            { key: 'alertCount', title: '预警次数' },
            { key: 'avgResponseTime', title: '平均响应时间(h)' },
            { key: 'securityScore', title: '安全评分' },
            { key: 'remark', title: '备注' }
          ]
        }
      ]
    })
    ElMessage.success('Excel 导出成功')
  } catch {
    ElMessage.error('Excel 导出失败')
  } finally {
    exportLoading.value = false
  }
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.analysis-page {
  padding: 20px;
}

.score-card {
  .score-content {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;

    .score-circle {
      position: absolute;
      text-align: center;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;

      .score-value {
        font-size: 32px;
        font-weight: 600;
        color: $text-primary;
        line-height: 1;
      }

      .score-label {
        font-size: 11px;
        color: $text-secondary;
        margin-top: 0;
        line-height: 1;
      }
    }
  }
}

.trend-chart {
  width: 100%;
  height: 250px;
}

.stats-row {
  margin: 20px 0;

  .stat-card {
    .stat-content {
      display: flex;
      align-items: center;
      gap: 20px;

      .stat-icon {
        width: 64px;
        height: 64px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
      }

      .stat-info {
        flex: 1;

        .stat-value {
          font-size: 28px;
          font-weight: 600;
          color: $text-primary;
          margin-bottom: 4px;
        }

        .stat-label {
          font-size: 14px;
          color: $text-secondary;
        }
      }
    }
  }
}

.chart {
  width: 100%;
  height: 350px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
