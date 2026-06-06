import { DEFAULT_NOTIFICATION_SETTINGS, getStore } from '~/server/data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const store = getStore()
  
  store.notificationSettings = {
    systemNotify: body.systemNotify !== undefined ? body.systemNotify : DEFAULT_NOTIFICATION_SETTINGS.systemNotify,
    levels: Array.isArray(body.levels) ? body.levels : DEFAULT_NOTIFICATION_SETTINGS.levels
  }
  
  console.log('[通知设置] 已更新:', store.notificationSettings)
  
  return {
    code: 0,
    message: '保存成功',
    data: store.notificationSettings
  }
})
