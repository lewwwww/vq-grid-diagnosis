<template>
  <div class="diagnosis-page">
    <el-card class="search-card">
      <el-form :model="searchForm" :inline="true" class="search-form">
        <el-form-item label="设备名称">
          <el-input v-model="searchForm.deviceName" placeholder="请输入设备名称" clearable />
        </el-form-item>
        <el-form-item label="故障类型">
          <el-select v-model="searchForm.faultType" placeholder="请选择故障类型" clearable>
            <el-option label="全部" :value="null" />
            <el-option label="单相接地故障" :value="1" />
            <el-option label="相间短路故障" :value="2" />
            <el-option label="三相短路故障" :value="3" />
            <el-option label="两相接地故障" :value="4" />
            <el-option label="三相接地短路" :value="5" />
          </el-select>
        </el-form-item>
        <el-form-item label="诊断时间">
          <el-date-picker
            v-model="searchForm.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="table-card">
      <template #header>
        <div class="card-header">
          <span>故障诊断记录</span>
          <div>
            <el-button type="info" @click="handleDownloadTemplate" plain>
              <el-icon><Download /></el-icon>
              下载导入模板
            </el-button>
            <el-upload
              ref="uploadRef"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="handleDataImport"
              accept=".csv"
              style="display: inline-block; margin: 0 10px;"
            >
              <el-button type="warning" :loading="importing">
                <el-icon><Upload /></el-icon>
                导入数据并诊断
              </el-button>
            </el-upload>
            <el-button type="success" @click="handleBatchDiagnose" :loading="batchDiagnosing">
              <el-icon><Refresh /></el-icon>
              批量诊断
            </el-button>
            <el-button type="primary" @click="handleDiagnose">
              <el-icon><Plus /></el-icon>
              新建诊断
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="tableData" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="deviceName" label="设备名称" width="130" />
        <el-table-column prop="substation" label="所属变电站" width="150" />
        <el-table-column prop="deviceCode" label="设备编号" width="150" />
        <el-table-column prop="faultType" label="故障类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getFaultTypeTag(row.faultType)">
              {{ getFaultTypeName(row.faultType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="confidence" label="置信度" width="100">
          <template #default="{ row }">
            <el-progress
              :percentage="row.confidence"
              :color="getConfidenceColor(row.confidence)"
              :stroke-width="8"
            />
          </template>
        </el-table-column>
        <el-table-column prop="nodeIds" label="量化索引" width="140">
          <template #default="{ row }">
            <el-tag v-for="(code, index) in (row.nodeIds || [])" :key="index" size="small" class="code-tag">
              {{ code }}
            </el-tag>
            <span v-if="!row.nodeIds || row.nodeIds.length === 0" style="color:#909399;">暂无</span>
          </template>
        </el-table-column>
        <el-table-column prop="diagnosisTime" label="诊断时间" width="180" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'warning'">
              {{ row.status === 1 ? '已处理' : '待处理' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="handleView(row)">查看详情</el-button>
            <el-button link type="success" @click="handleExport(row)">导出报告</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.size"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
        class="pagination"
      />
    </el-card>

    <!-- 诊断详情对话框 -->
    <el-dialog v-model="detailVisible" title="故障诊断详情" width="900px">
      <div v-if="currentRecord" class="detail-content">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备名称">{{ currentRecord.deviceName }}</el-descriptions-item>
          <el-descriptions-item label="设备编号">{{ currentRecord.deviceCode }}</el-descriptions-item>
          <el-descriptions-item label="故障类型">
            <el-tag :type="getFaultTypeTag(currentRecord.faultType)">
              {{ getFaultTypeName(currentRecord.faultType) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="置信度">{{ currentRecord.confidence }}%</el-descriptions-item>
          <el-descriptions-item label="诊断时间">{{ currentRecord.diagnosisTime }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="currentRecord.status === 1 ? 'success' : 'warning'">
              {{ currentRecord.status === 1 ? '已处理' : '待处理' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">量化表示</el-divider>

        <el-alert
          title="量化表示说明"
          type="info"
          :closable="false"
          style="margin-bottom: 16px"
        >
          <p style="margin: 0; line-height: 1.8;">
            <strong>量化原理：</strong>编码器先将6维输入压缩为连续表示，再由VQ层输出1个离散索引（0-15）。<br/>
            页面展示该索引及其对应的码字语义，帮助运维人员理解模型判断依据。
          </p>
        </el-alert>

        <div class="node-ids-section">
          <div class="code-list">
            <div v-for="(code, index) in currentRecord.nodeIds" :key="index" class="code-item">
              <span class="code-label">量化索引{{ index + 1 }}（码字 {{ code }}）：</span>
              <span class="code-value">{{ code }}</span>
              <span class="code-status" :class="getCodeStatusClass(code)">
                {{ getCodeStatusFromMap(code) }}
              </span>
              <div class="code-desc" style="font-size:12px;color:#A8B2C1;margin-top:4px;padding-left:4px;">
                {{ getCodeDesc(code) }}
              </div>
              <el-progress
                :percentage="(code / 15) * 100"
                :show-text="false"
                :stroke-width="6"
                :color="getProgressColorFromMap(code)"
              />
            </div>
          </div>
          <div v-if="codebookSummary" class="codebook-summary" style="margin-top:16px;padding:12px;background:#1A2535;border-radius:8px;border-left:4px solid #00D4FF;">
            <div style="color:#00D4FF;font-weight:600;margin-bottom:6px;">【模型判断依据】</div>
            <div style="color:#C0D0E0;font-size:13px;line-height:1.7;">{{ codebookSummary }}</div>
          </div>
        </div>

        <el-divider content-position="left">诊断说明</el-divider>
        <el-alert
          :title="getDiagnosisDescription(currentRecord.faultType)"
          type="info"
          :closable="false"
          show-icon
        />
      </div>
    </el-dialog>

    <!-- 新建诊断对话框（离线数据回放） -->
    <el-dialog v-model="diagnoseDialogVisible" title="新建故障诊断（离线数据回放）" width="680px" :close-on-click-modal="false">

      <!-- 步骤条 -->
      <el-steps :active="diagnoseStep" finish-status="success" style="margin-bottom: 24px;">
        <el-step title="选择设备" />
        <el-step title="读取测试数据" />
        <el-step title="模型推理" />
      </el-steps>

      <!-- Step 0: 选择设备 + 选择样本 -->
      <div v-if="diagnoseStep === 0">
        <el-form label-width="110px">
          <el-form-item label="绑定设备">
            <el-select v-model="selectedDeviceId" placeholder="请选择要绑定的设备" filterable style="width: 100%">
              <el-option v-for="d in deviceOptions" :key="d.id" :label="`${d.deviceName} (${d.deviceCode})`" :value="d.id" />
            </el-select>
            <div style="color:#909399;font-size:12px;margin-top:4px;">设备仅用于记录归属，不影响诊断结果</div>
          </el-form-item>
          <el-form-item label="测试数据来源">
            <el-tag type="success">Kaggle 电网故障数据集（测试集）</el-tag>
            <div style="color:#909399;font-size:12px;margin-top:4px;">系统从测试集读取历史录波数据，不暴露真实标签，由模型独立预测</div>
          </el-form-item>
          <el-form-item label="选择样本">
            <el-select v-model="selectedSampleIdx" placeholder="请选择一条测试集样本" filterable style="width: 100%"
              :loading="samplesLoading" @visible-change="(v: boolean) => v && loadSamples()">
              <el-option
                v-for="(s, i) in sampleOptions"
                :key="i"
                :value="i"
                :label="`第${s.rowIndex}行 — 编号${i+1}`"
              >
                <span style="float:left">第 {{ s.rowIndex }} 行（共{{ sampleOptions.length }}条）</span>
                <span style="float:right;color:#909399;font-size:12px;">
                  Ia={{ s.Ia.toFixed(1) }}  Va={{ s.Va.toFixed(3) }}
                </span>
              </el-option>
            </el-select>
            <el-button size="small" style="margin-top:6px;" @click="pickRandomSample">随机抽取一条</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- Step 1: 展示输入特征 -->
      <div v-if="diagnoseStep === 1">
        <el-alert title="已读取测试集录波数据，以下为输入模型的6维原始特征（未归一化）" type="info" :closable="false" style="margin-bottom:16px;" />
        <el-descriptions :column="2" border>
          <el-descriptions-item label="A相电流 Ia (A)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Ia?.toFixed(4) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="A相电压 Va (pu)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Va?.toFixed(6) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="B相电流 Ib (A)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Ib?.toFixed(4) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="B相电压 Vb (pu)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Vb?.toFixed(6) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="C相电流 Ic (A)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Ic?.toFixed(4) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="C相电压 Vc (pu)">
            <span style="font-family:monospace;font-weight:600;color:#00D4FF">{{ selectedSample?.Vc?.toFixed(6) }}</span>
          </el-descriptions-item>
        </el-descriptions>
        <div style="margin-top:16px;padding:12px;background:#1a2332;border-radius:6px;font-size:13px;color:#909399;">
          <strong style="color:#e0e0e0;">处理流程：</strong>
          原始特征（6维）→ Z-score 归一化（与训练阶段一致）→ 编码器（MLP压缩）→ 向量量化层（VQ，16码字）→ 分类器 → 故障类型 + 置信度
        </div>
      </div>

      <!-- Step 2: 推理中 / 结果 -->
      <div v-if="diagnoseStep === 2" style="text-align:center;padding:20px 0;">
        <div v-if="diagnoseLoading">
          <el-icon class="is-loading" style="font-size:48px;color:#00D4FF;"><Loading /></el-icon>
          <p style="margin-top:12px;color:#909399;">正在进行 Z-score 归一化 → VQ 编码 → 故障分类...</p>
        </div>
        <div v-else-if="diagnoseResult">
          <el-result
            :icon="diagnoseResult.faultType === 0 ? 'success' : 'warning'"
            :title="diagnoseResult.faultTypeName"
            :sub-title="`置信度 ${diagnoseResult.confidence}%  |  推理耗时 ${diagnoseResult.inferenceTime} ms`"
          />
          <el-tag size="large" :type="diagnoseResult.faultType === 0 ? 'success' : 'danger'" style="font-size:14px;">
            VQ-MLP 预测结果：{{ diagnoseResult.faultTypeName }}
          </el-tag>

          <!-- 故障处置建议（知识库增强问答） -->
          <div v-loading="qaLoading" style="margin-top:20px;text-align:left;">
            <template v-if="qaResult">
              <div style="padding:14px 16px;background:#1A2535;border-radius:8px;border-left:4px solid #00D4FF;">
                <div style="color:#00D4FF;font-weight:600;margin-bottom:6px;">【故障处置建议】{{ qaResult.fault_type_name }}</div>
                <div style="color:#C0D0E0;font-size:13px;line-height:1.8;">{{ qaResult.explanation }}</div>
              </div>
              <div style="margin-top:12px;padding:14px 16px;background:#1A2535;border-radius:8px;">
                <div style="color:#00D4FF;font-weight:600;margin-bottom:8px;">处置步骤</div>
                <ol style="margin:0;padding-left:20px;color:#C0D0E0;font-size:13px;line-height:2;">
                  <li v-for="(act, idx) in qaResult.actions" :key="idx">{{ act }}</li>
                </ol>
                <div v-if="qaResult.sources && qaResult.sources.length" style="margin-top:10px;font-size:12px;color:#7A8BA3;">
                  资料来源：<span v-for="(s, idx) in qaResult.sources" :key="idx">{{ s }}{{ idx < qaResult.sources.length - 1 ? '；' : '' }}</span>
                </div>
                <el-tag v-if="qaResult.fallback" type="warning" size="small" effect="dark" style="margin-top:10px;">降级：未命中专用条目，展示通用处置建议</el-tag>
              </div>
            </template>
            <el-empty v-else-if="!qaLoading" description="未获取到处置建议" :image-size="60" />
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="closeDiagnoseDialog">取消</el-button>
        <el-button v-if="diagnoseStep > 0 && !diagnoseResult" @click="diagnoseStep--">上一步</el-button>
        <el-button v-if="diagnoseStep === 0" type="primary" :disabled="!selectedDeviceId || selectedSampleIdx === null" @click="goToStep1">下一步：查看输入特征</el-button>
        <el-button v-if="diagnoseStep === 1" type="primary" @click="submitDiagnose">提交诊断</el-button>
        <el-button v-if="diagnoseStep === 2 && diagnoseResult" type="success" @click="closeDiagnoseDialog">完成</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="batchDialogVisible" title="批量诊断数据集配置" width="980px" :close-on-click-modal="false">
      <el-alert
        title="当前批量诊断会将所选数据集样本按顺序分配给设备；如果样本数少于设备数，会自动循环复用。"
        type="info"
        :closable="false"
        style="margin-bottom: 16px;"
      />

      <el-descriptions v-if="batchDatasetInfo" :column="2" border style="margin-bottom: 16px;">
        <el-descriptions-item label="数据集文件">{{ batchDatasetInfo.fileName }}</el-descriptions-item>
        <el-descriptions-item label="文件路径">{{ batchDatasetInfo.filePath }}</el-descriptions-item>
        <el-descriptions-item label="总数据行数">{{ batchDatasetInfo.totalRows }}</el-descriptions-item>
        <el-descriptions-item label="推荐抽样条数">{{ batchDatasetInfo.recommendedSampleCount }}</el-descriptions-item>
      </el-descriptions>

      <el-form :model="batchForm" label-width="130px">
        <el-form-item label="诊断数据范围">
          <el-radio-group v-model="batchForm.mode">
            <el-radio-button label="sampled">推荐抽样 60 条</el-radio-button>
            <el-radio-button label="all">全量数据集 7861 条</el-radio-button>
            <el-radio-button label="range">自定义行号范围</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <template v-if="batchForm.mode === 'range'">
          <el-form-item label="起始行号">
            <el-input-number v-model="batchForm.startRow" :min="1" :max="batchDatasetInfo?.totalRows || 7861" />
          </el-form-item>
          <el-form-item label="诊断条数">
            <el-input-number v-model="batchForm.rowCount" :min="1" :max="batchDatasetInfo?.totalRows || 7861" />
          </el-form-item>
        </template>
      </el-form>

      <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 0 10px;">
        <div style="font-weight:600;">`classData.csv` 数据预览</div>
        <div style="color:#909399;font-size:12px;">
          管理员可先查看真实数据，再决定用推荐抽样、全量数据集或自定义范围
        </div>
      </div>

      <el-table :data="batchDatasetRows" v-loading="batchDatasetLoading" stripe max-height="360">
        <el-table-column prop="rowIndex" label="行号" width="90" />
        <el-table-column prop="Ia" label="Ia" min-width="130">
          <template #default="{ row }">{{ row.Ia.toFixed(4) }}</template>
        </el-table-column>
        <el-table-column prop="Ib" label="Ib" min-width="130">
          <template #default="{ row }">{{ row.Ib.toFixed(4) }}</template>
        </el-table-column>
        <el-table-column prop="Ic" label="Ic" min-width="130">
          <template #default="{ row }">{{ row.Ic.toFixed(4) }}</template>
        </el-table-column>
        <el-table-column prop="Va" label="Va" min-width="120">
          <template #default="{ row }">{{ row.Va.toFixed(6) }}</template>
        </el-table-column>
        <el-table-column prop="Vb" label="Vb" min-width="120">
          <template #default="{ row }">{{ row.Vb.toFixed(6) }}</template>
        </el-table-column>
        <el-table-column prop="Vc" label="Vc" min-width="120">
          <template #default="{ row }">{{ row.Vc.toFixed(6) }}</template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="batchDatasetPagination.page"
        v-model:page-size="batchDatasetPagination.size"
        :total="batchDatasetPagination.total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end;"
        @size-change="handleBatchDatasetPageChange"
        @current-change="handleBatchDatasetPageChange"
      />

      <template #footer>
        <el-button @click="batchDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="batchDiagnosing" @click="submitBatchDiagnose">开始批量诊断</el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { Plus, Refresh, Upload, Download, Loading } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'

// 搜索表单
const searchForm = reactive({
  deviceName: '',
  faultType: null,
  dateRange: []
})

// 表格数据
const tableData = ref([])
const loading = ref(false)

// 分页
const pagination = reactive({
  page: 1,
  size: 10,
  total: 0
})

// 详情对话框
const detailVisible = ref(false)
const currentRecord = ref(null)

// 新建诊断对话框（离线数据回放）
const diagnoseDialogVisible = ref(false)
const diagnoseStep = ref(0)  // 0=选择设备+样本, 1=展示输入特征, 2=推理结果
const selectedDeviceId = ref(null)
const diagnoseLoading = ref(false)
const diagnoseResult = ref(null)
// 知识库问答（故障处置建议）
const qaResult = ref(null)
const qaLoading = ref(false)
const batchDiagnosing = ref(false)
const batchDialogVisible = ref(false)
const importing = ref(false)
const uploadRef = ref()
const deviceOptions = ref([])

// 测试集样本选择
const sampleOptions = ref([])
const selectedSampleIdx = ref(null)
const selectedSample = ref(null)
const samplesLoading = ref(false)
const batchDatasetLoading = ref(false)
const batchDatasetInfo = ref(null)
const batchDatasetRows = ref([])
const batchDatasetPagination = reactive({
  page: 1,
  size: 10,
  total: 0
})
const batchForm = reactive({
  mode: 'sampled',
  startRow: 1,
  rowCount: 200
})

// 码本映射表（真实数据驱动）
const codebookMap = ref<Record<string, any>>({})
const codebookSummary = ref('')

const loadCodebookMap = async () => {
  if (Object.keys(codebookMap.value).length > 0) return
  try {
    const data = await $fetch('/api/v1/diagnosis/codebook-map')
    codebookMap.value = data as Record<string, any>
  } catch (error) {
    console.error('加载码本映射失败:', error)
    ElMessage.error('加载码本语义失败，请检查码本映射文件')
  }
}

// 根据码字获取物理语义描述
const getCodeDesc = (code: number): string => {
  const entry = codebookMap.value[String(code)]
  if (!entry || entry.count === 0) return '该码字暂无训练集统计数据'
  const faultInfo = entry.dominant_fault !== '无'
    ? `训练集中${(entry.dominant_ratio * 100).toFixed(0)}%属于"${entry.dominant_fault}"`
    : ''
  return [entry.desc, faultInfo].filter(Boolean).join('；')
}

// 根据码字的主导故障类型决定状态标签
const getCodeStatusFromMap = (code: number): string => {
  const entry = codebookMap.value[String(code)]
  if (!entry || entry.count === 0) return '未知'
  if (entry.dominant_fault === '正常') return '正常'
  if (entry.dominant_ratio >= 0.7) return '故障特征'
  return '混合状态'
}

// 根据主导故障决定颜色
const getProgressColorFromMap = (code: number): string => {
  const entry = codebookMap.value[String(code)]
  if (!entry || entry.count === 0) return '#909399'
  if (entry.dominant_fault === '正常') return '#00E676'
  if (entry.dominant_ratio >= 0.7) return '#FF3D71'
  return '#FFB300'
}

// 基于码本生成综合诊断解释
const buildCodebookSummary = (nodeIds: number[], faultType: number): string => {
  const faultNames = ['正常', '单相接地', '相间短路', '三相短路', '两相接地', '三相接地短路']
  const faultName = faultNames[faultType] ?? '未知'
  const supports: string[] = []
  const conflicts: string[] = []

  for (const code of nodeIds) {
    const entry = codebookMap.value[String(code)]
    if (!entry || entry.count === 0) continue

    const item = `码字${code}（${entry.desc.slice(0, 20)}，${(entry.dominant_ratio * 100).toFixed(0)}%对应${entry.dominant_fault}）`

    if (entry.dominant_fault === faultName && entry.dominant_ratio >= 0.5) {
      supports.push(item)
    } else if (entry.dominant_fault !== '无' && entry.dominant_fault !== faultName && entry.dominant_ratio >= 0.5) {
      conflicts.push(item)
    }
  }

  if (supports.length > 0) {
    return `模型主要依据以下编码特征判断为"${faultName}"：${supports.join('；')}。`
  }

  if (conflicts.length > 0) {
    return `当前分类结果为"${faultName}"，但主要码字语义更接近：${conflicts.join('；')}。这说明该样本在码本层面的可解释特征与最终分类结果存在一定偏差。`
  }

  return `当前分类结果为"${faultName}"。现有码字语义未提供足够强的一致性证据，请结合置信度与原始特征综合判断。`
}

const loadDeviceList = async () => {
  try {
    const res = await $fetch('/api/v1/device/page?page=1&size=200')
    deviceOptions.value = res.data.records
  } catch { }
}

// 加载测试集样本
const loadSamples = async () => {
  if (sampleOptions.value.length > 0) return
  samplesLoading.value = true
  try {
    const res = await $fetch('/api/v1/diagnosis/samples')
    sampleOptions.value = res.data || []
  } catch (e) {
    ElMessage.error('加载测试集样本失败')
  } finally {
    samplesLoading.value = false
  }
}

const loadBatchDataset = async () => {
  batchDatasetLoading.value = true
  try {
    const res = await $fetch(`/api/v1/diagnosis/dataset?page=${batchDatasetPagination.page}&size=${batchDatasetPagination.size}`)
    batchDatasetInfo.value = res.data
    batchDatasetRows.value = res.data?.records || []
    batchDatasetPagination.total = res.data?.availableRows || 0
    if (res.data?.totalRows) {
      batchForm.rowCount = Math.min(batchForm.rowCount, res.data.totalRows)
    }
  } catch (error) {
    ElMessage.error('加载数据集预览失败')
  } finally {
    batchDatasetLoading.value = false
  }
}

const handleBatchDatasetPageChange = () => {
  loadBatchDataset()
}

// 随机抽取样本
const pickRandomSample = () => {
  if (sampleOptions.value.length === 0) return
  selectedSampleIdx.value = Math.floor(Math.random() * sampleOptions.value.length)
}

// 进入步骤1：展示输入特征
const goToStep1 = () => {
  if (selectedSampleIdx.value === null) {
    ElMessage.warning('请选择一条测试集样本')
    return
  }
  selectedSample.value = sampleOptions.value[selectedSampleIdx.value]
  diagnoseStep.value = 1
}

// 获取故障处置建议（知识库增强问答）
const loadKnowledge = async (faultType: number) => {
  qaResult.value = null
  qaLoading.value = true
  try {
    const res = await $fetch('/api/v1/qa', {
      method: 'POST',
      body: { faultType }
    })
    qaResult.value = res.data
  } catch (e: any) {
    console.error('加载处置建议失败:', e)
    qaResult.value = null
  } finally {
    qaLoading.value = false
  }
}

// 提交诊断
const submitDiagnose = async () => {
  if (!selectedDeviceId.value || !selectedSample.value) {
    ElMessage.warning('请完成设备和样本选择')
    return
  }
  diagnoseStep.value = 2
  diagnoseLoading.value = true
  diagnoseResult.value = null
  try {
    const features = [
      selectedSample.value.Ia,
      selectedSample.value.Ib,
      selectedSample.value.Ic,
      selectedSample.value.Va,
      selectedSample.value.Vb,
      selectedSample.value.Vc
    ]
    const res = await $fetch('/api/v1/diagnosis', {
      method: 'POST',
      body: {
        deviceId: selectedDeviceId.value,
        features,
        sampleRowIndex: selectedSample.value.rowIndex
      }
    })
    diagnoseResult.value = res.data
    // 拉取该故障类型的处置建议（知识库增强问答）
    loadKnowledge(res.data.faultType)
    ElMessage.success(`诊断完成：${res.data.faultTypeName}，置信度${res.data.confidence}%`)
    loadData()
  } catch (e: any) {
    ElMessage.error(e.data?.message || '诊断失败')
    diagnoseStep.value = 1
  } finally {
    diagnoseLoading.value = false
  }
}

// 关闭诊断对话框
const closeDiagnoseDialog = () => {
  diagnoseDialogVisible.value = false
  diagnoseStep.value = 0
  selectedDeviceId.value = null
  selectedSampleIdx.value = null
  selectedSample.value = null
  diagnoseResult.value = null
  qaResult.value = null
}

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    const params = new URLSearchParams({
      page: String(pagination.page),
      size: String(pagination.size),
    })
    if (searchForm.deviceName) params.set('deviceName', searchForm.deviceName)
    if (searchForm.faultType) params.set('faultType', String(searchForm.faultType))

    // 处理日期范围
    if (searchForm.dateRange && searchForm.dateRange.length === 2) {
      const [startDate, endDate] = searchForm.dateRange
      // 格式化为 YYYY-MM-DD
      const formatDate = (date) => {
        const d = new Date(date)
        const year = d.getFullYear()
        const month = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
      }
      params.set('startDate', formatDate(startDate))
      params.set('endDate', formatDate(endDate))
    }

    const res = await $fetch(`/api/v1/diagnosis/page?${params}`)
    tableData.value = res.data.records
    pagination.total = res.data.total
  } catch (error) {
    ElMessage.error('加载数据失败')
  } finally {
    loading.value = false
  }
}

// 查询
const handleSearch = () => {
  pagination.page = 1
  loadData()
}

const handleSizeChange = () => {
  pagination.page = 1
  loadData()
}

const handleCurrentChange = () => {
  loadData()
}

// 重置
const handleReset = () => {
  searchForm.deviceName = ''
  searchForm.faultType = null
  searchForm.dateRange = []
  handleSearch()
}

// 新建诊断
const handleDiagnose = () => {
  diagnoseDialogVisible.value = true
  diagnoseStep.value = 0
  loadDeviceList()
  loadSamples()
}

// 下载导入模板
const handleDownloadTemplate = () => {
  // 创建 CSV 模板内容
  const template = [
    ['device_id', 'voltage', 'current', 'power', 'temperature', 'load_rate'],
    ['1', '220.5', '105.2', '1050', '48.5', '0.78'],
    ['2', '218.3', '98.7', '980', '45.2', '0.72'],
    ['3', '222.1', '112.5', '1125', '52.3', '0.85']
  ]

  const csvContent = template.map(row => row.join(',')).join('\n')

  // 创建 Blob 并下载
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = '设备运行数据导入模板.csv'
  link.click()
  URL.revokeObjectURL(url)

  ElMessage.success('模板下载成功！请填写设备运行数据后导入')
}

// 批量诊断
const handleBatchDiagnose = async () => {
  batchDialogVisible.value = true
  if (!batchDatasetInfo.value) {
    await loadBatchDataset()
  }
}

const submitBatchDiagnose = async () => {
  try {
    batchDiagnosing.value = true

    const res = await $fetch('/api/v1/diagnosis/batch', {
      method: 'POST',
      body: {
        mode: batchForm.mode,
        startRow: batchForm.startRow,
        rowCount: batchForm.rowCount
      }
    })

    batchDiagnosing.value = false
    batchDialogVisible.value = false

    const stats = Object.entries(res.data?.faultTypeStats || {})
      .map(([name, count]) => `${name}${count}个`)
      .join('，')
    const samplePreview = (res.data?.sampleRowsPreview || []).slice(0, 6).join('、')
    const modeText = res.data?.mode === 'all'
      ? '全量数据集'
      : res.data?.mode === 'range'
        ? `自定义范围（从第${batchForm.startRow}行起）`
        : '推荐抽样'

    ElMessage.success(
      `批量诊断完成！模式：${modeText}，实际使用样本 ${res.data?.sampleCount || 0} 条，成功 ${res.data?.success || 0} 个，失败 ${res.data?.fail || 0} 个${samplePreview ? `，样本行号示例：${samplePreview}` : ''}${stats ? `，结果分布：${stats}` : ''}`
    )

    loadData()
  } catch (error) {
    console.error('批量诊断失败:', error)
    ElMessage.error('批量诊断失败')
    batchDiagnosing.value = false
  }
}

// 数据导入并自动诊断
const handleDataImport = async (file: UploadFile) => {
  if (!file.raw) return

  const loading = ElLoading.service({ text: '正在导入数据并诊断...' })
  importing.value = true

  try {
    const formData = new FormData()
    formData.append('file', file.raw)

    const result = await $fetch('/api/v1/diagnosis/import', {
      method: 'POST',
      body: formData
    })

    loading.close()
    importing.value = false

    if (result.code === 200) {
      ElMessage.success(`数据导入完成！成功诊断 ${result.data.success} 个设备，失败 ${result.data.fail} 个`)

      // 显示诊断结果详情
      if (result.data.diagnosedDevices && result.data.diagnosedDevices.length > 0) {
        const faultDevices = result.data.diagnosedDevices.filter(d => d.faultType !== 0)
        if (faultDevices.length > 0) {
          ElMessageBox.alert(
            `检测到 ${faultDevices.length} 个设备存在故障，请及时处理！`,
            '诊断结果',
            { type: 'warning' }
          )
        }
      }

      // 刷新列表
      loadData()
    } else {
      ElMessage.error(result.message || '数据导入失败')
    }
  } catch (error: any) {
    loading.close()
    importing.value = false
    ElMessage.error(error.data?.message || '数据导入失败')
  }
}

// 查看详情
const handleView = async (row: any) => {
  await loadCodebookMap()
  currentRecord.value = {
    ...row,
    nodeIds: row.nodeIds ?? []
  }
  codebookSummary.value = buildCodebookSummary(row.nodeIds ?? [], row.faultType)
  detailVisible.value = true
}

// 导出报告
const handleExport = (row: any) => {
  const nodeIds = Array.isArray(row.nodeIds) ? row.nodeIds : []
  const diagnosisTime = typeof row.diagnosisTime === 'string' && row.diagnosisTime
    ? row.diagnosisTime
    : new Date().toLocaleString('zh-CN').replace(/\//g, '-')
  const safeDeviceName = (row.deviceName || '未知设备').replace(/[\\/:*?"<>|]/g, '_')

  // 构造诊断报告数据
  const reportData = {
    device_id: row.deviceId,
    device_name: row.deviceName,
    device_code: row.deviceCode,
    timestamp: diagnosisTime,
    fault_type: getFaultTypeName(row.faultType),
    confidence: row.confidence / 100,
    risk_level: row.faultLevel === 3 ? '高风险' : row.faultLevel === 2 ? '中风险' : '低风险',
    node_ids: nodeIds,
    description: row.description
  }

  // 生成 HTML 报告
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>故障诊断报告</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 40px; background: #f5f5f5; }
    .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.1); }
    h1 { color: #409EFF; border-bottom: 3px solid #409EFF; padding-bottom: 10px; }
    h2 { color: #606266; margin-top: 30px; }
    .section { margin: 20px 0; }
    .info-row { display: flex; margin: 10px 0; }
    .label { font-weight: bold; color: #606266; width: 120px; }
    .value { color: #303133; flex: 1; }
    .highlight { color: #409EFF; font-weight: bold; font-size: 18px; }
    .risk-high { color: #F56C6C; }
    .risk-medium { color: #E6A23C; }
    .risk-low { color: #67C23A; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #EBEEF5; padding: 12px; text-align: center; }
    th { background-color: #409EFF; color: white; font-weight: bold; }
    td { background-color: #F5F7FA; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #DCDFE6; color: #909399; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 智能电网故障诊断报告</h1>

    <div class="section">
      <h2>基本信息</h2>
      <div class="info-row">
        <span class="label">设备名称:</span>
        <span class="value">${reportData.device_name}</span>
      </div>
      <div class="info-row">
        <span class="label">设备编号:</span>
        <span class="value">${reportData.device_code}</span>
      </div>
      <div class="info-row">
        <span class="label">诊断时间:</span>
        <span class="value">${reportData.timestamp}</span>
      </div>
    </div>

    <div class="section">
      <h2>诊断结果</h2>
      <div class="info-row">
        <span class="label">故障类型:</span>
        <span class="value highlight">${reportData.fault_type}</span>
      </div>
      <div class="info-row">
        <span class="label">置信度:</span>
        <span class="value highlight">${(reportData.confidence * 100).toFixed(1)}%</span>
      </div>
      <div class="info-row">
        <span class="label">风险等级:</span>
        <span class="value risk-${reportData.risk_level === '高风险' ? 'high' : reportData.risk_level === '中风险' ? 'medium' : 'low'}">${reportData.risk_level}</span>
      </div>
    </div>

    <div class="section">
      <h2>量化索引</h2>
      <p style="color: #909399; font-size: 14px;">当前模型对每个样本输出1个离散索引（范围 0-15）</p>
      ${reportData.node_ids.length > 0 ? `
      <table>
        <tr>
          <th>索引位置</th>
          ${reportData.node_ids.map((_: any, i: number) => `<th>索引 ${i + 1}</th>`).join('')}
        </tr>
        <tr>
          <td><strong>数值</strong></td>
          ${reportData.node_ids.map((val: number) => `<td><strong>${val}</strong></td>`).join('')}
        </tr>
      </table>
      ` : `
      <div style="padding: 12px 16px; background: #F5F7FA; border-radius: 6px; color: #909399;">
        该条历史诊断记录未保存量化索引数据，因此本次报告无法展示模型码字结果。
      </div>
      `}
    </div>

    <div class="section">
      <h2>诊断说明</h2>
      <p style="line-height: 1.8; color: #606266;">${reportData.description}</p>
      <p style="line-height: 1.8; color: #606266;">${getDiagnosisDescription(row.faultType)}</p>
    </div>

    <div class="section">
      <h2>技术说明</h2>
      <p style="line-height: 1.8; color: #909399; font-size: 14px;">
        本报告基于向量量化表示进行故障诊断。系统使用训练好的深度学习模型，
        对设备的三相电流和电压数据进行分析，输出1个量化索引，并基于对应码字语义完成故障分类。
      </p>
    </div>

    <div class="footer">
      <p>智能电网故障诊断系统 | 报告生成时间: ${new Date().toLocaleString('zh-CN')}</p>
      <p>本报告由系统自动生成，仅供参考</p>
    </div>
  </div>
</body>
</html>
  `

  // 下载 HTML 文件
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `故障诊断报告_${safeDeviceName}_${diagnosisTime.replace(/[:\s]/g, '-')}.html`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success(`已导出设备 ${row.deviceName} 的诊断报告`)
}

// 获取故障类型名称
const getFaultTypeName = (type: number) => {
  const names = ['正常', '单相接地故障', '相间短路故障', '三相短路故障', '两相接地故障', '三相接地短路']
  return names[type] || '未知'
}

// 获取故障类型标签
const getFaultTypeTag = (type: number) => {
  const tags = ['success', 'warning', 'danger', 'danger', 'danger', 'danger']
  return tags[type] || 'default'
}

// 获取置信度颜色
const getConfidenceColor = (confidence: number) => {
  if (confidence >= 90) return '#00E676'
  if (confidence >= 70) return '#FFB300'
  return '#FF3D71'
}

// 获取编码状态样式类（基于码本映射的主导故障）
const getCodeStatusClass = (code: number) => {
  const entry = codebookMap.value[String(code)]
  if (!entry || entry.count === 0) return 'status-normal'
  if (entry.dominant_fault === '正常') return 'status-normal'
  if (entry.dominant_ratio >= 0.7) return 'status-danger'
  return 'status-warning'
}

// 获取诊断说明
const getDiagnosisDescription = (type: number) => {
  const descriptions = [
    '设备运行正常，各项参数在正常范围内。',
    '检测到单相接地故障，建议检查A相接地系统，确保接地电阻符合标准，防止人身安全事故。',
    '检测到相间短路故障，建议立即检查BC相线路连接，排查短路点，避免设备损坏。',
    '检测到三相短路故障，建议立即断电检查，排查三相短路点，这是严重故障，可能导致设备损坏。',
    '检测到两相接地故障，建议检查AB相接地系统，这是严重故障，需要立即处理。',
    '检测到三相接地短路，这是最严重的故障，建议立即断电，全面检查电力系统，防止系统崩溃。'
  ]
  return descriptions[type] || '未知故障类型'
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.diagnosis-page {
  padding: 20px;
}

.search-card {
  margin-bottom: 20px;
}

.search-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 20px;

  :deep(.el-form-item) {
    margin-right: 0;
    margin-bottom: 0;
  }

  :deep(.el-input) {
    width: 220px;
  }

  :deep(.el-select),
  :deep(.el-select .el-input) {
    width: 180px;
  }

  :deep(.el-date-editor.el-input__wrapper),
  :deep(.el-date-editor.el-range-editor),
  :deep(.el-date-editor) {
    width: 360px;
  }
}

.table-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .code-tag {
    margin-right: 4px;
  }

  .pagination {
    margin-top: 20px;
    justify-content: flex-end;
  }
}

.detail-content {
  .node-ids-section {
    padding: 20px;
    background: $bg-secondary;
    border-radius: $border-radius-md;
    border: 1px solid $border-color;

    .code-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;

      .code-item {
        display: flex;
        align-items: center;
        gap: 12px;

        .code-label {
          font-weight: 500;
          min-width: 120px;
          color: $text-regular;
          font-size: 14px;
        }

        .code-value {
          font-size: 18px;
          font-weight: 600;
          color: $primary-color;
          min-width: 30px;
        }

        .code-status {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;

          &.status-normal {
            background: rgba(0, 230, 118, 0.1);
            color: #00E676;
          }

          &.status-warning {
            background: rgba(255, 179, 0, 0.1);
            color: #FFB300;
          }

          &.status-danger {
            background: rgba(255, 61, 113, 0.1);
            color: #FF3D71;
          }
        }

        .el-progress {
          flex: 1;
        }
      }
    }
  }


  .feature-chart {
    width: 100%;
    height: 300px;
  }
}

@media (max-width: 1200px) {
  .search-form {
    :deep(.el-input) {
      width: 200px;
    }

    :deep(.el-select),
    :deep(.el-select .el-input) {
      width: 160px;
    }

    :deep(.el-date-editor.el-input__wrapper),
    :deep(.el-date-editor.el-range-editor),
    :deep(.el-date-editor) {
      width: 320px;
    }
  }
}

@media (max-width: 768px) {
  .search-form {
    display: block;

    :deep(.el-form-item) {
      display: flex;
      margin-bottom: 12px;
    }

    :deep(.el-form-item__content),
    :deep(.el-input),
    :deep(.el-select),
    :deep(.el-select .el-input),
    :deep(.el-date-editor.el-input__wrapper),
    :deep(.el-date-editor.el-range-editor),
    :deep(.el-date-editor) {
      width: 100%;
    }
  }
}
</style>
