import { AlertDB, FaultDB, logInfo, logWarning } from '~/server/data/database'
import { getStore } from '~/server/data/store'
import { loadAllDiagnosisSamples, loadDiagnosisSamples, loadDiagnosisSamplesByRange } from '~/server/utils/diagnosis-samples'
import {
  createAlertRecord,
  getFaultLevel,
  getFaultTypeName,
  shouldCreateAlert,
} from '~/server/utils/diagnosis-policy'

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

interface BatchModelRequest {
  device_id: number
  features: number[]
}

interface BatchModelResult {
  device_id: number
  fault_type?: number
  fault_type_name?: string
  confidence?: number
  inference_time_ms?: number
  encoding_indices?: number[]
  error?: string
}

function getNowString() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')
}

async function callBatchModelService(requests: BatchModelRequest[]) {
  const response = await fetch(`${MODEL_SERVICE_URL}/api/batch_diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requests),
    signal: AbortSignal.timeout(15000)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`模型服务错误 ${response.status}: ${error}`)
  }

  return await response.json() as { results: BatchModelResult[] }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const store = getStore()
  const devices = store.devices

  if (devices.length === 0) {
    return { code: 400, message: '没有可诊断的设备', data: null }
  }

  const mode = body?.mode || 'sampled'
  const startRow = Number.parseInt(body?.startRow) || 1
  const rowCount = Number.parseInt(body?.rowCount) || devices.length

  let samples
  if (mode === 'all') {
    samples = loadAllDiagnosisSamples()
  } else if (mode === 'range') {
    samples = loadDiagnosisSamplesByRange(startRow, rowCount)
  } else {
    samples = loadDiagnosisSamples(10)
  }

  if (samples.length === 0) {
    return { code: 500, message: '数据集样本池为空，无法执行批量诊断', data: null }
  }

  const assignments = devices.map((device, index) => ({
    device,
    sample: samples[index % samples.length]
  }))

  try {
    const modelRequests = assignments.map(({ device, sample }) => ({
      device_id: device.id,
      features: [sample.Ia, sample.Ib, sample.Ic, sample.Va, sample.Vb, sample.Vc]
    }))

    const batchResult = await callBatchModelService(modelRequests)
    const resultMap = new Map(batchResult.results.map(result => [result.device_id, result]))

    let successCount = 0
    let failCount = 0
    const faultTypeStats: Record<string, number> = {}
    const diagnosedDevices: Array<Record<string, any>> = []

    for (const { device, sample } of assignments) {
      const result = resultMap.get(device.id)

      if (!result || result.error || result.fault_type === undefined || result.confidence === undefined) {
        failCount++
        continue
      }

      const faultType = result.fault_type
      const faultTypeName = result.fault_type_name || getFaultTypeName(faultType)
      const confidence = Number.parseFloat((result.confidence * 100).toFixed(1))
      const diagnosisTime = getNowString()

      const record = {
        deviceId: device.id,
        deviceName: device.deviceName,
        deviceCode: device.deviceCode,
        faultType,
        faultLevel: getFaultLevel(confidence),
        confidence,
        diagnosisTime,
        status: 0,
        description: `批量诊断（数据集第${sample.rowIndex}行）：VQ-MLP模型预测为${faultTypeName}，置信度${confidence}%`,
        affectedDevices: [device.deviceCode],
        nodeIds: Array.isArray(result.encoding_indices) ? result.encoding_indices : []
      }

      const faultId = FaultDB.insertOne(record)
      logInfo('故障诊断', `设备 ${device.deviceName} 批量诊断完成，数据集行号: ${sample.rowIndex}，故障类型: ${faultTypeName}，置信度: ${confidence}%`)

      let alertId: number | null = null
      if (shouldCreateAlert(faultType, confidence)) {
        const alertRecord = createAlertRecord(device, faultType, confidence, diagnosisTime)
        alertId = AlertDB.insertOne(alertRecord)
        logWarning('预警管理', `设备 ${device.deviceName} 批量诊断检测到 ${faultTypeName}，已生成预警 #${alertId}`)
      }

      successCount++
      faultTypeStats[faultTypeName] = (faultTypeStats[faultTypeName] || 0) + 1
      diagnosedDevices.push({
        id: faultId,
        deviceId: device.id,
        deviceName: device.deviceName,
        sampleRowIndex: sample.rowIndex,
        faultType,
        faultTypeName,
        confidence,
        alertId,
        inferenceTime: result.inference_time_ms ?? null,
      })
    }

    return {
      code: 200,
      message: '批量诊断完成',
      data: {
        total: devices.length,
        success: successCount,
        fail: failCount,
        mode,
        sampleCount: samples.length,
        sampleRowsPreview: assignments.slice(0, 12).map(item => item.sample.rowIndex),
        faultTypeStats,
        diagnosedDevices
      }
    }
  } catch (error: any) {
    return {
      code: 500,
      message: `批量诊断失败: ${error.message}`,
      data: null
    }
  }
})
