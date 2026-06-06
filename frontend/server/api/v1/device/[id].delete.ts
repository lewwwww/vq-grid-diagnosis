import { DeviceDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const device = DeviceDB.getById(id)
  if (!device) return { code: 2001, message: '设备不存在', data: null }
  DeviceDB.delete(id)
  return { code: 200, message: '删除成功', data: null }
})

