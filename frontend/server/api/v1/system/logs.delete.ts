import { SystemLogDB, logInfo } from '~/server/data/database'

export default defineEventHandler(() => {
  SystemLogDB.deleteAll()
  logInfo('系统管理', '系统日志已清空')
  
  return {
    code: 0,
    message: '日志已清空'
  }
})

