import { UserDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { oldPassword, newPassword } = body
  
  // 从 token 获取用户信息
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token) {
    return { code: 401, message: '未登录', data: null }
  }
  
  // 简单解析 token
  const decoded = Buffer.from(token, 'base64').toString()
  const userId = parseInt(decoded.split(':')[0])
  
  const user = UserDB.getAll().find(u => u.id === userId)
  if (!user) {
    return { code: 404, message: '用户不存在', data: null }
  }
  
  // 验证原密码
  if (user.password !== oldPassword) {
    return { code: 400, message: '原密码错误', data: null }
  }
  
  // 更新密码
  UserDB.update(userId, { password: newPassword })
  
  return { code: 200, message: '密码修改成功', data: null }
})

