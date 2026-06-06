import { AlertDB, DeviceDB, FaultDB } from '~/server/data/database'
import { calculateAnalysisOverview } from '~/server/utils/analysis'

export default defineEventHandler(() => {
  const devices = DeviceDB.getAll()
  const faults = FaultDB.getAll()
  const alerts = AlertDB.getAll()

  return {
    code: 200,
    message: 'success',
    data: calculateAnalysisOverview(devices, faults, alerts)
  }
})
