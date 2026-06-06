import { UserDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { realName, email, phone } = body
  
  // 从 token 获取用户信息（简化版，实际应该从 token 解析）
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token) {
    return { code: 401, message: '未登录', data: null }
  }
  
  // 简单解析 token（实际项目应该用 JWT）
  const decoded = Buffer.from(token, 'base64').toString()
  const userId = parseInt(decoded.split(':')[0])
  
  const user = UserDB.getAll().find(u => u.id === userId)
  if (!user) {
    return { code: 404, message: '用户不存在', data: null }
  }
  
  // 更新用户信息
  UserDB.update(userId, { realName, email, phone })
  
  return { code: 200, message: '更新成功', data: null }
})

