import { getStore } from '~/server/data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const store = getStore()
  
  store.alertSettings = {
    confidenceThreshold: body.confidenceThreshold || 80,
    generalAlerts: body.generalAlerts || [],
    severeAlerts: body.severeAlerts || [],
    urgentAlerts: body.urgentAlerts || []
  }
  
  console.log('[预警规则] 已更新:', store.alertSettings)
  
  return {
    code: 0,
    message: '保存成功',
    data: store.alertSettings
  }
})

