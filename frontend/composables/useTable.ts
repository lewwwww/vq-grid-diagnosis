/**
 * 表格通用逻辑 - 可复用组合式函数
 */
import { ref, reactive } from 'vue'
import type { Ref } from 'vue'

interface TableOptions {
  fetchData: (params: any) => Promise<any>
  immediate?: boolean
  defaultPageSize?: number
}

interface QueryParams {
  page: number
  size: number
  [key: string]: any
}

export function useTable<T = any>(options: TableOptions) {
  const { fetchData, immediate = true, defaultPageSize = 10 } = options

  const loading = ref(false)
  const data: Ref<T[]> = ref([])
  const total = ref(0)
  const selectedRows: Ref<T[]> = ref([])

  const queryParams = reactive<QueryParams>({
    page: 1,
    size: defaultPageSize
  })

  /**
   * 加载数据
   */
  const loadData = async (resetPage = false) => {
    if (resetPage) {
      queryParams.page = 1
    }

    loading.value = true
    try {
      const response = await fetchData(queryParams)
      data.value = response.records || response.data || []
      total.value = response.total || 0
    } catch (error) {
      console.error('加载数据失败:', error)
      data.value = []
      total.value = 0
    } finally {
      loading.value = false
    }
  }

  /**
   * 搜索
   */
  const handleSearch = () => {
    loadData(true)
  }

  /**
   * 重置
   */
  const handleReset = () => {
    Object.keys(queryParams).forEach(key => {
      if (key !== 'page' && key !== 'size') {
        delete queryParams[key]
      }
    })
    loadData(true)
  }

  /**
   * 刷新
   */
  const handleRefresh = () => {
    loadData()
  }

  /**
   * 分页变化
   */
  const handlePageChange = ({ page, size }: { page: number; size: number }) => {
    queryParams.page = page
    queryParams.size = size
    loadData()
  }

  /**
   * 选择变化
   */
  const handleSelectionChange = (selection: T[]) => {
    selectedRows.value = selection
  }

  // 自动加载
  if (immediate) {
    loadData()
  }

  return {
    loading,
    data,
    total,
    selectedRows,
    queryParams,
    loadData,
    handleSearch,
    handleReset,
    handleRefresh,
    handlePageChange,
    handleSelectionChange
  }
}

