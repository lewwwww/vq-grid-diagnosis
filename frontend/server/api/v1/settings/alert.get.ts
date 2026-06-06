import { getStore } from '~/server/data/store'

export default defineEventHandler(() => {
  const store = getStore()
  return {
    code: 0,
    message: 'success',
    data: store.alertSettings || {
      confidenceThreshold: 80,
      generalAlerts: ['单相接地'],
      severeAlerts: ['相间短路', '两相接地'],
      urgentAlerts: ['三相短路', '三相接地短路']
    }
  }
})

