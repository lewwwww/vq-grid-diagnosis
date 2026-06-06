import { getStore } from '~/server/data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password } = body || {}
  
  if (!username || !password) {
    return { code: 400, message: '用户名和密码不能为空', data: null }
  }
  
  const store = getStore()
  const user = store.users.find(u => u.username === username && u.password === password)
  
  if (!user) {
    return { code: 1001, message: '用户名或密码错误', data: null }
  }
  
  // 生成简单的token
  const token = Buffer.from(`${user.id}:${user.username}:${Date.now()}`).toString('base64')
  
  return {
    code: 200,
    message: '登录成功',
    data: {
      token,
      userInfo: {
        id: user.id, username: user.username, realName: user.realName,
        email: user.email, phone: user.phone, roleId: user.roleId,
        roleCode: user.roleCode, roleName: user.roleName,
        department: user.department, status: user.status
      }
    }
  }
})

