import { getStore } from '~/server/data/store'
import { FaultDB, AlertDB, logInfo, logWarning } from '~/server/data/database'

 /**
  * Node IDs 故障诊断 API - 离线数据回放接口
  *
  * 系统设计了离线数据回放接口，用于模拟实时传感器数据流。
  * 诊断模块从 Kaggle 测试数据集中读取历史故障录波数据（三相电流、电压特征），
  * 经过与训练阶段一致的 Z-score 归一化预处理后，输入至训练好的 VQ-MLP 模型，
  * 输出故障分类结果及置信度。不包含原始标签，仅返回模型预测结果。
  *
  * 请求体：
  * - deviceId: 设备ID（用于记录归属）
  * - features: [Ia, Ib, Ic, Va, Vb, Vc] 六维特征（来自测试集真实录波数据）
  * - sampleRowIndex: 原CSV行号（可选，用于记录溯源）
  */

// 配置
const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

console.log(`[诊断服务] 模型服务地址: ${MODEL_SERVICE_URL}`)

// 调用模型推理服务
async function callModelService(deviceId: number, features: number[]): Promise<any> {
  try {
    const response = await fetch(`${MODEL_SERVICE_URL}/api/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        features: features
      }),
      signal: AbortSignal.timeout(5000) // 5秒超时
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`模型服务错误 ${response.status}: ${error}`)
    }

    const result = await response.json()
    console.log(`[模型推理] 设备${deviceId} - 故障类型:${result.fault_type}, 置信度:${result.confidence}`)
    return result

  } catch (error: any) {
    console.error(`[模型推理] 调用失败:`, error.message)
    throw error
  }
}

// 故障类型名称（与训练数据对应）
const FAULT_TYPES = [
  '正常',              // 0
  '单相接地故障',      // 1
  '相间短路故障',      // 2
  '三相短路故障',      // 3
  '两相接地故障',      // 4
  '三相接地短路'       // 5
]

// 预警类型名称（与预警管理对应）
const ALERT_TYPES = [
  '正常运行',           // 0
  '单相接地预警',       // 1
  '相间短路预警',       // 2
  '三相短路预警',       // 3
  '两相接地预警',       // 4
  '三相接地短路预警'    // 5
]

// 根据置信度和故障类型生成预警信息
function generateAlertMessage(device: any, faultType: number, confidence: number): string {
  const messages = [
    '',
    `${device.deviceName}检测到单相接地故障特征，A相电压异常，建议检查接地系统`,
    `${device.deviceName}检测到相间短路故障特征，BC相电流异常，建议立即检查线路连接`,
    `${device.deviceName}检测到三相短路故障特征，三相电流严重异常，建议立即断电检查`,
    `${device.deviceName}检测到两相接地故障特征，AB相接地异常，建议立即处理`,
    `${device.deviceName}检测到三相接地短路故障特征，系统严重异常，建议立即断电全面检查`
  ]
  return messages[faultType] || `${device.deviceName}检测到异常，置信度${confidence}%`
}

// 根据置信度确定预警等级（多级预警）
function getAlertLevel(confidence: number): number {
  if (confidence > 80) return 3  // 高危 - 紧急
  if (confidence >= 50) return 2 // 中危 - 严重
  return 1                       // 低危 - 一般
}

// 创建预警记录
function createAlertRecord(device: any, faultType: number, confidence: number): any {
  const now = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')
  const level = getAlertLevel(confidence)

  return {
    deviceId: device.id,
    deviceName: device.deviceName,
    level,
    type: ALERT_TYPES[faultType],
    message: generateAlertMessage(device, faultType, confidence),
    alertTime: now,
    confidence,
    status: 0,  // 待处理
    handler: null,
    handleTime: null,
    remark: null
  }
}

// 发送通知（仅系统通知）
async function sendNotification(alert: any): Promise<void> {
  console.log(`[通知发送] 预警ID:${alert.id}, 设备:${alert.deviceName}, 等级:${alert.level}, 置信度:${alert.confidence}%`)

  // 根据置信度确定通知方式
  if (alert.confidence > 80) {
    console.log(`  → 高危预警（${alert.confidence}%）: 系统通知`)
  } else if (alert.confidence >= 50) {
    console.log(`  → 中危预警（${alert.confidence}%）: 系统通知`)
  } else {
    console.log(`  → 低危预警（${alert.confidence}%）: 系统通知`)
  }
}

// 将模型输出的故障类型映射到具体故障名称
function mapFaultType(modelFaultType: number): { faultType: number; faultTypeName: string } {
  // 模型直接输出 6 分类结果（0-5）
  // 0: 正常
  // 1: 单相接地故障
  // 2: 相间短路故障
  // 3: 三相短路故障
  // 4: 两相接地故障
  // 5: 三相接地短路

  const faultType = modelFaultType
  const faultTypeName = FAULT_TYPES[faultType] || '未知故障'

  return { faultType, faultTypeName }
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { deviceId, features, sampleRowIndex } = body
  const store = getStore()

  if (!deviceId) return { code: 400, message: '请指定设备ID', data: null }
  if (!features || !Array.isArray(features) || features.length !== 6) {
    return { code: 400, message: '请提供6维特征 [Ia, Ib, Ic, Va, Vb, Vc]', data: null }
  }

  const device = store.devices.find(d => d.id === deviceId)
  if (!device) return { code: 2001, message: '设备不存在', data: null }

  try {
    console.log(`[数据回放] 设备${deviceId} 读取测试集样本${sampleRowIndex ? `(行${sampleRowIndex})` : ''}`)
    console.log(`  → 输入特征: Ia=${features[0].toFixed(2)}, Ib=${features[1].toFixed(2)}, Ic=${features[2].toFixed(2)}`)
    console.log(`  → 输入特征: Va=${features[3].toFixed(4)}, Vb=${features[4].toFixed(4)}, Vc=${features[5].toFixed(4)}`)

    // 1. 调用模型推理服务（模型内部会进行 Z-score 归一化）
    const modelResult = await callModelService(deviceId, features)

    // 2. 处理模型输出
    const { faultType, faultTypeName } = mapFaultType(modelResult.fault_type)

    const confidence = parseFloat((modelResult.confidence * 100).toFixed(1))

    // 3. 保存诊断记录到数据库
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-').replace(/,/g, '')

    const sourceDesc = sampleRowIndex ? `测试集第${sampleRowIndex}行` : '测试集样本'
    const record = {
      deviceId,
      deviceName: device.deviceName,
      deviceCode: device.deviceCode,
      faultType,
      faultLevel: confidence > 85 ? 3 : confidence > 70 ? 2 : 1,
      confidence,
      diagnosisTime: now,
      status: 0,
      description: `离线数据回放诊断（${sourceDesc}）：VQ-MLP模型预测为${faultTypeName}，置信度${confidence}%`,
      affectedDevices: [device.deviceCode],
      nodeIds: Array.isArray(modelResult.encoding_indices) ? modelResult.encoding_indices : []
    }

    const newId = FaultDB.insertOne(record)
    logInfo('故障诊断', `设备 ${device.deviceName} 数据回放诊断完成，故障类型: ${faultTypeName}，置信度: ${confidence}%`)

    // 4. 如果检测到故障（置信度 ≥ 30%），自动生成预警记录
    let alertId = null
    if (faultType !== 0 && confidence >= 30) {
      const alertRecord = createAlertRecord(device, faultType, confidence)
      alertId = AlertDB.insertOne(alertRecord)

      console.log(`[预警生成] 诊断触发预警 - 预警ID:${alertId}, 故障类型:${faultTypeName}, 置信度:${confidence}%`)
      logWarning('预警管理', `设备 ${device.deviceName} 检测到 ${faultTypeName}，已生成预警 #${alertId}`)

      // 发送通知
      await sendNotification({ ...alertRecord, id: alertId })
    }

    return {
      code: 200,
      message: '诊断成功',
      data: {
        ...record,
        id: newId,
        alertId, // 返回预警ID（如果生成了预警）
        faultTypeName,
        probabilities: modelResult.probabilities.map((p: number) => parseFloat((p * 100).toFixed(1))),
        inferenceTime: modelResult.inference_time_ms
      }
    }

  } catch (error: any) {
    console.error('[诊断失败]', error)
    return {
      code: 500,
      message: `诊断失败: ${error.message}`,
      data: null
    }
  }
})
