import { DEFAULT_SYSTEM_SETTINGS, getStore } from '~/server/data/store'
import { startScheduledDiagnosis, stopScheduledDiagnosis } from '~/server/utils/auto-diagnosis'
import { logInfo } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const store = getStore()

  // 保存系统参数
  store.systemSettings = {
    systemName: body.systemName || DEFAULT_SYSTEM_SETTINGS.systemName,
    autoDiagnosis: body.autoDiagnosis !== undefined ? body.autoDiagnosis : DEFAULT_SYSTEM_SETTINGS.autoDiagnosis
  }

  // 根据设置启动或停止自动诊断
  if (store.systemSettings.autoDiagnosis) {
    startScheduledDiagnosis()
    logInfo('系统设置', '已开启自动故障诊断')
  } else {
    stopScheduledDiagnosis()
    logInfo('系统设置', '已关闭自动故障诊断')
  }

  console.log('[系统设置] 参数已更新:', store.systemSettings)
  logInfo('系统设置', `系统参数已更新：自动诊断=${store.systemSettings.autoDiagnosis ? '开启' : '关闭'}`)

  return {
    code: 0,
    message: '保存成功',
    data: store.systemSettings
  }
})
