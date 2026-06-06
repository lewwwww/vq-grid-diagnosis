import { createOptimizationJob } from '~/server/data/training'

/**
 * 启动超参数优化任务
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { n_trials = 30, data_path = 'data_new/kaggle/classData.csv' } = body

  try {
    const job = await createOptimizationJob({ n_trials, data_path })

    return {
      success: true,
      data: job
    }
  } catch (error: any) {
    return {
      success: false,
      message: error.message
    }
  }
})

