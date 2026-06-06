import { listTrainingJobs } from '~/server/data/training'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Number(query.limit || 20)

  return {
    code: 200,
    message: 'success',
    data: listTrainingJobs(Number.isFinite(limit) ? limit : 20)
  }
})

