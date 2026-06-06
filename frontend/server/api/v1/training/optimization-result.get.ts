/**
 * 获取最新的超参数优化结果
 */
export default defineEventHandler(async (event) => {
  try {
    const fs = await import('fs/promises')
    const { resolve } = await import('path')
    
    const resultPath = resolve(process.cwd(), '../data_new/models/fault_6class/optimization_result.json')

    try {
      const data = await fs.readFile(resultPath, 'utf-8')
      const result = JSON.parse(data)
      
      return {
        success: true,
        data: result
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return {
          success: false,
          message: '尚未进行超参数优化'
        }
      }
      throw error
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message
    }
  }
})

