/**
 * 获取单个用户信息
 */
import { UserDB } from '~/server/data/database'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const id = Number(query.id)
  
  if (!id) {
    return {
      code: 400,
      message: '用户ID不能为空'
    }
  }

  const user = UserDB.getById(id)
  
  if (!user) {
    return {
      code: 404,
      message: '用户不存在'
    }
  }

  // 移除密码字段
  const { password, ...safeUser } = user
  
  return {
    code: 200,
    message: '查询成功',
    data: safeUser
  }
})

