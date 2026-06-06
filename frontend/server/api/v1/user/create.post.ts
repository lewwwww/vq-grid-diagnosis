/**
 * 创建用户
 */
import { UserDB } from '~/server/data/database'
import type { User } from '~/server/data/store'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  
  // 验证必填字段
  if (!body.username || !body.password) {
    return {
      code: 400,
      message: '用户名和密码不能为空'
    }
  }

  // 检查用户名是否已存在
  const existingUser = UserDB.getByUsername(body.username)
  if (existingUser) {
    return {
      code: 400,
      message: '用户名已存在'
    }
  }

  // 生成新用户ID
  const maxId = UserDB.getMaxId()
  const newId = maxId + 1

  // 根据角色代码设置角色信息
  let roleId = 1
  let roleCode = 'OPERATOR'
  let roleName = '电网运维人员'
  
  if (body.roleCode === 'ADMIN') {
    roleId = 2
    roleCode = 'ADMIN'
    roleName = '系统管理员'
  }

  // 创建新用户
  const newUser: User = {
    id: newId,
    username: body.username,
    password: body.password, // 注意：实际应用中应该加密密码
    realName: body.realName || '',
    email: body.email || '',
    phone: body.phone || '',
    roleId,
    roleCode,
    roleName,
    department: body.department || '',
    status: body.status !== undefined ? body.status : 1,
    createTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  }

  try {
    UserDB.insertOne(newUser)
    
    // 返回用户信息（不包含密码）
    const { password, ...safeUser } = newUser
    
    return {
      code: 200,
      message: '创建成功',
      data: safeUser
    }
  } catch (error: any) {
    return {
      code: 500,
      message: '创建失败：' + error.message
    }
  }
})

