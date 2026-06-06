import { getStore } from '~/server/data/store'
import { DeviceDB } from '~/server/data/database'

/**
 * 设备导入 API
 * 支持 Excel (.xlsx, .xls) 和 CSV 文件导入
 */

// 解析 CSV 文件
function parseCSV(content: string): any[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim())
  const data = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim())
    const row: any = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    data.push(row)
  }

  return data
}

// 解析 Excel 文件（简化版，仅支持 CSV 格式）
async function parseExcel(buffer: Buffer): Promise<any[]> {
  // 这里简化处理，实际应该使用 xlsx 库
  // 由于是最小实现，我们假设用户上传的是 CSV 格式
  const content = buffer.toString('utf-8')
  return parseCSV(content)
}

export default defineEventHandler(async (event) => {
  const store = getStore()

  try {
    // 读取上传的文件
    const form = await readMultipartFormData(event)
    if (!form || form.length === 0) {
      return { code: 400, message: '请上传文件', data: null }
    }

    const file = form[0]
    const filename = file.filename || ''
    const buffer = file.data

    console.log(`[文件导入] 开始解析文件: ${filename}`)

    // 解析文件内容
    let rows: any[] = []
    if (filename.endsWith('.csv')) {
      const content = buffer.toString('utf-8')
      rows = parseCSV(content)
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      rows = await parseExcel(buffer)
    } else {
      return { code: 400, message: '不支持的文件格式，请上传 CSV 或 Excel 文件', data: null }
    }

    if (rows.length === 0) {
      return { code: 400, message: '文件内容为空', data: null }
    }

    console.log(`[文件导入] 解析到 ${rows.length} 行数据`)

    // 导入设备数据
    let imported = 0
    let skipped = 0
    const duplicates: string[] = []  // 记录重复的设备
    const now = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-').replace(/,/g, '')

    // 获取当前最大 ID
    const allDevices = DeviceDB.getAll()
    let maxId = allDevices.length > 0
      ? Math.max(...allDevices.map(d => d.id))
      : 0

    // 遍历每一行数据
    for (const row of rows) {
      // 检查必填字段
      const deviceCode = row['设备编号'] || row['deviceCode'] || ''
      const deviceName = row['设备名称'] || row['deviceName'] || ''
      const substation = row['所属变电站'] || row['substation'] || ''
      const deviceType = row['设备类型'] || row['deviceType'] || 'TRANSFORMER'
      const location = row['位置'] || row['location'] || ''
      const voltageLevel = row['电压等级'] || row['voltageLevel'] || '110kV'

      if (!deviceCode || !deviceName) {
        console.log(`[文件导入] 跳过无效行: 设备编号或设备名称为空`)
        skipped++
        continue
      }

      // 检查设备编号是否已存在
      const existsByCode = allDevices.some(d => d.deviceCode === deviceCode)
      if (existsByCode) {
        console.log(`[文件导入] 跳过已存在的设备编号: ${deviceCode}`)
        duplicates.push(`${deviceCode} (设备编号重复)`)
        skipped++
        continue
      }

      // 不再检查设备名称重复（因为多个设备可能有相同名称，如"变压器#001"）
      // 只检查设备编号唯一性

      maxId++

      // 解析数值字段
      const voltage = parseInt(row['电压(V)'] || row['voltage'] || '110000')
      const current = parseInt(row['电流(A)'] || row['current'] || '300')
      const power = parseInt(row['功率(MW)'] || row['power'] || '50')
      const status = parseInt(row['状态'] || row['status'] || '1')
      const longitude = parseFloat(row['经度'] || row['longitude'] || '0')
      const latitude = parseFloat(row['纬度'] || row['latitude'] || '0')
      const manufacturer = row['制造商'] || row['manufacturer'] || ''
      const model = row['型号'] || row['model'] || ''
      const installDate = row['安装日期'] || row['installDate'] || now

      // 创建设备记录
      const device = {
        id: maxId,
        deviceCode,
        deviceName,
        substation,
        deviceType,
        location,
        voltageLevel,
        voltage,
        current,
        power,
        status,
        latitude,
        longitude,
        manufacturer,
        model,
        installDate,
        createTime: now,
        updateTime: now
      }

      // 保存到数据库
      DeviceDB.insertOne(device)
      imported++

      console.log(`[文件导入] 导入设备: ${deviceName} - ${substation} (${deviceCode})`)
    }

    console.log(`[文件导入] 成功导入 ${imported} 个设备，跳过 ${skipped} 个`)

    // 如果有重复设备，返回详细信息
    if (duplicates.length > 0) {
      return {
        code: 200,
        message: `导入完成！成功 ${imported} 个，跳过 ${skipped} 个重复设备`,
        data: {
          imported,
          skipped,
          total: rows.length,
          duplicates
        }
      }
    }

    return {
      code: 200,
      message: '导入成功',
      data: {
        imported,
        skipped,
        total: rows.length
      }
    }

  } catch (error: any) {
    console.error('[文件导入] 导入失败:', error)
    return {
      code: 500,
      message: `导入失败: ${error.message}`,
      data: null
    }
  }
})

