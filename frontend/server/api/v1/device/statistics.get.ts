import { DeviceDB, FaultDB, AlertDB } from '~/server/data/database'

export default defineEventHandler(() => {
  // 从数据库读取数据
  const devices = DeviceDB.getAll()

  // 故障类型统计（优先使用预警记录，如果没有预警则使用诊断记录）
  const alerts = AlertDB.getAll()
  const faultRecords = FaultDB.getAll()

  // 预警类型映射到故障类型
  const alertTypeToFaultType = {
    '正常运行': 0,
    '单相接地预警': 1,
    '相间短路预警': 2,
    '三相短路预警': 3,
    '两相接地预警': 4,
    '三相接地短路预警': 5
  }

  const faultTypeDistribution = {
    0: 0, // 正常
    1: 0, // 单相接地
    2: 0, // 相间短路
    3: 0, // 三相短路
    4: 0, // 两相接地
    5: 0  // 三相接地短路
  }

  // 优先从预警记录中统计
  if (alerts.length > 0) {
    alerts.forEach(alert => {
      const faultType = alertTypeToFaultType[alert.type]
      if (faultType !== undefined) {
        faultTypeDistribution[faultType]++
      }
    })
  } else if (faultRecords.length > 0) {
    // 如果没有预警记录，从诊断记录中统计
    faultRecords.forEach(f => {
      if (f.faultType >= 0 && f.faultType <= 5) {
        faultTypeDistribution[f.faultType]++
      }
    })
  }

  return {
    code: 200, message: 'success',
    data: {
      totalCount: devices.length,
      onlineCount: devices.filter(d => d.status === 1).length,
      faultCount: devices.filter(d => d.status === 2).length,
      offlineCount: devices.filter(d => d.status === 0).length,
      maintenanceCount: devices.filter(d => d.status === 3).length,
      typeDistribution: {
        TRANSFORMER: devices.filter(d => d.deviceType === 'TRANSFORMER').length,
        CIRCUIT_BREAKER: devices.filter(d => d.deviceType === 'CIRCUIT_BREAKER').length,
        DISCONNECT_SWITCH: devices.filter(d => d.deviceType === 'DISCONNECT_SWITCH').length,
        CAPACITOR: devices.filter(d => d.deviceType === 'CAPACITOR').length,
        REACTOR: devices.filter(d => d.deviceType === 'REACTOR').length,
        BUSBAR: devices.filter(d => d.deviceType === 'BUSBAR').length,
      },
      voltageDistribution: {
        '10kV': devices.filter(d => d.voltageLevel === '10kV').length,
        '35kV': devices.filter(d => d.voltageLevel === '35kV').length,
        '110kV': devices.filter(d => d.voltageLevel === '110kV').length,
        '220kV': devices.filter(d => d.voltageLevel === '220kV').length,
        '500kV': devices.filter(d => d.voltageLevel === '500kV').length,
      },
      faultTypeDistribution // 新增故障类型分布
    }
  }
})

