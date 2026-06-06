import { DEFAULT_SYSTEM_SETTINGS, getStore } from '~/server/data/store'

export default defineEventHandler(() => {
  const store = getStore()
  return {
    code: 0,
    message: 'success',
    data: store.systemSettings || DEFAULT_SYSTEM_SETTINGS
  }
})
