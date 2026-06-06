import { getDiagnosisDatasetPage } from '~/server/utils/diagnosis-samples'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Number.parseInt(query.page as string) || 1
  const size = Number.parseInt(query.size as string) || 10

  try {
    const data = getDiagnosisDatasetPage(page, size)
    return { code: 200, message: 'success', data }
  } catch (error: any) {
    return {
      code: 500,
      message: `读取数据集失败: ${error.message}`,
      data: null
    }
  }
})
