/**
 * 更新用户信息
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

  // 如果修改了用户名，检查新用户名是否已被其他用户使用
  if (body.username && body.username !== existingUser.username) {
    const userWithSameUsername = UserDB.getByUsername(body.username)
    if (userWithSameUsername) {
      return {
        code: 400,
        message: '用户名已被使用'
      }
    }
  }

  // 准备更新数据
  const updates: any = {}
  
  if (body.username) updates.username = body.username
  if (body.password) updates.password = body.password
  if (body.realName !== undefined) updates.realName = body.realName
  if (body.email !== undefined) updates.email = body.email
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.department !== undefined) updates.department = body.department
  if (body.status !== undefined) updates.status = body.status
  
  // 如果修改了角色
  if (body.roleCode) {
    if (body.roleCode === 'ADMIN') {
      updates.roleId = 2
      updates.roleCode = 'ADMIN'
      updates.roleName = '系统管理员'
    } else {
      updates.roleId = 1
      updates.roleCode = 'OPERATOR'
      updates.roleName = '电网运维人员'
    }
  }

  try {
    UserDB.update(body.id, updates)
    
    // 获取更新后的用户信息
    const updatedUser = UserDB.getById(body.id)
    if (updatedUser) {
      const { password, ...safeUser } = updatedUser
      return {
        code: 200,
        message: '更新成功',
        data: safeUser
      }
    }
    
    return {
      code: 500,
      message: '更新失败'
    }
  } catch (error: any) {
    return {
      code: 500,
      message: '更新失败：' + error.message
    }
  }
})

