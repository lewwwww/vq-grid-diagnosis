/**
 * 数据存储 - 使用 SQLite 持久化
 * 首次启动时从 JSON 文件加载数据到数据库
 */
import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { UserDB, DeviceDB, FaultDB, AlertDB, SettingsDB } from './database'

// ========== 类型定义 ==========
export interface User {
  id: number; username: string; password: string; realName: string
  email: string; phone: string; roleId: number; roleCode: string
  roleName: string; department: string; status: number; createTime: string
}

export interface Device {
  id: number; deviceCode: string; deviceName: string; deviceType: string
  substation: string; // 所属变电站
  voltageLevel: string; location: string; longitude: number; latitude: number
  manufacturer: string; model: string; installDate: string; status: number
  createTime: string; updateTime: string
}

export interface FaultRecord {
  id: number; deviceId: number; deviceName: string; deviceCode: string
  faultType: number; faultLevel: number; confidence: number
  diagnosisTime: string; status: number
  description: string; affectedDevices: string[]; nodeIds?: number[]
}

export interface AlertRecord {
  id: number; deviceId: number; deviceName: string; level: number
  type: string; message: string; alertTime: string; confidence: number; status: number
  handler: string|null; handleTime: string|null; remark: string|null
}

export interface NotificationRecord {
  id: number
  alertId: number | null
  deviceId: number | null
  deviceName: string
  type: string
  recipientId: number | null
  recipientUsername: string
  recipientName: string
  senderId: number | null
  senderUsername: string
  senderName: string
  content: string
  sendTime: string
  status: string
}

export interface SystemSettings {
  systemName: string
  autoDiagnosis: boolean
}

export interface NotificationSettings {
  systemNotify: boolean
  levels: string[]
}

// ========== 常量定义 ==========
const DEVICE_TYPES = ['TRANSFORMER','CIRCUIT_BREAKER','DISCONNECT_SWITCH','CAPACITOR','REACTOR','BUSBAR']
const DEVICE_TYPE_NAMES: Record<string,string> = {
  TRANSFORMER:'变压器', CIRCUIT_BREAKER:'断路器', DISCONNECT_SWITCH:'隔离开关',
  CAPACITOR:'电容器', REACTOR:'电抗器', BUSBAR:'母线'
}
const MANUFACTURERS = ['西门子','ABB','施耐德电气','国电南瑞','许继电气','特变电工','保变电气','西电集团']
const VOLTAGE_LEVELS = ['10kV','35kV','110kV','220kV','500kV']
const FAULT_TYPES = ['','短路故障','过载故障','接地故障','绝缘故障','设备老化']
// 预警类型基于故障诊断模型的 6 种故障类型
const ALERT_TYPES = [
  '正常运行',           // 0 - 对应诊断模型的正常状态
  '单相接地预警',       // 1 - 对应诊断模型的单相接地故障
  '相间短路预警',       // 2 - 对应诊断模型的相间短路故障
  '三相短路预警',       // 3 - 对应诊断模型的三相短路故障
  '两相接地预警',       // 4 - 对应诊断模型的两相接地故障
  '三相接地短路预警'    // 5 - 对应诊断模型的三相接地短路
]

// ========== 工具函数 ==========
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min
}

function seededPick<T>(seed: number, arr: T[]): T {
  return arr[seededInt(seed, 0, arr.length - 1)]
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

// ========== 数据加载 ==========
interface RawSubstation {
  id: number; name: string; lat: number; lon: number
  voltage: string; operator: string; city: string; tags: Record<string,string>
}

let _initialized = false
let _dataSourceFile = ''
export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  systemName: '智能电网故障诊断系统',
  autoDiagnosis: false
}
let _systemSettings: SystemSettings = { ...DEFAULT_SYSTEM_SETTINGS }
let _alertSettings = {
  confidenceThreshold: 80,
  generalAlerts: ['单相接地'],
  severeAlerts: ['相间短路', '两相接地'],
  urgentAlerts: ['三相短路', '三相接地短路']
}
export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  systemNotify: true,
  levels: ['严重', '紧急']
}
let _notificationSettings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS }

function loadPersistedSettings() {
  _systemSettings = {
    ...DEFAULT_SYSTEM_SETTINGS,
    ...(SettingsDB.get<SystemSettings>('system_settings') || {})
  }
  _notificationSettings = {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(SettingsDB.get<NotificationSettings>('notification_settings') || {})
  }
}

export function getDataSourceInfo() {
  if (!_initialized) { initStore(); _initialized = true }
  return {
    file: _dataSourceFile || 'NOT_FOUND',
    loadedCount: DeviceDB.getAll().length,
    storage: 'SQLite (data/smart_grid.db)'
  }
}

export function getStore() {
  if (!_initialized) {
    initStore()
    _initialized = true
  }
  return {
    devices: DeviceDB.getAll(),
    faults: FaultDB.getAll(),
    alerts: AlertDB.getAll(),
    users: UserDB.getAll(),
    get systemSettings() { return _systemSettings },
    set systemSettings(val) {
      _systemSettings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...val
      }
      SettingsDB.set('system_settings', _systemSettings)
    },
    get alertSettings() { return _alertSettings },
    set alertSettings(val) { _alertSettings = val },
    get notificationSettings() { return _notificationSettings },
    set notificationSettings(val) {
      _notificationSettings = {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...val
      }
      SettingsDB.set('notification_settings', _notificationSettings)
    }
  }
}

function initStore() {
  loadPersistedSettings()

  // 检查数据库是否已有数据
  const existingDevices = DeviceDB.getAll()
  if (existingDevices.length > 0) {
    return // 数据库已有数据，直接返回
  }

  // 首次启动，从 JSON 文件加载数据
  let rawData: RawSubstation[] = []
  const candidates = [
    resolve(process.cwd(), 'real_substation_data_cleaned.json'),
    resolve(process.cwd(), '../real_substation_data_cleaned.json'),
    resolve(process.cwd(), 'real_substation_data_enhanced.json'),
    resolve(process.cwd(), 'real_substation_data.json'),
    resolve(process.cwd(), '../real_substation_data_enhanced.json'),
    resolve(process.cwd(), '../real_substation_data.json')
  ]

  for (const filePath of candidates) {
    if (!existsSync(filePath)) continue
    try {
      rawData = JSON.parse(readFileSync(filePath, 'utf-8'))
      _dataSourceFile = filePath
      break
    } catch {
      // 尝试下一个候选文件
    }
  }

  // 取前200个有效变电站数据
  const substations = rawData.filter(s => s.lat && s.lon).slice(0, 200)

  // 生成并保存数据
  const users = generateUsers()
  const devices = generateDevices(substations)
  const faults = generateFaults(devices)
  const alerts = generateAlerts(devices)

  UserDB.insert(users)
  DeviceDB.insert(devices)
  FaultDB.insert(faults)
  AlertDB.insert(alerts)
}

function generateUsers(): User[] {
  return [
    { id:1, username:'admin', password:'Admin@123', realName:'系统管理员', email:'admin@smartgrid.com', phone:'13800138000', roleId:2, roleCode:'ADMIN', roleName:'系统管理员', department:'技术部', status:1, createTime:'2024-01-01 00:00:00' },
    { id:2, username:'operator1', password:'Oper@123', realName:'张伟', email:'zhangwei@smartgrid.com', phone:'13800138001', roleId:1, roleCode:'OPERATOR', roleName:'电网运维人员', department:'运维一部', status:1, createTime:'2024-01-15 08:00:00' },
  ]
}


function generateDevices(substations: RawSubstation[]): Device[] {
  const districts = ['朝阳区','海淀区','丰台区','通州区','大兴区','顺义区','昌平区','房山区','西城区','东城区','石景山区','门头沟区']
  return substations.map((s, i) => {
    const seed = s.id || (i + 1)
    const typeIdx = seededInt(seed, 0, DEVICE_TYPES.length - 1)
    const deviceType = DEVICE_TYPES[typeIdx]
    const typeName = DEVICE_TYPE_NAMES[deviceType]
    const voltageLevel = s.voltage ?
      (parseInt(s.voltage) >= 500000 ? '500kV' : parseInt(s.voltage) >= 220000 ? '220kV' : parseInt(s.voltage) >= 110000 ? '110kV' : '35kV')
      : seededPick(seed + 1, VOLTAGE_LEVELS)
    const district = seededPick(seed + 2, districts)
    const statusRand = seededRandom(seed + 3)
    const status = statusRand < 0.85 ? 1 : statusRand < 0.90 ? 2 : statusRand < 0.95 ? 3 : 0
    const installYear = seededInt(seed + 4, 2005, 2023)
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    // 所属变电站：使用原始变电站名称或生成一个
    const substation = s.name || `${district}${i+1}号变电站`

    // 设备名称：具体设备名（类型 + 编号）
    const deviceName = `${typeName}#${String(i+1).padStart(3,'0')}`

    return {
      id: i + 1,
      deviceCode: `BJ-${voltageLevel.replace('kV','')}-${String(i+1).padStart(4,'0')}`,
      deviceName,
      substation,
      deviceType,
      voltageLevel,
      location: `北京市${district}`,
      longitude: s.lon,
      latitude: s.lat,
      manufacturer: seededPick(seed + 5, MANUFACTURERS),
      model: `${typeName}-${seededInt(seed+6,100,999)}`,
      installDate: `${installYear}-${String(seededInt(seed+7,1,12)).padStart(2,'0')}-${String(seededInt(seed+8,1,28)).padStart(2,'0')}`,
      status,
      createTime: now,
      updateTime: now
    }
  })
}

function generateFaults(devices: Device[]): FaultRecord[] {
  // 不再生成模拟故障数据，只保留真实模型诊断的数据
  // 用户通过"新建诊断"功能调用真实模型进行诊断
  return []
}

function generateAlerts(devices: Device[]): AlertRecord[] {
  const alerts: AlertRecord[] = []
  let alertId = 0
  devices.filter((_,i) => i < 80).forEach(device => {
    const seed = device.id * 400
    if (seededRandom(seed) < 0.4) {
      alertId++
      // 预警类型基于故障诊断模型（0-5）
      const typeIdx = seededInt(seed+2, 1, ALERT_TYPES.length-1) // 排除 0（正常运行）

      // 生成置信度（30-99%）
      const confidence = seededInt(seed+8, 30, 99)

      // 根据置信度确定预警等级（多级预警）
      // 高危 > 80%: 紧急(3), 中危 50-80%: 严重(2), 低危 30-50%: 一般(1)
      let level: number
      if (confidence > 80) {
        level = 3 // 高危 - 紧急
      } else if (confidence >= 50) {
        level = 2 // 中危 - 严重
      } else {
        level = 1 // 低危 - 一般
      }

      const daysAgo = seededInt(seed+3,0,30)
      const alertTime = new Date(Date.now() - daysAgo * 86400000)
      const isHandled = daysAgo > 7 || seededRandom(seed+4) > 0.3

      // 根据故障类型生成详细的预警信息
      const messageMap = [
        '',
        `${device.deviceName}检测到单相接地故障特征，A相电压异常，建议检查接地系统`,
        `${device.deviceName}检测到相间短路故障特征，BC相电流异常，建议立即检查线路连接`,
        `${device.deviceName}检测到三相短路故障特征，三相电流严重异常，建议立即断电检查`,
        `${device.deviceName}检测到两相接地故障特征，AB相接地异常，建议立即处理`,
        `${device.deviceName}检测到三相接地短路故障特征，系统严重异常，建议立即断电全面检查`
      ]

      alerts.push({
        id: alertId,
        deviceId: device.id,
        deviceName: device.deviceName,
        level,
        type: ALERT_TYPES[typeIdx],
        message: messageMap[typeIdx],
        alertTime: formatDate(alertTime),
        confidence, // 添加置信度字段
        status: isHandled ? (seededRandom(seed+7) > 0.5 ? 2 : 1) : 0, // 0-待处理, 1-处理中, 2-已处理
        handler: isHandled ? ['张伟','李强','王芳'][seededInt(seed+5,0,2)] : null,
        handleTime: isHandled ? formatDate(new Date(alertTime.getTime() + seededInt(seed+6,1,48)*3600000)) : null,
        remark: isHandled ? '已处理完成' : null
      })
    }
  })
  return alerts.sort((a,b) => b.id - a.id)
}
