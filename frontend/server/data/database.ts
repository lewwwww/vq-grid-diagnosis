/**
 * SQLite 数据库模块 - 数据持久化
 */
import Database from 'better-sqlite3'
import { resolve } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { User, Device, FaultRecord, AlertRecord, NotificationRecord } from './store'

export interface SystemLog {
  id: number
  level: 'INFO' | 'WARNING' | 'ERROR'
  module: string
  message: string
  timestamp: string
  details?: string
}

export interface AppSettingRecord {
  key: string
  value: string
  updateTime: string
}

let db: Database.Database | null = null

// 获取数据库实例
export function getDatabase() {
  if (!db) {
    const dataDir = resolve(process.cwd(), 'data')
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }
    const dbPath = resolve(dataDir, 'smart_grid.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL') // 提高并发性能
  }
  initTables()
  return db
}

// 初始化数据表
function initTables() {
  if (!db) return

  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      realName TEXT,
      email TEXT,
      phone TEXT,
      roleId INTEGER,
      roleCode TEXT,
      roleName TEXT,
      department TEXT,
      status INTEGER DEFAULT 1,
      createTime TEXT
    )
  `)

  // 设备表
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id INTEGER PRIMARY KEY,
      deviceCode TEXT UNIQUE NOT NULL,
      deviceName TEXT,
      substation TEXT,
      deviceType TEXT,
      voltageLevel TEXT,
      voltage REAL,
      current REAL,
      power REAL,
      location TEXT,
      longitude REAL,
      latitude REAL,
      manufacturer TEXT,
      model TEXT,
      installDate TEXT,
      status INTEGER DEFAULT 1,
      createTime TEXT,
      updateTime TEXT
    )
  `)

  ensureColumn('devices', 'substation', 'TEXT')
  ensureColumn('devices', 'voltage', 'REAL')
  ensureColumn('devices', 'current', 'REAL')
  ensureColumn('devices', 'power', 'REAL')

  // 故障记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS fault_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId INTEGER,
      deviceName TEXT,
      deviceCode TEXT,
      faultType INTEGER,
      faultLevel INTEGER,
      confidence REAL,
      diagnosisTime TEXT,
      status INTEGER DEFAULT 0,
      description TEXT,
      affectedDevices TEXT,
      nodeIds TEXT
    )
  `)

  ensureColumn('fault_records', 'nodeIds', 'TEXT')



  // 预警记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS alert_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deviceId INTEGER,
      deviceName TEXT,
      level INTEGER,
      type TEXT,
      message TEXT,
      alertTime TEXT,
      confidence INTEGER DEFAULT 50,
      status INTEGER DEFAULT 0,
      handler TEXT,
      handleTime TEXT,
      remark TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alertId INTEGER,
      deviceId INTEGER,
      deviceName TEXT,
      type TEXT,
      recipientId INTEGER,
      recipientUsername TEXT,
      recipientName TEXT,
      senderId INTEGER,
      senderUsername TEXT,
      senderName TEXT,
      content TEXT,
      sendTime TEXT,
      status TEXT
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updateTime TEXT NOT NULL
    )
  `)

  // 系统日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      module TEXT NOT NULL,
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      details TEXT
    )
  `)

  // 创建索引
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON system_logs(timestamp DESC)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_level ON system_logs(level)`)
}

function ensureColumn(tableName: string, columnName: string, columnDef: string) {
  if (!db) return
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>
  if (!columns.some(column => column.name === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`)
  }
}

// ========== 用户操作 ==========
export const UserDB = {
  getAll(): User[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM users').all() as User[]
  },

  getByUsername(username: string): User | undefined {
    const db = getDatabase()
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined
  },

  insert(users: User[]) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO users
      (id, username, password, realName, email, phone, roleId, roleCode, roleName, department, status, createTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((users: User[]) => {
      for (const u of users) {
        stmt.run(u.id, u.username, u.password, u.realName, u.email, u.phone, u.roleId, u.roleCode, u.roleName, u.department, u.status, u.createTime)
      }
    })
    insertMany(users)
  },

  insertOne(user: User) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO users
      (id, username, password, realName, email, phone, roleId, roleCode, roleName, department, status, createTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(user.id, user.username, user.password, user.realName, user.email, user.phone, user.roleId, user.roleCode, user.roleName, user.department, user.status, user.createTime)
  },

  update(id: number, updates: Partial<User>) {
    const db = getDatabase()
    const fields = Object.keys(updates).filter(k => k !== 'id').map(k => `${k} = ?`).join(', ')
    const values = Object.keys(updates).filter(k => k !== 'id').map(k => updates[k as keyof User])
    db.prepare(`UPDATE users SET ${fields} WHERE id = ?`).run(...values, id)
  },

  getById(id: number): User | undefined {
    const db = getDatabase()
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined
  },

  delete(id: number) {
    const db = getDatabase()
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
  },

  getMaxId(): number {
    const db = getDatabase()
    const result = db.prepare('SELECT MAX(id) as maxId FROM users').get() as { maxId: number | null }
    return result.maxId || 0
  }
}

// ========== 设备操作 ==========
export const DeviceDB = {
  getAll(): Device[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM devices').all() as any[]
    return rows
  },

  getById(id: number): Device | undefined {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as any
    if (!row) return undefined
    return row
  },

  insert(devices: Device[]) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO devices
      (id, deviceCode, deviceName, substation, deviceType, voltageLevel, voltage, current, power, location, longitude, latitude, manufacturer, model, installDate, status, createTime, updateTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((devices: Device[]) => {
      for (const d of devices) {
        stmt.run(d.id, d.deviceCode, d.deviceName, d.substation, d.deviceType, d.voltageLevel, (d as any).voltage ?? null, (d as any).current ?? null, (d as any).power ?? null, d.location, d.longitude, d.latitude, d.manufacturer, d.model, d.installDate, d.status, d.createTime, d.updateTime)
      }
    })
    insertMany(devices)
  },

  insertOne(device: Device) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO devices
      (id, deviceCode, deviceName, substation, deviceType, voltageLevel, voltage, current, power, location, longitude, latitude, manufacturer, model, installDate, status, createTime, updateTime)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(device.id, device.deviceCode, device.deviceName, device.substation, device.deviceType, device.voltageLevel, (device as any).voltage ?? null, (device as any).current ?? null, (device as any).power ?? null, device.location, device.longitude, device.latitude, device.manufacturer, device.model, device.installDate, device.status, device.createTime, device.updateTime)
  },

  update(id: number, device: Partial<Device>) {
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []

    if (device.substation !== undefined) { fields.push('substation = ?'); values.push(device.substation) }
    if (device.deviceName !== undefined) { fields.push('deviceName = ?'); values.push(device.deviceName) }
    if (device.deviceType !== undefined) { fields.push('deviceType = ?'); values.push(device.deviceType) }
    if (device.voltageLevel !== undefined) { fields.push('voltageLevel = ?'); values.push(device.voltageLevel) }
    if ((device as any).voltage !== undefined) { fields.push('voltage = ?'); values.push((device as any).voltage) }
    if ((device as any).current !== undefined) { fields.push('current = ?'); values.push((device as any).current) }
    if ((device as any).power !== undefined) { fields.push('power = ?'); values.push((device as any).power) }
    if (device.location !== undefined) { fields.push('location = ?'); values.push(device.location) }
    if (device.longitude !== undefined) { fields.push('longitude = ?'); values.push(device.longitude) }
    if (device.latitude !== undefined) { fields.push('latitude = ?'); values.push(device.latitude) }
    if (device.manufacturer !== undefined) { fields.push('manufacturer = ?'); values.push(device.manufacturer) }
    if (device.model !== undefined) { fields.push('model = ?'); values.push(device.model) }
    if (device.status !== undefined) { fields.push('status = ?'); values.push(device.status) }
    if (device.updateTime !== undefined) { fields.push('updateTime = ?'); values.push(device.updateTime) }

    if (fields.length === 0) return

    values.push(id)
    const sql = `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`
    db.prepare(sql).run(...values)
  },

  delete(id: number) {
    const db = getDatabase()
    db.prepare('DELETE FROM devices WHERE id = ?').run(id)
  }
}

// ========== 故障记录操作 ==========
export const FaultDB = {
  getAll(): FaultRecord[] {
    const db = getDatabase()
    const rows = db.prepare('SELECT * FROM fault_records ORDER BY id DESC').all() as any[]
    return rows.map(r => ({
      ...r,
      affectedDevices: JSON.parse(r.affectedDevices || '[]'),
      nodeIds: JSON.parse(r.nodeIds || '[]')
    }))
  },

  getById(id: number): FaultRecord | undefined {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM fault_records WHERE id = ?').get(id) as any
    if (!row) return undefined
    return {
      ...row,
      affectedDevices: JSON.parse(row.affectedDevices || '[]'),
      nodeIds: JSON.parse(row.nodeIds || '[]')
    }
  },

  insert(faults: FaultRecord[]) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO fault_records
      (deviceId, deviceName, deviceCode, faultType, faultLevel, confidence, diagnosisTime, status, description, affectedDevices, nodeIds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((faults: FaultRecord[]) => {
      for (const f of faults) {
        stmt.run(
          f.deviceId,
          f.deviceName,
          f.deviceCode,
          f.faultType,
          f.faultLevel,
          f.confidence,
          f.diagnosisTime,
          f.status,
          f.description,
          JSON.stringify(f.affectedDevices),
          JSON.stringify(f.nodeIds || [])
        )
      }
    })
    insertMany(faults)
  },

  insertOne(fault: Omit<FaultRecord, 'id'>): number {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO fault_records
      (deviceId, deviceName, deviceCode, faultType, faultLevel, confidence, diagnosisTime, status, description, affectedDevices, nodeIds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      fault.deviceId,
      fault.deviceName,
      fault.deviceCode,
      fault.faultType,
      fault.faultLevel,
      fault.confidence,
      fault.diagnosisTime,
      fault.status,
      fault.description,
      JSON.stringify(fault.affectedDevices),
      JSON.stringify(fault.nodeIds || [])
    )
    return result.lastInsertRowid as number
  },

  // 删除旧记录（保留最近 N 天）
  deleteOldRecords(daysToKeep: number = 90) {
    const db = getDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffStr = cutoffDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-').replace(/,/g, '')

    const result = db.prepare('DELETE FROM fault_records WHERE diagnosisTime < ?').run(cutoffStr)
    return result.changes
  },

  // 获取统计信息
  getStats() {
    const db = getDatabase()
    const total = db.prepare('SELECT COUNT(*) as count FROM fault_records').get() as { count: number }
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM fault_records
      GROUP BY status
    `).all() as Array<{ status: number; count: number }>

    return {
      total: total.count,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item.count
        return acc
      }, {} as Record<number, number>)
    }
  }
}

// ========== 预警记录操作 ==========
export const AlertDB = {
  getAll(): AlertRecord[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM alert_records ORDER BY id DESC').all() as AlertRecord[]
  },

  insert(alerts: AlertRecord[]) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO alert_records
      (deviceId, deviceName, level, type, message, alertTime, confidence, status, handler, handleTime, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((alerts: AlertRecord[]) => {
      for (const a of alerts) {
        stmt.run(a.deviceId, a.deviceName, a.level, a.type, a.message, a.alertTime, a.confidence || 50, a.status, a.handler, a.handleTime, a.remark)
      }
    })
    insertMany(alerts)
  },

  insertOne(alert: Partial<AlertRecord>): number {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO alert_records
      (deviceId, deviceName, level, type, message, alertTime, confidence, status, handler, handleTime, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      alert.deviceId,
      alert.deviceName,
      alert.level,
      alert.type,
      alert.message,
      alert.alertTime,
      alert.confidence || 50,
      alert.status || 0,
      alert.handler || null,
      alert.handleTime || null,
      alert.remark || null
    )
    return result.lastInsertRowid as number
  },

  update(id: number, data: Partial<AlertRecord>) {
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []

    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status) }
    if (data.handler !== undefined) { fields.push('handler = ?'); values.push(data.handler) }
    if (data.handleTime !== undefined) { fields.push('handleTime = ?'); values.push(data.handleTime) }
    if (data.remark !== undefined) { fields.push('remark = ?'); values.push(data.remark) }

    if (fields.length === 0) return

    values.push(id)
    const sql = `UPDATE alert_records SET ${fields.join(', ')} WHERE id = ?`
    db.prepare(sql).run(...values)
  },

  // 删除旧记录（保留最近 N 天）
  deleteOldRecords(daysToKeep: number = 90) {
    const db = getDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffStr = cutoffDate.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-').replace(/,/g, '')

    const result = db.prepare('DELETE FROM alert_records WHERE alertTime < ?').run(cutoffStr)
    return result.changes
  },

  // 获取统计信息
  getStats() {
    const db = getDatabase()
    const total = db.prepare('SELECT COUNT(*) as count FROM alert_records').get() as { count: number }
    const byStatus = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM alert_records
      GROUP BY status
    `).all() as Array<{ status: number; count: number }>

    return {
      total: total.count,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item.count
        return acc
      }, {} as Record<number, number>)
    }
  }
}

// ========== 通知记录操作 ==========
export const NotificationDB = {
  getAll(): NotificationRecord[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM notification_records ORDER BY id DESC').all() as NotificationRecord[]
  },

  insert(records: NotificationRecord[]) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO notification_records
      (alertId, deviceId, deviceName, type, recipientId, recipientUsername, recipientName, senderId, senderUsername, senderName, content, sendTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insertMany = db.transaction((items: NotificationRecord[]) => {
      for (const item of items) {
        stmt.run(
          item.alertId,
          item.deviceId,
          item.deviceName,
          item.type,
          item.recipientId,
          item.recipientUsername,
          item.recipientName,
          item.senderId,
          item.senderUsername,
          item.senderName,
          item.content,
          item.sendTime,
          item.status
        )
      }
    })
    insertMany(records)
  },

  insertOne(record: Omit<NotificationRecord, 'id'>) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO notification_records
      (alertId, deviceId, deviceName, type, recipientId, recipientUsername, recipientName, senderId, senderUsername, senderName, content, sendTime, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      record.alertId,
      record.deviceId,
      record.deviceName,
      record.type,
      record.recipientId,
      record.recipientUsername,
      record.recipientName,
      record.senderId,
      record.senderUsername,
      record.senderName,
      record.content,
      record.sendTime,
      record.status
    )
    return result.lastInsertRowid as number
  }
}

// ========== 系统设置操作 ==========
export const SettingsDB = {
  get<T>(key: string): T | undefined {
    const db = getDatabase()
    const record = db.prepare('SELECT * FROM app_settings WHERE key = ?').get(key) as AppSettingRecord | undefined
    if (!record) return undefined

    try {
      return JSON.parse(record.value) as T
    } catch {
      return undefined
    }
  },

  set(key: string, value: unknown) {
    const db = getDatabase()
    const updateTime = new Date().toISOString().slice(0, 19).replace('T', ' ')
    db.prepare(`
      INSERT INTO app_settings (key, value, updateTime)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updateTime = excluded.updateTime
    `).run(key, JSON.stringify(value), updateTime)
  }
}

// ========== 系统日志操作 ==========
export const SystemLogDB = {
  getAll(options?: { level?: string; page?: number; pageSize?: number }): { records: SystemLog[]; total: number } {
    const db = getDatabase()

    let sql = 'SELECT * FROM system_logs'
    let countSql = 'SELECT COUNT(*) as total FROM system_logs'
    const params: any[] = []

    if (options?.level) {
      sql += ' WHERE level = ?'
      countSql += ' WHERE level = ?'
      params.push(options.level)
    }

    sql += ' ORDER BY id DESC'

    // 分页
    if (options?.page && options?.pageSize) {
      const offset = (options.page - 1) * options.pageSize
      sql += ' LIMIT ? OFFSET ?'
      params.push(options.pageSize, offset)
    }

    const records = db.prepare(sql).all(...params) as SystemLog[]
    const totalResult = db.prepare(countSql).get(...(options?.level ? [options.level] : [])) as { total: number }

    return {
      records,
      total: totalResult.total
    }
  },

  insertOne(log: Omit<SystemLog, 'id'>) {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO system_logs (level, module, message, timestamp, details)
      VALUES (?, ?, ?, ?, ?)
    `)
    const result = stmt.run(
      log.level,
      log.module,
      log.message,
      log.timestamp,
      log.details || null
    )
    return result.lastInsertRowid as number
  },

  deleteAll() {
    const db = getDatabase()
    db.prepare('DELETE FROM system_logs').run()
  },

  deleteOldLogs(daysToKeep: number = 30) {
    const db = getDatabase()
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    const cutoffStr = cutoffDate.toISOString().slice(0, 19).replace('T', ' ')
    db.prepare('DELETE FROM system_logs WHERE timestamp < ?').run(cutoffStr)
  },

  // 获取日志统计信息
  getStats() {
    const db = getDatabase()
    const total = db.prepare('SELECT COUNT(*) as count FROM system_logs').get() as { count: number }
    const byLevel = db.prepare(`
      SELECT level, COUNT(*) as count
      FROM system_logs
      GROUP BY level
    `).all() as Array<{ level: string; count: number }>

    return {
      total: total.count,
      byLevel: byLevel.reduce((acc, item) => {
        acc[item.level] = item.count
        return acc
      }, {} as Record<string, number>)
    }
  }
}

// 日志记录辅助函数
export function logInfo(module: string, message: string, details?: string) {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')

  SystemLogDB.insertOne({ level: 'INFO', module, message, timestamp, details })
  console.log(`[${module}] ${message}`)
}

export function logWarning(module: string, message: string, details?: string) {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')

  SystemLogDB.insertOne({ level: 'WARNING', module, message, timestamp, details })
  console.warn(`[${module}] ${message}`)
}

export function logError(module: string, message: string, details?: string) {
  const timestamp = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-').replace(/,/g, '')

  SystemLogDB.insertOne({ level: 'ERROR', module, message, timestamp, details })
  console.error(`[${module}] ${message}`)
}

// 关闭数据库连接
export function closeDatabase() {
  if (db) {
    db.close()
    db = null
  }
}
