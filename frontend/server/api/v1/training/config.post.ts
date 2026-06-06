import { updateTrainingConfig } from '~/server/data/training'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const next = updateTrainingConfig({
    pythonExecutable: body?.pythonExecutable,
    maxConcurrentJobs: body?.maxConcurrentJobs,
    algorithmSettings: body?.algorithmSettings
  })

  return {
    code: 200,
    message: '配置已更新',
    data: next
  }
})

