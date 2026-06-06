import { getStore } from '~/server/data/store'

export default defineEventHandler((event) => {
  const token = getHeader(event, 'authorization')?.replace('Bearer ', '')
  if (!token) {
    return { code: 401, message: '未登录', data: null }
  }
  try {
    const decoded = Buffer.from(token, 'base64').toString()
    const userId = parseInt(decoded.split(':')[0])
    const store = getStore()
    const user = store.users.find(u => u.id === userId)
    if (!user) return { code: 401, message: '用户不存在', data: null }
    return {
      code: 200, message: 'success',
      data: {
        id: user.id, username: user.username, realName: user.realName,
        email: user.email, phone: user.phone, roleId: user.roleId,
        roleCode: user.roleCode, roleName: user.roleName,
        department: user.department, status: user.status
      }
    }
  } catch {
    return { code: 401, message: 'Token无效', data: null }
  }
})

