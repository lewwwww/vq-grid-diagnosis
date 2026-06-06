/**
 * GET /api/v1/diagnosis/samples
 * 从 classData.csv 读取真实样本，仅返回行号 + 6维特征，不返回任何标签信息。
 * 样本按“类内均匀抽样 + 类间交错排列”组织，方便单条诊断和批量诊断都直接复用数据集样本。
 */

import { loadDiagnosisSamples } from '~/server/utils/diagnosis-samples'

export default defineEventHandler(() => {
  try {
    const samples = loadDiagnosisSamples(10)
    return { code: 200, message: 'success', data: samples }
  } catch (e: any) {
    return { code: 500, message: `读取样本失败: ${e.message}`, data: [] }
  }
})
