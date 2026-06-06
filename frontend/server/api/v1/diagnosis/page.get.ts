import { FaultDB, DeviceDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const size = parseInt(query.size as string) || 10
  const deviceId = query.deviceId ? parseInt(query.deviceId as string) : undefined
  const deviceName = query.deviceName as string
  const faultType = query.faultType ? parseInt(query.faultType as string) : undefined
  const startDate = query.startDate as string
  const endDate = query.endDate as string

  // 从数据库读取故障记录
  let filtered = FaultDB.getAll()

  if (deviceId !== undefined && !isNaN(deviceId)) filtered = filtered.filter(f => f.deviceId === deviceId)
  if (deviceName) filtered = filtered.filter(f => f.deviceName.includes(deviceName))
  if (faultType !== undefined) filtered = filtered.filter(f => f.faultType === faultType)

  // 日期范围过滤
  if (startDate && endDate) {
    filtered = filtered.filter(f => {
      const diagnosisDate = f.diagnosisTime.split(' ')[0] // 提取日期部分 YYYY-MM-DD
      return diagnosisDate >= startDate && diagnosisDate <= endDate
    })
  }

  const total = filtered.length
  let records = filtered.slice((page - 1) * size, page * size)

  // 关联设备信息，添加 substation 字段
  const allDevices = DeviceDB.getAll()
  records = records.map(fault => {
    const device = allDevices.find(d => d.id === fault.deviceId)
    if (device) {
      return {
        ...fault,
        deviceName: device.deviceName,
        substation: device.substation || '未知变电站'
      }
    }
    return fault
  })

  return { code: 200, message: 'success', data: { records, total, page, size } }
})
