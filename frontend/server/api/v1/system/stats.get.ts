import { getDatabaseStats } from '~/server/utils/cleanup'

export default defineEventHandler(async () => {
  try {
    const stats = getDatabaseStats()
    
    return {
      code: 0,
      message: 'success',
      data: stats
    }
  } catch (error: any) {
    return {
      code: 500,
      message: `获取统计信息失败: ${error.message}`,
      data: null
    }
  }
})

