import { logInfo, logError } from '~/server/data/database'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

export default defineEventHandler(async (event) => {
  try {
    // 调用 Python 模型服务的重载接口
    const response = await fetch(`${MODEL_SERVICE_URL}/reload`, {
      method: 'POST'
    })
    
    if (!response.ok) {
      throw new Error(`模型服务返回错误: ${response.status}`)
    }
    
    const result = await response.json()
    
    logInfo('模型管理', '模型已重新加载，新训练的模型已生效')
    
    return {
      code: 0,
      message: '模型重载成功',
      data: result
    }
  } catch (error: any) {
    logError('模型管理', '模型重载失败', error.message)
    return {
      code: 500,
      message: `模型重载失败: ${error.message}`,
      data: null
    }
  }
})

