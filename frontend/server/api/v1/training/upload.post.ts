import { writeFile, mkdir } from 'fs/promises'
import { resolve } from 'path'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)

    if (!formData || formData.length === 0) {
      return { code: 400, message: '未上传文件', data: null }
    }

    const file = formData[0]
    if (!file.filename?.endsWith('.csv')) {
      return { code: 400, message: '仅支持 CSV 格式文件', data: null }
    }

    // 保存文件
    const dataDir = resolve(process.cwd(), '..', 'data_new', 'kaggle')
    await mkdir(dataDir, { recursive: true })
    const filePath = resolve(dataDir, 'classData.csv')
    await writeFile(filePath, file.data)

    // 简单统计
    const content = file.data.toString('utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    const samples = lines.length - 1 // 减去表头

    return {
      code: 200,
      message: '训练数据上传成功',
      data: {
        filename: file.filename,
        samples: samples,
        path: 'data_new/kaggle/classData.csv'
      }
    }
  } catch (error: any) {
    return { code: 500, message: error.message || '上传失败', data: null }
  }
})

