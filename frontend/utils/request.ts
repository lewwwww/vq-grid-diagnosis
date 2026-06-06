import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'

// 响应数据接口
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
  timestamp: string
}

// 创建axios实例
const service: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json;charset=UTF-8'
  }
})

// 请求拦截器
service.interceptors.request.use(
  (config) => {
    // 从localStorage获取token (仅在客户端)
    if (process.client) {
      const token = localStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
service.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    const res = response.data

    // 如果返回的状态码不是200，则认为是错误
    if (res.code !== 200) {
      if (process.client) {
        ElMessage.error(res.message || '请求失败')
      }

      // 401: 未认证
      if (res.code === 401 && process.client) {
        // 清除token并跳转到登录页
        localStorage.removeItem('token')
        localStorage.removeItem('userInfo')
        window.location.href = '/login'
      }

      return Promise.reject(new Error(res.message || '请求失败'))
    }

    return res
  },
  (error) => {
    console.error('响应错误:', error)

    let message = '网络错误，请稍后重试'

    if (error.response) {
      switch (error.response.status) {
        case 400:
          message = '请求参数错误'
          break
        case 401:
          message = '未认证，请先登录'
          if (process.client) {
            localStorage.removeItem('token')
            localStorage.removeItem('userInfo')
            window.location.href = '/login'
          }
          break
        case 403:
          message = '无权限访问'
          break
        case 404:
          message = '请求的资源不存在'
          break
        case 500:
          message = '服务器内部错误'
          break
        case 503:
          message = '服务暂时不可用'
          break
        default:
          message = error.response.data?.message || '请求失败'
      }
    } else if (error.request) {
      message = '网络连接失败，请检查网络'
    }

    if (process.client) {
      ElMessage.error(message)
    }
    return Promise.reject(error)
  }
)

// 封装请求方法
export const request = {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return service.get(url, config)
  },

  post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return service.post(url, data, config)
  },

  put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return service.put(url, data, config)
  },

  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> {
    return service.delete(url, config)
  }
}

export default service

