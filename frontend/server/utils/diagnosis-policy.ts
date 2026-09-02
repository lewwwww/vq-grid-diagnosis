export const FAULT_TYPES = [
  '正常',
  '单相接地故障',
  '相间短路故障',
  '三相短路故障',
  '两相接地故障',
  '三相接地短路',
] as const

export const ALERT_TYPES = [
  '正常运行',
  '单相接地预警',
  '相间短路预警',
  '三相短路预警',
  '两相接地预警',
  '三相接地短路预警',
] as const

export const MIN_ALERT_CONFIDENCE = 30

interface AlertDevice {
  id: number
  deviceName: string
}

export function getFaultTypeName(faultType: number) {
  return FAULT_TYPES[faultType] || '未知故障'
}

export function getFaultLevel(confidence: number) {
  if (confidence > 85) return 3
  if (confidence > 70) return 2
  return 1
}

export function shouldCreateAlert(faultType: number, confidence: number) {
  return faultType !== 0 && confidence >= MIN_ALERT_CONFIDENCE
}

export function getAlertLevel(confidence: number) {
  if (confidence > 80) return 3
  if (confidence >= 50) return 2
  return 1
}

export function generateAlertMessage(deviceName: string, faultType: number, confidence: number) {
  const messages = [
    '',
    `${deviceName}检测到单相接地故障特征，A相电压异常，建议检查接地系统`,
    `${deviceName}检测到相间短路故障特征，BC相电流异常，建议立即检查线路连接`,
    `${deviceName}检测到三相短路故障特征，三相电流严重异常，建议立即断电检查`,
    `${deviceName}检测到两相接地故障特征，AB相接地异常，建议立即处理`,
    `${deviceName}检测到三相接地短路故障特征，系统严重异常，建议立即断电全面检查`,
  ]
  return messages[faultType] || `${deviceName}检测到异常，置信度${confidence}%`
}

export function createAlertRecord(
  device: AlertDevice,
  faultType: number,
  confidence: number,
  alertTime: string,
) {
  return {
    deviceId: device.id,
    deviceName: device.deviceName,
    level: getAlertLevel(confidence),
    type: ALERT_TYPES[faultType] || '未知故障预警',
    message: generateAlertMessage(device.deviceName, faultType, confidence),
    alertTime,
    confidence,
    status: 0,
    handler: null,
    handleTime: null,
    remark: null,
  }
}
