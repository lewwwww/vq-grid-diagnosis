import { stopTrainingJob } from '~/server/data/training'

export default defineEventHandler((event) => {
  const id = Number(event.context.params?.id)
  if (!Number.isFinite(id)) {
    return { code: 400, message: '无效任务ID', data: null }
  }

  const job = stopTrainingJob(id)
  if (!job) {
    return { code: 404, message: '任务不存在或未在运行', data: null }
  }

  return {
    code: 200,
    message: '任务已停止',
    data: job
  }
})

