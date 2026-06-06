import { DeviceDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const body = await readBody(event)
  const device = DeviceDB.getById(id)
  if (!device) return { code: 2001, message: '设备不存在', data: null }
  DeviceDB.update(id, { ...body, updateTime: new Date().toISOString().slice(0,19).replace('T',' ') })
  return { code: 200, message: '更新成功', data: null }
})

