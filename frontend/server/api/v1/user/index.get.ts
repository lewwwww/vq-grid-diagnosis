/**
 * 获取用户列表
 */
import { UserDB } from '~/server/data/database'

export default defineEventHandler(() => {
  const users = UserDB.getAll()
  
  // 移除密码字段
  const safeUsers = users.map(({ password, ...user }) => user)
  
  return {
    code: 200,
    message: '查询成功',
    data: safeUsers
  }
})

