import { AlertDB, DeviceDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const size = parseInt(query.size as string) || 10
  const deviceId = query.deviceId ? parseInt(query.deviceId as string) : undefined
  const level = query.level ? parseInt(query.level as string) : undefined
  const status = query.status !== undefined && query.status !== '' ? parseInt(query.status as string) : undefined
  const startDate = query.startDate as string
  const endDate = query.endDate as string

  // 从数据库读取预警记录
  let filtered = AlertDB.getAll()

  if (deviceId !== undefined && !isNaN(deviceId)) filtered = filtered.filter(a => a.deviceId === deviceId)
  if (level !== undefined && !isNaN(level)) filtered = filtered.filter(a => a.level === level)
  if (status !== undefined && !isNaN(status)) filtered = filtered.filter(a => a.status === status)

  // 日期范围过滤
  if (startDate && endDate) {
    filtered = filtered.filter(a => {
      const alertDate = a.alertTime.split(' ')[0] // 提取日期部分 YYYY-MM-DD
      return alertDate >= startDate && alertDate <= endDate
    })
  }

  const total = filtered.length
  let records = filtered.slice((page - 1) * size, page * size)

  // 关联设备信息，添加 substation 字段
  const allDevices = DeviceDB.getAll()
  records = records.map(alert => {
    const device = allDevices.find(d => d.id === alert.deviceId)
    if (device) {
      return {
        ...alert,
        deviceName: device.deviceName,
        substation: device.substation || '未知变电站'
      }
    }
    return alert
  })

  // 统计
  const allAlerts = deviceId !== undefined && !isNaN(deviceId)
    ? AlertDB.getAll().filter(a => a.deviceId === deviceId)
    : AlertDB.getAll()
  const stats = {
    total: allAlerts.length,
    pending: allAlerts.filter(a => a.status === 0).length,
    processing: allAlerts.filter(a => a.status === 1).length,
    completed: allAlerts.filter(a => a.status === 2).length
  }

  return { code: 200, message: 'success', data: { records, total, page, size, stats } }
})
