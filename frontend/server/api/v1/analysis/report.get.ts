import { AlertDB, DeviceDB, FaultDB } from '~/server/data/database'
import { calculateReportData } from '~/server/utils/analysis'

function parseDateQuery(value: unknown, fieldName: string) {
  if (typeof value !== 'string' || !value) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 参数不能为空`
    })
  }

  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw createError({
      statusCode: 400,
      statusMessage: `${fieldName} 参数格式错误，应为 YYYY-MM-DD`
    })
  }

  return parsed
}

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const startDate = parseDateQuery(query.startDate, 'startDate')
  const endDate = parseDateQuery(query.endDate, 'endDate')
  const dayCount = Math.floor((Math.abs(endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))) + 1

  if (dayCount > 90) {
    throw createError({
      statusCode: 400,
      statusMessage: '报表时间范围不能超过90天'
    })
  }

  const devices = DeviceDB.getAll()
  const faults = FaultDB.getAll()
  const alerts = AlertDB.getAll()
  const reportResult = calculateReportData(devices, faults, alerts, startDate, endDate)

  return {
    code: 200,
    message: 'success',
    data: {
      reportData: reportResult.rows,
      reportSummary: reportResult.summary
    }
  }
})
