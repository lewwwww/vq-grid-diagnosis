/**
 * 设备运行数据导入 + 自动诊断 API
 * 用户上传 CSV 文件，系统自动解析并诊断
 */

import { DeviceDB, FaultDB, AlertDB } from '~/server/data/database'
import {
  createAlertRecord,
  getFaultLevel,
  shouldCreateAlert,
} from '~/server/utils/diagnosis-policy'

// 简单的 CSV 解析函数（不依赖外部库）
function parseCSV(content: string): any[] {
  const lines = content.trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const records: any[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const record: any = {}
    headers.forEach((header, index) => {
      record[header] = values[index]
    })
    records.push(record)
  }

  return records
}

// 生成特征 [Ia, Ib, Ic, Va, Vb, Vc]
// 根据 CSV 中的电压、电流、功率等数据生成三相特征
function generateFeaturesFromData(voltage: number, current: number, power: number, temperature: number, loadRate: number): number[] {
  // 基于单相数据估算三相数据
  // 假设三相基本平衡，但根据负载率和温度添加一些不平衡度

  const imbalance = (loadRate - 0.75) * 0.1 + (temperature - 45) * 0.002

  // 三相电流 (A)
  const Ia = current * (1 + imbalance)
  const Ib = current * (1 - imbalance * 0.5)
  const Ic = current * (1 - imbalance * 0.5)

  // 三相电压 (标幺值，以额定电压为基准)
  const ratedVoltage = 220  // 假设额定电压 220V
  const Va = (voltage / ratedVoltage) * (1 + imbalance * 0.5)
  const Vb = (voltage / ratedVoltage) * (1 - imbalance * 0.3)
  const Vc = (voltage / ratedVoltage) * (1 - imbalance * 0.2)

  return [Ia, Ib, Ic, Va, Vb, Vc]
}

export default defineEventHandler(async (event) => {
  try {
    // 解析上传的文件
    const form = await readMultipartFormData(event)
    if (!form || form.length === 0) {
      return { code: 400, message: '请上传文件' }
    }

    const fileData = form[0]
    const filename = fileData.filename || ''
    const buffer = fileData.data

    // 只支持 CSV 文件
    if (!filename.endsWith('.csv')) {
      return { code: 400, message: '目前只支持 CSV 文件，请上传 .csv 格式' }
    }

    // 解析 CSV
    const content = buffer.toString('utf-8')
    const records = parseCSV(content)

    if (records.length === 0) {
      return { code: 400, message: '文件中没有数据' }
    }

    console.log(`[数据导入] 解析到 ${records.length} 条记录`)

    // 验证数据格式 - 支持两种模式
    // 模式1: 直接提供特征 (device_id, Ia, Ib, Ic, Va, Vb, Vc)
    // 模式2: 提供运行数据 (device_id, voltage, current, power, temperature, load_rate)
    const firstRecord = records[0]
    const hasFeatures = 'Ia' in firstRecord && 'Ib' in firstRecord && 'Ic' in firstRecord &&
                        'Va' in firstRecord && 'Vb' in firstRecord && 'Vc' in firstRecord
    const hasRunningData = 'voltage' in firstRecord && 'current' in firstRecord && 'power' in firstRecord

    if (!hasFeatures && !hasRunningData) {
      return {
        code: 400,
        message: '数据格式错误，请提供以下字段之一：',
        hint: '模式1: device_id, Ia, Ib, Ic, Va, Vb, Vc (直接特征)\n模式2: device_id, voltage, current, power, temperature (可选), load_rate (可选)'
      }
    }

    console.log(`[数据导入] 使用${hasFeatures ? '特征模式' : '运行数据模式'}`)

    // 获取所有设备
    const devices = DeviceDB.getAll()
    const deviceMap = new Map(devices.map(d => [d.id, d]))

    let successCount = 0
    let failCount = 0
    let diagnosedDevices: any[] = []

    // 逐条处理数据并诊断
    for (const record of records) {
      try {
        const deviceId = parseInt(record.device_id)
        const device = deviceMap.get(deviceId)

        if (!device) {
          console.warn(`[数据导入] 设备 ID ${deviceId} 不存在，跳过`)
          failCount++
          continue
        }

        // 获取特征
        let features: number[]

        if (hasFeatures) {
          // 模式1: 直接使用提供的特征
          features = [
            parseFloat(record.Ia),
            parseFloat(record.Ib),
            parseFloat(record.Ic),
            parseFloat(record.Va),
            parseFloat(record.Vb),
            parseFloat(record.Vc)
          ]
          console.log(`[数据导入] 设备${device.id} - 使用直接特征: Ia=${features[0].toFixed(2)}, Ib=${features[1].toFixed(2)}, Ic=${features[2].toFixed(2)}, Va=${features[3].toFixed(4)}, Vb=${features[4].toFixed(4)}, Vc=${features[5].toFixed(4)}`)
        } else {
          // 模式2: 从运行数据生成特征
          const voltage = parseFloat(record.voltage) || 220
          const current = parseFloat(record.current) || 100
          const power = parseFloat(record.power) || 1000
          const temperature = parseFloat(record.temperature) || 45
          const loadRate = parseFloat(record.load_rate) || 0.75

          features = generateFeaturesFromData(voltage, current, power, temperature, loadRate)
          console.log(`[数据导入] 设备${device.id} - 生成特征: Ia=${features[0].toFixed(2)}, Ib=${features[1].toFixed(2)}, Ic=${features[2].toFixed(2)}, Va=${features[3].toFixed(4)}, Vb=${features[4].toFixed(4)}, Vc=${features[5].toFixed(4)}`)
        }

        // 调用算法服务进行诊断
        const response = await $fetch('http://localhost:8000/api/diagnose', {
          method: 'POST',
          body: {
            device_id: device.id,
            features: features
          }
        })

        // 算法服务直接返回数据，不包装在 { code, data } 中
        const faultType = response.fault_type
        const confidence = Math.round(response.confidence * 100)

        console.log(`[数据导入] 设备${device.id} - 故障类型: ${faultType}, 置信度: ${confidence}%`)

        // 保存诊断记录
        const now = new Date().toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).replace(/\//g, '-').replace(/,/g, '')

        FaultDB.insertOne({
          deviceId: device.id,
          deviceName: device.deviceName,
          deviceCode: device.deviceCode,
          faultType,
          faultLevel: getFaultLevel(confidence),
          confidence,
          diagnosisTime: now,
          status: 0,
          description: `数据导入自动诊断 - ${response.fault_type_name}`,
          affectedDevices: [],
          nodeIds: Array.isArray(response.encoding_indices) ? response.encoding_indices : []
        })

        // 如果检测到故障（置信度 ≥ 30%），自动生成预警
        if (shouldCreateAlert(faultType, confidence)) {
          AlertDB.insertOne(createAlertRecord(device, faultType, confidence, now))
        }

        diagnosedDevices.push({
          deviceId: device.id,
          deviceName: device.deviceName,
          faultType,
          confidence
        })

        successCount++

        // 间隔 100ms，避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`[数据导入] 诊断失败:`, error)
        failCount++
      }
    }

    console.log(`[数据导入] 完成！成功 ${successCount} 个，失败 ${failCount} 个`)

    return {
      code: 200,
      message: '数据导入并诊断完成',
      data: {
        total: records.length,
        success: successCount,
        fail: failCount,
        diagnosedDevices
      }
    }

  } catch (error: any) {
    console.error('[数据导入] 失败:', error)
    return {
      code: 500,
      message: error.message || '数据导入失败'
    }
  }
})
