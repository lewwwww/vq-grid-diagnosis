import { createTrainingJob, type AlgorithmType } from '~/server/data/training'
import { logInfo } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const algorithm = String(body?.algorithm || '') as AlgorithmType
  const requestedBy = String(body?.requestedBy || 'admin')

  if (!['NODE_IDS'].includes(algorithm)) {
    return { code: 400, message: 'algorithm 仅支持 NODE_IDS', data: null }
  }

  const job = createTrainingJob(algorithm, requestedBy)
  logInfo('模型训练', `${requestedBy} 启动了 ${algorithm} 训练任务 #${job.id}`)

  return {
    code: 200,
    message: job.status === 'RUNNING' ? '训练任务已启动' : '训练任务创建完成',
    data: job
  }
})

