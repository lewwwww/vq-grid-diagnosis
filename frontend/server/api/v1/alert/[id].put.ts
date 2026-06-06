import { AlertDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const body = await readBody(event)
  const alerts = AlertDB.getAll()
  const alert = alerts.find(a => a.id === id)
  if (!alert) return { code: 404, message: '预警不存在', data: null }

  const updateData: any = {
    status: body.status ?? alert.status,
    remark: body.remark ?? alert.remark
  }

  if ((body.status === 1 || body.status === 2) && body.handler) {
    updateData.handler = body.handler
  }

  if (body.status === 2) {
    updateData.handler = body.handler || alert.handler || '当前用户'
    updateData.handleTime = new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
  AlertDB.update(id, updateData)
  return {
    code: 200,
    message: '处理成功',
    data: {
      id,
      ...alert,
      ...updateData
    }
  }
})
