<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
    :close-on-click-modal="false"
    @close="handleClose"
  >
    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      :label-width="labelWidth"
    >
      <slot :form-data="formData"></slot>
    </el-form>

    <template #footer>
      <el-button @click="handleCancel">取消</el-button>
      <el-button type="primary" :loading="loading" @click="handleConfirm">
        确定
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus'

interface Props {
  modelValue: boolean
  title: string
  formData: any
  rules?: FormRules
  width?: string | number
  labelWidth?: string | number
  loading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: '600px',
  labelWidth: '100px',
  loading: false
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel', 'close'])

const formRef = ref<FormInstance>()

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const handleConfirm = async () => {
  if (!formRef.value) return
  
  await formRef.value.validate((valid) => {
    if (valid) {
      emit('confirm', props.formData)
    }
  })
}

const handleCancel = () => {
  visible.value = false
  emit('cancel')
}

const handleClose = () => {
  formRef.value?.resetFields()
  emit('close')
}

defineExpose({
  formRef
})
</script>

