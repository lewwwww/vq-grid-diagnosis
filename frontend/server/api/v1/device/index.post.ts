import { DeviceDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const devices = DeviceDB.getAll()
  const newId = devices.length > 0 ? Math.max(...devices.map(d => d.id)) + 1 : 1
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const newDevice = {
    id: newId, deviceCode: body.deviceCode || `BJ-NEW-${String(newId).padStart(4,'0')}`,
    deviceName: body.deviceName || '', deviceType: body.deviceType || 'TRANSFORMER',
    voltageLevel: body.voltageLevel || '110kV', location: body.location || '',
    longitude: body.longitude || 116.4, latitude: body.latitude || 39.9,
    manufacturer: body.manufacturer || '', model: body.model || '',
    installDate: body.installDate || now.slice(0, 10), status: body.status ?? 1,
    createTime: now, updateTime: now
  }
  DeviceDB.insertOne(newDevice)
  return { code: 200, message: '添加成功', data: newId }
})

