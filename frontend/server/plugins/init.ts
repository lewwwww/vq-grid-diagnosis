/**
 * Nitro 插件 - 服务器启动时初始化
 * 1. 根据系统设置启动自动诊断服务
 * 2. 执行首次启动的自动诊断
 * 3. 启动数据库清理任务
 */

import { getStore } from '~/server/data/store'
import { initAutoDiagnosis, startScheduledDiagnosis, stopScheduledDiagnosis } from '~/server/utils/auto-diagnosis'
import { startCleanupTask } from '~/server/utils/cleanup'
import { logInfo } from '~/server/data/database'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('[服务器启动] 初始化系统服务...')
  logInfo('系统启动', '服务器正在初始化')

  // 1. 执行首次启动的自动诊断（如果数据库为空）
  await initAutoDiagnosis()

  // 2. 根据系统设置启动定时自动诊断
  const store = getStore()
  if (store.systemSettings?.autoDiagnosis) {
    startScheduledDiagnosis()
  } else {
    stopScheduledDiagnosis()
  }

  // 3. 启动数据库清理任务
  startCleanupTask()

  console.log('[服务器启动] 系统服务初始化完成')
  logInfo('系统启动', '系统服务初始化完成')
})
