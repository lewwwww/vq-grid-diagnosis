/**
 * 故障处置知识库问答 API
 *
 * 定位：把「诊断结果」转成运维可用的「解释 + 处置建议 + 来源」。
 * 输入两种方式：
 *  1. faultType: number —— 诊断模型输出的故障类型编号（0-5），精确匹配知识库
 *  2. question: string  —— 自然语言关键词，走模糊检索
 * 降级：未命中具体条目时返回通用处置建议（fallback=true），保证页面始终有结果。
 */

import { KnowledgeDB, logInfo } from '~/server/data/database'
import { getFaultTypeName } from '~/server/utils/diagnosis-policy'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { faultType, question } = body || {}

  // 参数校验：至少要有一个输入
  if (faultType === undefined && !question) {
    return { code: 400, message: '请提供 faultType 或 question', data: null }
  }

  console.log(`[知识库问答] 输入: ${JSON.stringify({ faultType, question })}`)

  // 1. 优先按故障类型精确检索（诊断链路主路径）
  if (typeof faultType === 'number') {
    const item = KnowledgeDB.findByFaultType(faultType)
    if (item) {
      logInfo('知识库问答', `按故障类型 ${faultType}(${getFaultTypeName(faultType)}) 命中知识条目「${item.title}」`)
      return {
        code: 200,
        message: '知识库检索成功',
        data: {
          fault_type: item.faultType,
          fault_type_name: getFaultTypeName(item.faultType),
          explanation: item.explanation,
          actions: item.actions,
          sources: item.source ? [item.source] : [],
          matched_by: 'faultType',
          fallback: false,
        },
      }
    }
  }

  // 2. 关键词检索（自然语言提问路径）
  if (typeof question === 'string' && question.trim()) {
    const results = KnowledgeDB.searchByKeyword(question)
    if (results.length > 0) {
      const item = results[0]
      logInfo('知识库问答', `关键词「${question.trim()}」命中知识条目「${item.title}」`)
      return {
        code: 200,
        message: '知识库检索成功',
        data: {
          fault_type: item.faultType,
          fault_type_name: getFaultTypeName(item.faultType),
          explanation: item.explanation,
          actions: item.actions,
          sources: item.source ? [item.source] : [],
          matched_by: 'keyword',
          fallback: false,
        },
      }
    }
  }

  // 3. 降级：未命中返回通用处置建议（保证页面不空）
  console.log(`[知识库问答] 未命中，返回通用处置建议`)
  return {
    code: 200,
    message: '未命中具体知识条目，返回通用处置建议',
    data: {
      fault_type: typeof faultType === 'number' ? faultType : null,
      fault_type_name: typeof faultType === 'number' ? getFaultTypeName(faultType) : '未知',
      explanation: '当前知识库未收录该场景的专用处置条目，请结合现场实际情况排查。',
      actions: [
        '确认故障已隔离，确保人员安全',
        '查看诊断与预警记录，定位故障设备',
        '结合现场情况按检修规程处置',
        '必要时联系检修班组现场处理',
      ],
      sources: ['系统通用处置建议'],
      matched_by: 'fallback',
      fallback: true,
    },
  }
})
