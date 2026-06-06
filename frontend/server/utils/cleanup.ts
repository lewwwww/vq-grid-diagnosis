/**
 * 数据库清理任务
 * 定期清理旧数据，防止数据库无限增长
 */

import { FaultDB, AlertDB, SystemLogDB, logInfo } from '~/server/data/database'

let cleanupTimer: NodeJS.Timeout | null = null

/**
 * 启动定时清理任务
 * 默认每天凌晨 2 点执行一次
 */
export function startCleanupTask() {
  if (cleanupTimer) {
    console.log('[数据清理] 清理任务已在运行')
    return
  }

  // 立即执行一次清理
  performCleanup()

  // 计算到下一个凌晨 2 点的时间
  const now = new Date()
  const nextRun = new Date()
  nextRun.setHours(2, 0, 0, 0)
  
  // 如果今天的 2 点已过，设置为明天 2 点
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1)
  }

  const delay = nextRun.getTime() - now.getTime()
  
  console.log(`[数据清理] 清理任务已启动，下次执行时间: ${nextRun.toLocaleString('zh-CN')}`)
  
  // 设置定时器
  cleanupTimer = setTimeout(() => {
    performCleanup()
    // 每 24 小时执行一次
    cleanupTimer = setInterval(performCleanup, 24 * 60 * 60 * 1000)
  }, delay)
}

/**
 * 停止清理任务
 */
export function stopCleanupTask() {
  if (cleanupTimer) {
    clearTimeout(cleanupTimer)
    clearInterval(cleanupTimer)
    cleanupTimer = null
    console.log('[数据清理] 清理任务已停止')
  }
}

/**
 * 执行清理操作
 */
function performCleanup() {
  console.log('[数据清理] 开始执行清理任务...')
  
  try {
    // 清理 90 天前的故障记录
    const faultDeleted = FaultDB.deleteOldRecords(90)
    console.log(`[数据清理] 删除了 ${faultDeleted} 条故障记录（保留最近 90 天）`)
    
    // 清理 90 天前的预警记录
    const alertDeleted = AlertDB.deleteOldRecords(90)
    console.log(`[数据清理] 删除了 ${alertDeleted} 条预警记录（保留最近 90 天）`)
    
    // 清理 30 天前的系统日志
    SystemLogDB.deleteOldLogs(30)
    console.log(`[数据清理] 清理了系统日志（保留最近 30 天）`)
    
    // 获取清理后的统计信息
    const faultStats = FaultDB.getStats()
    const alertStats = AlertDB.getStats()
    const logStats = SystemLogDB.getStats()
    
    console.log(`[数据清理] 当前数据量: 故障记录 ${faultStats.total} 条, 预警记录 ${alertStats.total} 条, 系统日志 ${logStats.total} 条`)
    
    logInfo('数据清理', `清理完成: 删除 ${faultDeleted} 条故障记录, ${alertDeleted} 条预警记录, 保留最近数据`)
    
  } catch (error: any) {
    console.error('[数据清理] 清理失败:', error)
  }
}

/**
 * 手动触发清理（用于测试或管理员操作）
 */
export function manualCleanup() {
  performCleanup()
}

/**
 * 获取数据库统计信息
 */
export function getDatabaseStats() {
  const faultStats = FaultDB.getStats()
  const alertStats = AlertDB.getStats()
  const logStats = SystemLogDB.getStats()
  
  return {
    faults: faultStats,
    alerts: alertStats,
    logs: logStats,
    total: faultStats.total + alertStats.total + logStats.total
  }
}

