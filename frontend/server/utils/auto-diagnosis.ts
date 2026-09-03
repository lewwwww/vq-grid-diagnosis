/**
 * 自动诊断工具
 * 1. 系统启动时自动诊断一批设备，生成初始数据
 * 2. 定期自动诊断异常设备（根据系统设置）
 */

import { getStore } from '~/server/data/store'
import { FaultDB, AlertDB, logInfo, logWarning, logError } from '~/server/data/database'
import {
  createAlertRecord,
  getFaultLevel,
  shouldCreateAlert,
} from '~/server/utils/diagnosis-policy'

let isInitialized = false
let autoDiagnosisTimer: NodeJS.Timeout | null = null
let isRunning = false

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8000'

/**
 * 初始化自动诊断
 * 如果数据库中没有诊断记录，自动诊断前 10 个设备
 */
export async function initAutoDiagnosis() {
  // 避免重复初始化
  if (isInitialized) return
  
  try {
    const store = getStore()
    const faults = FaultDB.getAll()
    
    // 如果已有诊断记录，不需要自动诊断
    if (faults.length > 0) {
      console.log('[自动诊断] 已有诊断记录，跳过自动诊断')
      isInitialized = true
      return
    }
    
    const devices = store.devices
    
    // 如果没有设备，跳过
    if (devices.length === 0) {
      console.log('[自动诊断] 没有设备，跳过自动诊断')
      isInitialized = true
      return
    }
    
    console.log('[自动诊断] 开始自动诊断前 10 个设备...')
    
    // 诊断前 10 个设备（或所有设备，如果少于 10 个）
    const devicesToDiagnose = devices.slice(0, Math.min(10, devices.length))
    
    let successCount = 0

    for (const device of devicesToDiagnose) {
      try {
        // 复用统一的诊断实现（正确生成六维特征、调用模型服务、保存诊断与预警）
        const success = await diagnoseDevice(device)
        if (success) successCount++
      } catch (error) {
        console.error(`[自动诊断] 设备 ${device.deviceName} 诊断失败:`, error)
      }

      // 间隔 200ms
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    
    console.log(`[自动诊断] 完成！成功诊断 ${successCount}/${devicesToDiagnose.length} 个设备`)
    logInfo('自动诊断', `初始化完成，成功诊断 ${successCount}/${devicesToDiagnose.length} 个设备`)

    isInitialized = true
  } catch (error) {
    console.error('[自动诊断] 初始化失败:', error)
    logError('自动诊断', '初始化失败', String(error))
    isInitialized = true
  }
}

/**
 * 重置初始化状态（用于测试）
 */
export function resetAutoDiagnosis() {
  isInitialized = false
}

// ========== 定期自动诊断功能 ==========

// 提取设备原始特征
function extractRawFeatures(device: any): number[] {
  const deviceId = device.id || 1
  const voltageLevel = device.voltageLevel || '35kV'
  const status = device.status || 1
  return generateRealisticFeatures(deviceId, voltageLevel, status)
}

function generateRealisticFeatures(deviceId: number, voltageLevel: string, status: number): number[] {
  const rng = seededRandom(deviceId + Date.now())
  const voltageParams: Record<string, any> = {
    '35kV': { currentRange: [50, 200] },
    '110kV': { currentRange: [100, 500] },
    '220kV': { currentRange: [200, 1000] }
  }
  const params = voltageParams[voltageLevel] || voltageParams['35kV']
  const [currentMin, currentMax] = params.currentRange

  const faultCharacteristics: Record<number, any> = {
    0: { voltagePu: [0.95, 1.05], currentPu: [0.8, 1.2], imbalance: 0.05 },
    1: { voltagePu: [0.7, 0.9], currentPu: [1.2, 2.0], imbalance: 0.15 },
    2: { voltagePu: [0.5, 0.8], currentPu: [1.5, 2.5], imbalance: 0.20 },
    3: { voltagePu: [0.3, 0.6], currentPu: [2.0, 3.5], imbalance: 0.10 },
    4: { voltagePu: [0.4, 0.7], currentPu: [1.8, 3.0], imbalance: 0.25 },
    5: { voltagePu: [0.2, 0.5], currentPu: [2.5, 4.0], imbalance: 0.15 }
  }

  let faultType = 0
  if (status === 0) {
    faultType = 0
  } else if (status === 1) {
    faultType = rng() < 0.9 ? 0 : (rng() < 0.5 ? 1 : 2)
  } else if (status === 2) {
    faultType = rng() < 0.3 ? 0 : [1, 2, 4][Math.floor(rng() * 3)]
  } else if (status === 3) {
    faultType = [3, 4, 5][Math.floor(rng() * 3)]
  }

  const faultChar = faultCharacteristics[faultType]
  const baseCurrent = currentMin + rng() * (currentMax - currentMin)
  const imbalance = faultChar.imbalance
  const [currentPuMin, currentPuMax] = faultChar.currentPu
  const baseCurrentPu = currentPuMin + rng() * (currentPuMax - currentPuMin)

  const IaPu = baseCurrentPu * (1 + (rng() - 0.5) * imbalance)
  const IbPu = baseCurrentPu * (1 + (rng() - 0.5) * imbalance)
  const IcPu = baseCurrentPu * (1 + (rng() - 0.5) * imbalance)

  const IaRms = baseCurrent * IaPu
  const IbRms = baseCurrent * IbPu
  const IcRms = baseCurrent * IcPu

  const phaseA = rng() * 2 * Math.PI
  const phaseB = phaseA + 2 * Math.PI / 3
  const phaseC = phaseA + 4 * Math.PI / 3

  const Ia = IaRms * Math.sqrt(2) * Math.sin(phaseA)
  const Ib = IbRms * Math.sqrt(2) * Math.sin(phaseB)
  const Ic = IcRms * Math.sqrt(2) * Math.sin(phaseC)

  const [voltagePuMin, voltagePuMax] = faultChar.voltagePu
  const baseVoltagePu = voltagePuMin + rng() * (voltagePuMax - voltagePuMin)

  const VaPu = baseVoltagePu * (1 + (rng() - 0.5) * imbalance)
  const VbPu = baseVoltagePu * (1 + (rng() - 0.5) * imbalance)
  const VcPu = baseVoltagePu * (1 + (rng() - 0.5) * imbalance)

  const voltagePhaseShift = 0.1 + rng() * 0.2
  const Va = VaPu * Math.sin(phaseA + voltagePhaseShift)
  const Vb = VbPu * Math.sin(phaseB + voltagePhaseShift)
  const Vc = VcPu * Math.sin(phaseC + voltagePhaseShift)

  return [Ia, Ib, Ic, Va, Vb, Vc]
}

function seededRandom(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 9301 + 49297) % 233280
    return state / 233280
  }
}

// 检查模型服务是否可用
let modelServiceAvailable: boolean | null = null
let lastCheckTime = 0

async function checkModelService(): Promise<boolean> {
  const now = Date.now()
  // 缓存 30 秒，避免频繁检查
  if (modelServiceAvailable !== null && now - lastCheckTime < 30000) {
    return modelServiceAvailable
  }

  try {
    const response = await fetch(`${MODEL_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    })
    modelServiceAvailable = response.ok
    lastCheckTime = now
    return modelServiceAvailable
  } catch {
    modelServiceAvailable = false
    lastCheckTime = now
    return false
  }
}

// 调用模型推理服务
async function callModelService(deviceId: number, features: number[]): Promise<any> {
  const response = await fetch(`${MODEL_SERVICE_URL}/api/diagnose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_id: deviceId, features }),
    signal: AbortSignal.timeout(5000)
  })

  if (!response.ok) {
    throw new Error(`模型服务错误 ${response.status}`)
  }

  return await response.json()
}

// 自动诊断单个设备
async function diagnoseDevice(device: any): Promise<boolean> {
  try {
    const rawFeatures = extractRawFeatures(device)
    const modelResult = await callModelService(device.id, rawFeatures)

    // 只有检测到故障才记录
    const confidence = Math.round(modelResult.confidence * 100)
    if (shouldCreateAlert(modelResult.fault_type, confidence)) {
      const now = new Date().toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).replace(/\//g, '-').replace(/,/g, '')

      const faultType = modelResult.fault_type

      // 保存诊断记录
      FaultDB.insertOne({
        deviceId: device.id,
        deviceName: device.deviceName,
        deviceCode: device.deviceCode,
        faultType,
        faultLevel: getFaultLevel(confidence),
        confidence,
        diagnosisTime: now,
        status: 0,
        description: `自动诊断检测到故障，置信度${confidence}%`,
        affectedDevices: [device.deviceCode],
        nodeIds: Array.isArray(modelResult.encoding_indices) ? modelResult.encoding_indices : []
      })

      // 生成预警记录
      const alertRecord = createAlertRecord(device, faultType, confidence, now)

      const alertId = AlertDB.insertOne(alertRecord)

      console.log(`[自动诊断] 设备${device.id}(${device.deviceName}) 检测到故障类型${faultType}, 置信度${confidence}%, 已生成预警ID:${alertId}`)
      return true
    }
    return false
  } catch (error: any) {
    console.error(`[自动诊断] 设备${device.id} 诊断失败:`, error.message)
    return false
  }
}

// 执行自动诊断任务
async function runScheduledDiagnosis() {
  if (isRunning) {
    console.log('[定时诊断] 上一次诊断尚未完成，跳过本次')
    return
  }

  isRunning = true
  const store = getStore()

  try {
    // 只诊断状态异常的设备（status = 2 警告 或 3 故障）
    const abnormalDevices = store.devices.filter((d: any) => d.status === 2 || d.status === 3)

    if (abnormalDevices.length === 0) {
      console.log('[定时诊断] 没有异常设备需要诊断')
      return
    }

    console.log(`[定时诊断] 开始诊断 ${abnormalDevices.length} 个异常设备...`)
    logInfo('定时诊断', `开始诊断 ${abnormalDevices.length} 个异常设备`)

    let successCount = 0
    for (const device of abnormalDevices) {
      const success = await diagnoseDevice(device)
      if (success) successCount++
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(`[定时诊断] 完成！检测到 ${successCount}/${abnormalDevices.length} 个设备有故障`)
    logInfo('定时诊断', `完成诊断，检测到 ${successCount}/${abnormalDevices.length} 个设备有故障`)
  } catch (error: any) {
    console.error('[定时诊断] 执行失败:', error.message)
    logError('定时诊断', '执行失败', error.message)
  } finally {
    isRunning = false
  }
}

// 启动定时自动诊断
export function startScheduledDiagnosis() {
  if (autoDiagnosisTimer) {
    console.log('[定时诊断] 服务已在运行')
    return
  }

  console.log('[定时诊断] 服务已启动，每5分钟自动诊断异常设备')

  // 立即执行一次
  runScheduledDiagnosis()

  // 每5分钟执行一次
  autoDiagnosisTimer = setInterval(() => {
    runScheduledDiagnosis()
  }, 5 * 60 * 1000)
}

// 停止定时自动诊断
export function stopScheduledDiagnosis() {
  if (autoDiagnosisTimer) {
    clearInterval(autoDiagnosisTimer)
    autoDiagnosisTimer = null
    console.log('[定时诊断] 服务已停止')
  }
}

// 检查服务状态
export function isScheduledDiagnosisRunning(): boolean {
  return autoDiagnosisTimer !== null
}
