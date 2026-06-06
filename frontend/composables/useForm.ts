/**
 * 表单通用逻辑 - 可复用组合式函数
 */
import { ref, reactive } from 'vue'
import type { Ref } from 'vue'
import type { FormInstance } from 'element-plus'
import { ElMessage } from 'element-plus'

interface FormOptions<T> {
  initialData?: T
  onSubmit: (data: T) => Promise<any>
  onSuccess?: (response: any) => void
  onError?: (error: any) => void
}

export function useForm<T extends Record<string, any>>(options: FormOptions<T>) {
  const { initialData, onSubmit, onSuccess, onError } = options

  const formRef: Ref<FormInstance | undefined> = ref()
  const formData: T = reactive((initialData || {}) as T)
  const loading = ref(false)
  const dialogVisible = ref(false)

  /**
   * 打开表单
   */
  const openForm = (data?: Partial<T>) => {
    if (data) {
      Object.assign(formData, data)
    }
    dialogVisible.value = true
  }

  /**
   * 关闭表单
   */
  const closeForm = () => {
    dialogVisible.value = false
    resetForm()
  }

  /**
   * 重置表单
   */
  const resetForm = () => {
    formRef.value?.resetFields()
    if (initialData) {
      Object.assign(formData, initialData)
    }
  }

  /**
   * 提交表单
   */
  const submitForm = async () => {
    if (!formRef.value) return

    await formRef.value.validate(async (valid) => {
      if (!valid) return

      loading.value = true
      try {
        const response = await onSubmit(formData)
        ElMessage.success('操作成功')
        closeForm()
        onSuccess?.(response)
      } catch (error) {
        console.error('提交失败:', error)
        ElMessage.error('操作失败')
        onError?.(error)
      } finally {
        loading.value = false
      }
    })
  }

  return {
    formRef,
    formData,
    loading,
    dialogVisible,
    openForm,
    closeForm,
    resetForm,
    submitForm
  }
}

