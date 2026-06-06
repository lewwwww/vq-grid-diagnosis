import { DeviceDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  // 从数据库读取数据
  const query = getQuery(event)
  const page = parseInt(query.page as string) || 1
  const size = parseInt(query.size as string) || 10
  const deviceName = query.deviceName as string
  const deviceType = query.deviceType as string
  const status = query.status !== undefined ? parseInt(query.status as string) : undefined

  let filtered = DeviceDB.getAll()
  if (deviceName) filtered = filtered.filter(d => d.deviceName.includes(deviceName))
  if (deviceType) filtered = filtered.filter(d => d.deviceType === deviceType)
  if (status !== undefined && !isNaN(status)) filtered = filtered.filter(d => d.status === status)

  const total = filtered.length
  const records = filtered.slice((page - 1) * size, page * size)

  return { code: 200, message: 'success', data: { records, total, page, size } }
})

