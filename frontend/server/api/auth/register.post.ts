import { UserDB } from '~/server/data/database'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, realName, email, phone, roleCode, department } = body || {}

  if (!username || !password) {
    return { code: 400, message: '用户名和密码不能为空', data: null }
  }

  // 检查用户名是否已存在
  const existingUser = UserDB.getByUsername(username)
  if (existingUser) {
    return { code: 1002, message: '用户名已存在', data: null }
  }

  // 获取当前最大ID
  const allUsers = UserDB.getAll()
  const maxId = allUsers.length > 0 ? Math.max(...allUsers.map(u => u.id)) : 0

  // 角色映射（默认为运维人员）
  const roleMap: Record<string, { roleId: number; roleName: string }> = {
    'OPERATOR': { roleId: 1, roleName: '电网运维人员' },
    'ADMIN': { roleId: 2, roleName: '系统管理员' }
  }

  const role = roleMap[roleCode || 'OPERATOR'] || roleMap['OPERATOR']

  const newUser = {
    id: maxId + 1,
    username,
    password,
    realName: realName || username,
    email: email || '',
    phone: phone || '',
    roleId: role.roleId,
    roleCode: roleCode || 'OPERATOR',
    roleName: role.roleName,
    department: department || '运维部',
    status: 1,
    createTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  // 插入数据库
  UserDB.insertOne(newUser)

  return { code: 200, message: '注册成功', data: null }
})


