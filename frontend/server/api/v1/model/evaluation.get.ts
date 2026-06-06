import { readFile } from 'fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async () => {
  try {
    const rootDir = resolve(process.cwd(), '..')
    const reportPath = resolve(rootDir, 'data_new/models/fault_6class/evaluation_report.json')
    
    const content = await readFile(reportPath, 'utf-8')
    const report = JSON.parse(content)
    
    return {
      code: 0,
      message: 'success',
      data: report
    }
  } catch (error: any) {
    // 如果文件不存在，返回空数据
    if (error.code === 'ENOENT') {
      return {
        code: 404,
        message: '暂无评估报告，请先完成模型训练',
        data: null
      }
    }
    
    return {
      code: 500,
      message: `读取评估报告失败: ${error.message}`,
      data: null
    }
  }
})

