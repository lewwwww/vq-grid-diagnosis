import { manualCleanup } from '~/server/utils/cleanup'
import { logInfo } from '~/server/data/database'

export default defineEventHandler(async () => {
  try {
    manualCleanup()
    logInfo('数据清理', '管理员手动触发数据清理')
    
    return {
      code: 0,
      message: '数据清理完成',
      data: null
    }
  } catch (error: any) {
    return {
      code: 500,
      message: `数据清理失败: ${error.message}`,
      data: null
    }
  }
})

