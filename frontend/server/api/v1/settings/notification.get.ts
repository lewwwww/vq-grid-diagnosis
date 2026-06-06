import { DEFAULT_NOTIFICATION_SETTINGS, getStore } from '~/server/data/store'

export default defineEventHandler(() => {
  const store = getStore()
  return {
    code: 0,
    message: 'success',
    data: store.notificationSettings || DEFAULT_NOTIFICATION_SETTINGS
  }
})
