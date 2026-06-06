import { SystemLogDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  
  const page = Number(query.page) || 1
  const pageSize = Number(query.pageSize) || 20
  const level = query.level as string | undefined
  
  const result = SystemLogDB.getAll({
    level: level || undefined,
    page,
    pageSize
  })
  
  return {
    code: 0,
    message: 'success',
    data: result
  }
})

