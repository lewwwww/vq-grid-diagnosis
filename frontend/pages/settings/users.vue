<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="handleAdd">新增用户</el-button>
        </div>
      </template>

      <!-- 搜索栏 -->
      <el-form :inline="true" class="search-form">
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="请输入用户名" clearable />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="searchForm.roleCode" placeholder="请选择角色" clearable>
            <el-option label="全部" value="" />
            <el-option label="系统管理员" value="ADMIN" />
            <el-option label="电网运维人员" value="OPERATOR" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadUsers">查询</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 用户列表 -->
      <el-table :data="filteredUsers" border stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" width="120" />
        <el-table-column prop="realName" label="真实姓名" width="120" />
        <el-table-column prop="roleName" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="row.roleCode === 'ADMIN' ? 'danger' : 'success'">
              {{ row.roleName }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="email" label="邮箱" width="180" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'danger'">
              {{ row.status === 1 ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="创建时间" width="180" />
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="handleEdit(row)">编辑</el-button>
            <el-button
              type="danger"
              size="small"
              @click="handleDelete(row)"
              :disabled="row.username === 'admin'"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
    >
      <el-form :model="userForm" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="真实姓名" prop="realName">
          <el-input v-model="userForm.realName" />
        </el-form-item>
        <el-form-item label="角色" prop="roleCode">
          <el-select v-model="userForm.roleCode" style="width: 100%">
            <el-option label="系统管理员" value="ADMIN" />
            <el-option label="电网运维人员" value="OPERATOR" />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-input v-model="userForm.department" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="userForm.email" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="userForm.phone" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="userForm.status">
            <el-radio :label="1">启用</el-radio>
            <el-radio :label="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'

definePageMeta({
  layout: 'default',
  middleware: 'auth'
})

interface User {
  id?: number
  username: string
  password?: string
  realName: string
  email: string
  phone: string
  roleId: number
  roleCode: string
  roleName: string
  department: string
  status: number
  createTime?: string
}

const users = ref<User[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const formRef = ref<FormInstance>()

const searchForm = ref({
  username: '',
  roleCode: ''
})

const userForm = ref<User>({
  username: '',
  password: '',
  realName: '',
  email: '',
  phone: '',
  roleId: 1,
  roleCode: 'OPERATOR',
  roleName: '电网运维人员',
  department: '',
  status: 1
})

const formRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑用户' : '新增用户')

const filteredUsers = computed(() => {
  let result = users.value
  if (searchForm.value.username) {
    result = result.filter(u => u.username.includes(searchForm.value.username))
  }
  if (searchForm.value.roleCode) {
    result = result.filter(u => u.roleCode === searchForm.value.roleCode)
  }
  return result
})

// 加载用户列表
async function loadUsers() {
  try {
    const res = await $fetch('/api/v1/user')
    if (res.code === 200) {
      users.value = res.data
    }
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  }
}

// 重置搜索
function resetSearch() {
  searchForm.value = { username: '', roleCode: '' }
  loadUsers()
}

// 新增用户
function handleAdd() {
  isEdit.value = false
  userForm.value = {
    username: '',
    password: '',
    realName: '',
    email: '',
    phone: '',
    roleId: 1,
    roleCode: 'OPERATOR',
    roleName: '电网运维人员',
    department: '',
    status: 1
  }
  dialogVisible.value = true
}

// 编辑用户
function handleEdit(row: User) {
  isEdit.value = true
  userForm.value = { ...row, password: '' }
  dialogVisible.value = true
}

// 删除用户
async function handleDelete(row: User) {
  try {
    await ElMessageBox.confirm(`确定要删除用户 ${row.username} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res = await $fetch('/api/v1/user/delete', {
      method: 'DELETE',
      body: { id: row.id }
    })

    if (res.code === 200) {
      ElMessage.success('删除成功')
      loadUsers()
    } else {
      ElMessage.error(res.message || '删除失败')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 提交表单
async function handleSubmit() {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      const url = isEdit.value ? '/api/v1/user/update' : '/api/v1/user/create'
      const method = isEdit.value ? 'PUT' : 'POST'

      const res = await $fetch(url, {
        method,
        body: userForm.value
      })

      if (res.code === 200) {
        ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
        dialogVisible.value = false
        loadUsers()
      } else {
        ElMessage.error(res.message || '操作失败')
      }
    } catch (error) {
      ElMessage.error('操作失败')
    }
  })
}

onMounted(() => {
  loadUsers()
})
</script>

<style scoped>
.user-management {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-form {
  margin-bottom: 20px;
}
</style>

