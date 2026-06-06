import type { AlertRecord, Device, FaultRecord } from '~/server/data/store'

export interface AnalysisTrendPoint {
  date: string
  score: number
  onlineRate: number
  faultRate: number
}

export interface AnalysisRiskAreaItem {
  name: string
  value: number
  deviceCount: number
}

export interface AnalysisHealthRankItem {
  name: string
  health: number
}

export interface AnalysisReportRow {
  date: string
  totalDevices: number
  onlineDevices: number
  faultCount: number
  alertCount: number
  avgResponseTime: number
  securityScore: number
  remark: string
}

export interface AnalysisReportSummary {
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

export interface AnalysisOverviewData {
  securityScore: number
  stats: {
    totalDevices: number
    faultCount: number
    alertCount: number
    avgResponseTime: number
  }
  faultTypeStats: Array<{ name: string; value: number; itemStyle: { color: string } }>
  riskAreaStats: AnalysisRiskAreaItem[]
  trendData: AnalysisTrendPoint[]
  hourlyFaults: Array<{ hour: string; count: number }>
  healthRank: AnalysisHealthRankItem[]
  reportData: AnalysisReportRow[]
  reportSummary: AnalysisReportSummary
}

interface ScoreMetricsInput {
  deviceCount: number
  onlineRate: number
  faultCount: number
  alerts: AlertRecord[]
}

interface ScoreMetricsResult {
  avgResponseTime: number
  responseTimeScore: number
  pendingAlertRatio: number
  criticalAlertRatio: number
  faultDensity: number
  securityScore: number
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function toTimestamp(value?: string | null) {
  if (!value) return Number.NaN
  const normalized = value.includes('T') ? value : value.replace(' ', 'T')
  return new Date(normalized).getTime()
}

export function formatDay(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getDayBounds(date: Date) {
  return {
    start: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0),
    end: new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function filterRecordsByRange<T>(
  records: T[],
  getTimeValue: (record: T) => string | null | undefined,
  startTime: number,
  endTime: number
) {
  return records.filter((record) => {
    const time = toTimestamp(getTimeValue(record))
    return !Number.isNaN(time) && time >= startTime && time <= endTime
  })
}

function calculateAvgResponseTime(alerts: AlertRecord[]) {
  const handledAlerts = alerts.filter(alert => alert.status === 2 && alert.handleTime)
  if (handledAlerts.length === 0) return 0

  const totalResponseTime = handledAlerts.reduce((sum, alert) => {
    const createTime = toTimestamp(alert.alertTime)
    const handleTime = toTimestamp(alert.handleTime)
    if (Number.isNaN(createTime) || Number.isNaN(handleTime)) {
      return sum
    }
    return sum + Math.max(0, (handleTime - createTime) / (1000 * 60 * 60))
  }, 0)

  return parseFloat((totalResponseTime / handledAlerts.length).toFixed(1))
}

function calculateScoreMetrics(input: ScoreMetricsInput): ScoreMetricsResult {
  const { deviceCount, onlineRate, faultCount, alerts } = input
  const safeDeviceCount = Math.max(deviceCount, 1)
  const pendingAlerts = alerts.filter(alert => alert.status !== 2)
  const criticalAlerts = alerts.filter(alert => alert.level === 3)
  const handledAlerts = alerts.filter(alert => alert.status === 2 && alert.handleTime)
  const avgResponseTime = calculateAvgResponseTime(alerts)
  const pendingAlertRatio = alerts.length > 0 ? pendingAlerts.length / alerts.length : 0
  const criticalAlertRatio = alerts.length > 0 ? criticalAlerts.length / alerts.length : 0
  const faultDensity = Math.min(faultCount / safeDeviceCount, 1)
  const responseTimeScore = handledAlerts.length === 0
    ? (alerts.length === 0 ? 1 : 0.4)
    : clamp(1 - avgResponseTime / 24, 0, 1)

  const securityScore = clamp(Math.round(
    onlineRate * 35 +
    (1 - faultDensity) * 30 +
    (1 - pendingAlertRatio) * 20 +
    (1 - criticalAlertRatio) * 10 +
    responseTimeScore * 5
  ), 0, 100)

  return {
    avgResponseTime,
    responseTimeScore,
    pendingAlertRatio,
    criticalAlertRatio,
    faultDensity,
    securityScore
  }
}

function buildFaultTypeStats(faults: FaultRecord[], alerts: AlertRecord[]) {
  const alertTypeToFaultType: Record<string, number> = {
    正常运行: 0,
    单相接地预警: 1,
    相间短路预警: 2,
    三相短路预警: 3,
    两相接地预警: 4,
    三相接地短路预警: 5
  }

  const faultTypeCounts: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0
  }

  alerts.forEach(alert => {
    const faultType = alertTypeToFaultType[alert.type]
    if (faultType !== undefined) {
      faultTypeCounts[faultType]++
    }
  })

  if (alerts.length === 0 && faults.length > 0) {
    faults.forEach(fault => {
      if (fault.faultType >= 0 && fault.faultType <= 5) {
        faultTypeCounts[fault.faultType]++
      }
    })
  }

  return [
    { name: '正常', value: faultTypeCounts[0], itemStyle: { color: '#00E676' } },
    { name: '单相接地故障', value: faultTypeCounts[1], itemStyle: { color: '#FFB300' } },
    { name: '相间短路故障', value: faultTypeCounts[2], itemStyle: { color: '#FF6D00' } },
    { name: '三相短路故障', value: faultTypeCounts[3], itemStyle: { color: '#FF3D71' } },
    { name: '两相接地故障', value: faultTypeCounts[4], itemStyle: { color: '#FF5252' } },
    { name: '三相接地短路', value: faultTypeCounts[5], itemStyle: { color: '#D50000' } }
  ]
}

function buildRiskAreaStats(devices: Device[]): AnalysisRiskAreaItem[] {
  const locations = [...new Set(devices.map(device => device.location))]
  return locations.map((location) => {
    const areaDevices = devices.filter(device => device.location === location)
    const faultCount = areaDevices.filter(device => device.status === 2).length
    const riskIndex = areaDevices.length > 0 ? Math.round(faultCount / areaDevices.length * 100) : 0
    return {
      name: location.replace('北京市', ''),
      value: riskIndex,
      deviceCount: areaDevices.length
    }
  }).sort((a, b) => b.value - a.value)
}

function buildHourlyFaults(faults: FaultRecord[]) {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}:00`,
    count: Math.max(0, faults.filter((fault) => {
      const diagnosisTime = toTimestamp(fault.diagnosisTime)
      return !Number.isNaN(diagnosisTime) && new Date(diagnosisTime).getHours() === hour
    }).length)
  }))
}

function buildHealthRank(devices: Device[], faults: FaultRecord[], alerts: AlertRecord[], recentFaults: FaultRecord[]) {
  return devices.map((device) => {
    const deviceFaults = faults.filter(fault => fault.deviceId === device.id)
    const deviceRecentFaults = recentFaults.filter(fault => fault.deviceId === device.id)
    const deviceAlerts = alerts.filter(alert => alert.deviceId === device.id)
    const devicePendingAlerts = deviceAlerts.filter(alert => alert.status !== 2)
    const latestFault = deviceFaults[0]
    const latestFaultPenalty = latestFault ? Math.min((latestFault.confidence || 0) / 10, 20) : 0

    let health = 100
    if (device.status === 0) health -= 35
    if (device.status === 2) health -= 45
    if (device.status === 3) health -= 20
    health -= Math.min(deviceRecentFaults.length * 12, 30)
    health -= Math.min(devicePendingAlerts.length * 8, 24)
    health -= latestFaultPenalty

    return {
      name: device.deviceName.length > 12 ? `${device.deviceName.slice(0, 12)}...` : device.deviceName,
      health: Math.max(5, Math.round(health))
    }
  }).sort((a, b) => a.health - b.health).slice(0, 15)
}

function createDateRangeRows(
  devices: Device[],
  faults: FaultRecord[],
  alerts: AlertRecord[],
  startDate: Date,
  endDate: Date
) {
  const totalDevices = devices.length
  const onlineDevices = devices.filter(device => device.status === 1).length
  const onlineRate = totalDevices > 0 ? onlineDevices / totalDevices : 1
  const rows: AnalysisReportRow[] = []
  const startTime = getDayBounds(startDate).start.getTime()
  const endTime = getDayBounds(endDate).end.getTime()
  const rangeFaults = filterRecordsByRange(faults, fault => fault.diagnosisTime, startTime, endTime)
  const rangeAlerts = filterRecordsByRange(alerts, alert => alert.alertTime, startTime, endTime)

  for (let cursor = startTime; cursor <= endTime; cursor += ONE_DAY_MS) {
    const currentDate = new Date(cursor)
    const day = formatDay(currentDate)
    const dayFaults = rangeFaults.filter(fault => String(fault.diagnosisTime).slice(0, 10) === day)
    const dayAlerts = rangeAlerts.filter(alert => String(alert.alertTime).slice(0, 10) === day)
    const scoreMetrics = calculateScoreMetrics({
      deviceCount: totalDevices,
      onlineRate,
      faultCount: dayFaults.length,
      alerts: dayAlerts
    })

    let remark = '运行平稳'
    if (scoreMetrics.securityScore < 70) {
      remark = '风险较高，建议优先排查'
    } else if (dayAlerts.length > 0 || dayFaults.length > 0) {
      remark = '需关注当日告警'
    }

    rows.push({
      date: day,
      totalDevices,
      onlineDevices,
      faultCount: dayFaults.length,
      alertCount: dayAlerts.length,
      avgResponseTime: scoreMetrics.avgResponseTime,
      securityScore: scoreMetrics.securityScore,
      remark
    })
  }

  const summaryScoreMetrics = calculateScoreMetrics({
    deviceCount: totalDevices,
    onlineRate,
    faultCount: rangeFaults.length,
    alerts: rangeAlerts
  })

  const averageSecurityScore = rows.length > 0
    ? parseFloat((rows.reduce((sum, row) => sum + row.securityScore, 0) / rows.length).toFixed(1))
    : 0

  const summary: AnalysisReportSummary = {
    startDate: formatDay(startDate),
    endDate: formatDay(endDate),
    totalDays: rows.length,
    totalDevices,
    onlineDevices,
    totalFaultCount: rangeFaults.length,
    totalAlertCount: rangeAlerts.length,
    avgResponseTime: summaryScoreMetrics.avgResponseTime,
    averageSecurityScore
  }

  return { rows, summary }
}

export function calculateReportData(
  devices: Device[],
  faults: FaultRecord[],
  alerts: AlertRecord[],
  startDate: Date,
  endDate: Date
) {
  const normalizedStart = getDayBounds(startDate).start
  const normalizedEnd = getDayBounds(endDate).start
  const safeStart = normalizedStart.getTime() <= normalizedEnd.getTime() ? normalizedStart : normalizedEnd
  const safeEnd = normalizedStart.getTime() <= normalizedEnd.getTime() ? normalizedEnd : normalizedStart
  return createDateRangeRows(devices, faults, alerts, safeStart, safeEnd)
}

export function calculateAnalysisOverview(
  devices: Device[],
  faults: FaultRecord[],
  alerts: AlertRecord[],
  now = new Date()
): AnalysisOverviewData {
  const deviceCount = Math.max(devices.length, 1)
  const onlineDevices = devices.filter(device => device.status === 1).length
  const onlineRate = devices.length > 0 ? onlineDevices / devices.length : 1
  const recentStart = new Date(now.getTime() - 29 * ONE_DAY_MS)
  const recentStartTime = getDayBounds(recentStart).start.getTime()
  const nowTime = now.getTime()
  const recentFaults = filterRecordsByRange(faults, fault => fault.diagnosisTime, recentStartTime, nowTime)
  const recentAlerts = filterRecordsByRange(alerts, alert => alert.alertTime, recentStartTime, nowTime)
  const overallMetrics = calculateScoreMetrics({
    deviceCount,
    onlineRate,
    faultCount: recentFaults.length,
    alerts: recentAlerts
  })

  const trendData: AnalysisTrendPoint[] = Array.from({ length: 30 }, (_, index) => {
    const currentDate = new Date(now.getTime() - (29 - index) * ONE_DAY_MS)
    const day = formatDay(currentDate)
    const dayFaults = faults.filter(fault => String(fault.diagnosisTime).slice(0, 10) === day)
    const dayAlerts = alerts.filter(alert => String(alert.alertTime).slice(0, 10) === day)
    const dayMetrics = calculateScoreMetrics({
      deviceCount,
      onlineRate,
      faultCount: dayFaults.length,
      alerts: dayAlerts
    })

    return {
      date: day,
      score: dayMetrics.securityScore,
      onlineRate: parseFloat((onlineRate * 100).toFixed(1)),
      faultRate: parseFloat((dayMetrics.faultDensity * 100).toFixed(1))
    }
  })

  const defaultReportEnd = getDayBounds(now).start
  const defaultReportStart = new Date(defaultReportEnd.getTime() - 6 * ONE_DAY_MS)
  const reportResult = calculateReportData(devices, faults, alerts, defaultReportStart, defaultReportEnd)

  return {
    securityScore: overallMetrics.securityScore,
    stats: {
      totalDevices: devices.length,
      faultCount: faults.length,
      alertCount: alerts.length,
      avgResponseTime: overallMetrics.avgResponseTime
    },
    faultTypeStats: buildFaultTypeStats(faults, alerts),
    riskAreaStats: buildRiskAreaStats(devices),
    trendData,
    hourlyFaults: buildHourlyFaults(faults),
    healthRank: buildHealthRank(devices, faults, alerts, recentFaults),
    reportData: reportResult.rows,
    reportSummary: reportResult.summary
  }
}
