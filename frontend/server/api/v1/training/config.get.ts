import { getTrainingConfig } from '~/server/data/training'

export default defineEventHandler(() => {
  return {
    code: 200,
    message: 'success',
    data: getTrainingConfig()
  }
})

