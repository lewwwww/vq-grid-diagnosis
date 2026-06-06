import { DeviceDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const device = DeviceDB.getById(id)
  if (!device) return { code: 2001, message: '设备不存在', data: null }
  return { code: 200, message: 'success', data: device }
})

