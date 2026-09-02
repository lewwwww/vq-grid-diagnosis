import { defineStore } from 'pinia'

export interface UserInfo {
  id: number
  username: string
  realName: string
  email: string
  phone: string
  roleId: number
  roleCode: string
  roleName: string
  department: string
  status: number
}

export interface LoginForm {
  username: string
  password: string
}

export interface RegisterForm {
  username: string
  password: string
  realName: string
  email: string
  phone?: string
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: '',
    userInfo: null as UserInfo | null
  }),

  getters: {
    isLogin: (state) => !!state.token,
    isOperator: (state) => state.userInfo?.roleCode === 'OPERATOR',
    isAdmin: (state) => state.userInfo?.roleCode === 'ADMIN'
  },

  actions: {
    getAuthHeaders() {
      const token = this.token || (typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '')
      return token ? { Authorization: `Bearer ${token}` } : {}
    },
    // 登录
    async login(loginForm: LoginForm) {
      try {
        const res = await $fetch('/api/auth/login', { method: 'POST', body: loginForm })
        this.token = (res as any).data.token
        this.userInfo = (res as any).data.userInfo

        // 保存到localStorage
        localStorage.setItem('token', this.token)
        localStorage.setItem('userInfo', JSON.stringify(this.userInfo))

        return res
      } catch (error) {
        console.error('登录失败:', error)
        throw error
      }
    },

    // 注册
    async register(registerForm: RegisterForm) {
      try {
        const res = await $fetch('/api/auth/register', { method: 'POST', body: registerForm })
        return res
      } catch (error) {
        console.error('注册失败:', error)
        throw error
      }
    },

    // 登出
    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch (error) {
        console.error('登出失败:', error)
      } finally {
        this.token = ''
        this.userInfo = null

        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        
        navigateTo('/login')
      }
    },

    // 获取用户信息
    async getUserInfo() {
      try {
        const res = await $fetch('/api/auth/userInfo', {
          headers: this.getAuthHeaders()
        })
        if ((res as any).code !== 200) {
          throw new Error((res as any).message || '鑾峰彇鐢ㄦ埛淇℃伅澶辫触')
        }
        this.userInfo = (res as any).data
        localStorage.setItem('userInfo', JSON.stringify(this.userInfo))
        return res
      } catch (error) {
        console.error('获取用户信息失败:', error)
        throw error
      }
    },

    // 从localStorage恢复状态
    restoreState() {
      const token = localStorage.getItem('token')
      const userInfo = localStorage.getItem('userInfo')
      
      if (token) {
        this.token = token
      }
      
      if (userInfo) {
        try {
          this.userInfo = JSON.parse(userInfo)
        } catch (error) {
          console.error('解析用户信息失败:', error)
        }
      }
    }
  }
})
