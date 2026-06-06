import { getStore } from '~/server/data/store'

export default defineEventHandler((event) => {
  const id = parseInt(getRouterParam(event, 'id') || '0')
  const store = getStore()
  const fault = store.faults.find(f => f.id === id)
  if (!fault) return { code: 3001, message: '诊断记录不存在', data: null }
  return { code: 200, message: 'success', data: fault }
})

