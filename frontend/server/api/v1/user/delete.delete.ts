/**
 * 删除用户
 */
import { UserDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  if (!body.id) {
    return {
      code: 400,
      message: '用户ID不能为空'
    }
  }

  // 检查用户是否存在
  const existingUser = UserDB.getById(body.id)
  if (!existingUser) {
    return {
      code: 404,
      message: '用户不存在'
    }
  }

  // 不允许删除admin用户
  if (existingUser.username === 'admin') {
    return {
      code: 403,
      message: '不允许删除系统管理员账号'
    }
  }

  try {
    UserDB.delete(body.id)
    
    return {
      code: 200,
      message: '删除成功'
    }
  } catch (error: any) {
    return {
      code: 500,
      message: '删除失败：' + error.message
    }
  }
})

