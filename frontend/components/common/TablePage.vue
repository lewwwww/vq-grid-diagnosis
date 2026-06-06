<template>
  <div class="table-page">
    <!-- 搜索栏 -->
    <div v-if="showSearch" class="search-bar">
      <slot name="search"></slot>
      <div class="search-actions">
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          搜索
        </el-button>
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon>
          重置
        </el-button>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <slot name="toolbar-left"></slot>
      </div>
      <div class="toolbar-right">
        <slot name="toolbar-right"></slot>
        <el-button v-if="showRefresh" @click="handleRefresh" circle>
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 表格 -->
    <el-table
      :data="data"
      :loading="loading"
      v-bind="$attrs"
      @selection-change="handleSelectionChange"
    >
      <slot></slot>
    </el-table>

    <!-- 分页 -->
    <div v-if="showPagination" class="pagination">
      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="pageSizes"
        :layout="paginationLayout"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search, Refresh } from '@element-plus/icons-vue'

interface Props {
  data: any[]
  total?: number
  loading?: boolean
  showSearch?: boolean
  showPagination?: boolean
  showRefresh?: boolean
  pageSizes?: number[]
  paginationLayout?: string
}

const props = withDefaults(defineProps<Props>(), {
  data: () => [],
  total: 0,
  loading: false,
  showSearch: true,
  showPagination: true,
  showRefresh: true,
  pageSizes: () => [10, 20, 50, 100],
  paginationLayout: 'total, sizes, prev, pager, next, jumper'
})

const emit = defineEmits(['search', 'reset', 'refresh', 'selection-change', 'page-change'])

const currentPage = ref(1)
const pageSize = ref(10)

const handleSearch = () => {
  currentPage.value = 1
  emit('search')
}

const handleReset = () => {
  currentPage.value = 1
  pageSize.value = 10
  emit('reset')
}

const handleRefresh = () => {
  emit('refresh')
}

const handleSelectionChange = (selection: any[]) => {
  emit('selection-change', selection)
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  emit('page-change', { page: currentPage.value, size })
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
  emit('page-change', { page, size: pageSize.value })
}

defineExpose({
  currentPage,
  pageSize
})
</script>

<style scoped lang="scss">
.table-page {
  .search-bar {
    background: $bg-card;
    padding: $spacing-lg;
    margin-bottom: $spacing-md;
    border-radius: $border-radius-md;
    border: 1px solid $border-color;

    .search-actions {
      margin-top: $spacing-md;
      text-align: right;
    }
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: $spacing-md 0;
    margin-bottom: $spacing-md;

    .toolbar-left,
    .toolbar-right {
      display: flex;
      gap: $spacing-md;
    }
  }

  .pagination {
    margin-top: $spacing-lg;
    display: flex;
    justify-content: flex-end;
  }
}
</style>

