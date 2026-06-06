<template>
  <div class="settings-page">
    <el-row :gutter="20">
      <!-- 左侧导航 -->
      <el-col :span="5">
        <el-card class="nav-card">
          <template #header>
            <div class="card-header">
              <el-icon><Setting /></el-icon>
              <span>系统设置</span>
            </div>
          </template>
          <el-menu :default-active="activeTab" @select="handleTabChange" class="settings-menu">
            <el-menu-item index="system">
              <el-icon><Tools /></el-icon>
              <span>系统参数</span>
            </el-menu-item>
            <el-menu-item index="users" v-if="userStore.userInfo?.roleCode === 'ADMIN'">
              <el-icon><User /></el-icon>
              <span>用户管理</span>
            </el-menu-item>
            <el-menu-item index="algorithm">
              <el-icon><DataAnalysis /></el-icon>
              <span>算法配置</span>
            </el-menu-item>
            <el-menu-item index="alert">
              <el-icon><Bell /></el-icon>
              <span>预警规则</span>
            </el-menu-item>
            <el-menu-item index="notification">
              <el-icon><Message /></el-icon>
              <span>通知设置</span>
            </el-menu-item>
            <el-menu-item index="logs">
              <el-icon><Document /></el-icon>
              <span>系统日志</span>
            </el-menu-item>
          </el-menu>
        </el-card>
      </el-col>

      <!-- 右侧内容 -->
      <el-col :span="19">
        <!-- 系统参数 -->
        <el-card v-show="activeTab === 'system'" class="content-card">
          <template #header>
            <div class="card-header">
              <span>系统参数配置</span>
              <el-tag type="info" size="small">基础设置</el-tag>
            </div>
          </template>
          <el-form :model="systemForm" label-width="180px" class="settings-form">
            <el-divider content-position="left">基本信息</el-divider>
            <el-form-item label="系统名称">
              <el-input v-model="systemForm.systemName" placeholder="请输入系统名称" style="width: 400px" />
            </el-form-item>

            <el-divider content-position="left">自动化功能</el-divider>
            <el-form-item label="自动故障诊断">
              <el-switch v-model="systemForm.autoDiagnosis" />
              <span class="form-tip">开启后每5分钟自动对异常设备进行诊断</span>
            </el-form-item>

            <el-divider content-position="left">数据库管理</el-divider>
            <el-form-item label="数据库统计">
              <el-space direction="vertical" :size="10" style="width: 100%">
                <el-descriptions :column="2" border size="small">
                  <el-descriptions-item label="故障记录">{{ dbStats.faults.total }} 条</el-descriptions-item>
                  <el-descriptions-item label="预警记录">{{ dbStats.alerts.total }} 条</el-descriptions-item>
                  <el-descriptions-item label="系统日志">{{ dbStats.logs.total }} 条</el-descriptions-item>
                  <el-descriptions-item label="总计">{{ dbStats.total }} 条</el-descriptions-item>
                </el-descriptions>
                <el-alert type="info" :closable="false">
                  <template #title>
                    系统每天凌晨 2 点自动清理旧数据（故障/预警保留 90 天，日志保留 30 天）
                  </template>
                </el-alert>
              </el-space>
            </el-form-item>
            <el-form-item label="手动清理">
              <el-button type="warning" @click="handleManualCleanup">
                <el-icon><Delete /></el-icon>
                立即清理旧数据
              </el-button>
              <span class="form-tip">清理 90 天前的故障/预警记录，30 天前的日志</span>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveSystem">
                <el-icon><Select /></el-icon>
                保存设置
              </el-button>
              <el-button @click="handleResetSystem">
                <el-icon><RefreshLeft /></el-icon>
                恢复默认
              </el-button>
              <el-button @click="loadDbStats">
                <el-icon><Refresh /></el-icon>
                刷新统计
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 用户管理 -->
        <el-card v-show="activeTab === 'users'" class="content-card" v-if="userStore.userInfo?.roleCode === 'ADMIN'">
          <template #header>
            <div class="card-header">
              <span>用户管理</span>
              <el-button type="primary" size="small" @click="handleAddUser">
                <el-icon><Plus /></el-icon>
                新增用户
              </el-button>
            </div>
          </template>

          <!-- 搜索栏 -->
          <el-form :inline="true" class="search-form" style="margin-bottom: 20px">
            <el-form-item label="用户名">
              <el-input v-model="userSearchForm.username" placeholder="请输入用户名" clearable style="width: 200px" />
            </el-form-item>
            <el-form-item label="角色">
              <el-select v-model="userSearchForm.roleCode" placeholder="请选择角色" clearable style="width: 150px">
                <el-option label="全部" value="" />
                <el-option label="系统管理员" value="ADMIN" />
                <el-option label="电网运维人员" value="OPERATOR" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="loadUsers">
                <el-icon><Search /></el-icon>
                查询
              </el-button>
              <el-button @click="resetUserSearch">
                <el-icon><RefreshLeft /></el-icon>
                重置
              </el-button>
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
                <el-button type="primary" size="small" @click="handleEditUser(row)">编辑</el-button>
                <el-button
                  type="danger"
                  size="small"
                  @click="handleDeleteUser(row)"
                  :disabled="row.username === 'admin'"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 算法配置 -->
        <el-card v-show="activeTab === 'algorithm'" class="content-card">
          <template #header>
            <div class="card-header">
              <span>算法参数配置</span>
              <el-tag type="warning" size="small">高级设置</el-tag>
            </div>
          </template>
          <el-alert type="info" :closable="false" style="margin-bottom: 20px">
            <template #title>
              当前页面展示系统部署所采用的算法参数，参数来源于离线训练与优化结果，仅供查看。
            </template>
          </el-alert>
          <el-form label-width="200px" class="settings-form">
            <el-divider content-position="left">Node IDs 离散表征参数</el-divider>
            <el-form-item label="隐藏层维度">
              <span>{{ algorithmConfig.hiddenDim }}</span>
            </el-form-item>
            <el-form-item label="压缩维度">
              <span>{{ algorithmConfig.compressDim }}</span>
            </el-form-item>
            <el-form-item label="GNN 层数">
              <span>{{ algorithmConfig.numGnnLayers }}</span>
            </el-form-item>
            <el-form-item label="Dropout 比率">
              <span>{{ algorithmConfig.dropout }}</span>
            </el-form-item>

            <el-divider content-position="left">训练参数</el-divider>
            <el-form-item label="学习率">
              <span>{{ algorithmConfig.learningRate }}</span>
            </el-form-item>
            <el-form-item label="批次大小">
              <span>{{ algorithmConfig.batchSize }}</span>
            </el-form-item>
            <el-form-item label="最大训练轮数">
              <span>{{ algorithmConfig.numEpochs }}</span>
            </el-form-item>
            <el-form-item label="早停耐心值">
              <span>{{ algorithmConfig.patience }}</span>
            </el-form-item>
          </el-form>

          <!-- 离线超参数优化结果展示 -->
          <el-divider content-position="left">离线超参数优化结果（只读）</el-divider>
          <el-alert type="info" :closable="false" style="margin-bottom: 20px">
            <template #title>
              以下结果由离线阶段运行 Optuna 脚本（algorithm/optimize_hyperparameters.py）得出，
              优化过程仅使用训练集和验证集，测试集严格隔离。系统部署时已加载最优参数训练好的模型，不支持在线重跑优化。
            </template>
          </el-alert>

          <el-form label-width="200px" class="settings-form">
            <!-- 只读展示优化结果 -->
            <el-form-item label="离线优化结果">
              <el-card shadow="never" style="width: 600px" v-if="optimizationResult">
                <el-descriptions :column="1" border size="small">
                  <el-descriptions-item label="优化试验次数">
                    {{ optimizationResult.n_trials }} 次（TPE采样器 + Median剪枝器）
                  </el-descriptions-item>
                  <el-descriptions-item label="最优验证集准确率">
                    <el-tag type="success">{{ optimizationResult.best_val_accuracy_pct ?? ((optimizationResult.best_value ?? 0) * 100).toFixed(2) }}%</el-tag>
                    <span style="margin-left:8px;font-size:12px;color:#909399">（仅使用验证集评估，测试集未参与）</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="最终测试集准确率" v-if="optimizationResult.final_test_accuracy_pct">
                    <el-tag type="primary">{{ optimizationResult.final_test_accuracy_pct }}%</el-tag>
                    <span style="margin-left:8px;font-size:12px;color:#909399">（测试集一次性独立评估）</span>
                  </el-descriptions-item>
                  <el-descriptions-item label="隐藏层维度">{{ optimizationResult.best_params.hidden_dim }}</el-descriptions-item>
                  <el-descriptions-item label="压缩维度">{{ optimizationResult.best_params.compressed_dim }}</el-descriptions-item>
                  <el-descriptions-item label="Dropout">{{ optimizationResult.best_params.dropout?.toFixed(3) }}</el-descriptions-item>
                  <el-descriptions-item label="学习率">{{ optimizationResult.best_params.learning_rate?.toFixed(4) }}</el-descriptions-item>
                  <el-descriptions-item label="权重衰减">{{ optimizationResult.best_params.weight_decay?.toFixed(6) }}</el-descriptions-item>
                  <el-descriptions-item label="批次大小">{{ optimizationResult.best_params.batch_size }}</el-descriptions-item>
                  <el-descriptions-item label="优化时间">{{ optimizationResult.optimization_date }}</el-descriptions-item>
                </el-descriptions>
              </el-card>
              <el-empty v-else description="暂无离线优化结果（请先运行 algorithm/optimize_hyperparameters.py）" />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 预警规则 -->
        <el-card v-show="activeTab === 'alert'" class="content-card">
          <template #header>
            <div class="card-header">
              <span>预警规则配置</span>
              <el-tag type="danger" size="small">重要</el-tag>
            </div>
          </template>
          <el-form :model="alertForm" label-width="180px" class="settings-form">
            <el-divider content-position="left">置信度阈值</el-divider>
            <el-form-item label="置信度阈值">
              <el-slider v-model="alertForm.confidenceThreshold" :min="50" :max="99" show-input style="width: 400px" />
              <span class="form-tip">%（推荐：80%，低于此值不触发预警）</span>
            </el-form-item>

            <el-divider content-position="left">预警级别规则</el-divider>
            <el-form-item label="一般预警条件">
              <el-checkbox-group v-model="alertForm.normalConditions">
                <el-checkbox label="单相接地" />
              </el-checkbox-group>
              <div class="form-tip">置信度 30-50%</div>
            </el-form-item>
            <el-form-item label="严重预警条件">
              <el-checkbox-group v-model="alertForm.seriousConditions">
                <el-checkbox label="相间短路" />
                <el-checkbox label="两相接地" />
              </el-checkbox-group>
              <div class="form-tip">置信度 50-80%</div>
            </el-form-item>
            <el-form-item label="紧急预警条件">
              <el-checkbox-group v-model="alertForm.urgentConditions">
                <el-checkbox label="三相短路" />
                <el-checkbox label="三相接地短路" />
              </el-checkbox-group>
              <div class="form-tip">置信度 > 80%</div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveAlert">
                <el-icon><Select /></el-icon>
                保存规则
              </el-button>
              <el-button @click="handleResetAlert">
                <el-icon><RefreshLeft /></el-icon>
                恢复默认
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 通知设置 -->
        <el-card v-show="activeTab === 'notification'" class="content-card">
          <template #header>
            <div class="card-header">
              <span>通知设置</span>
              <el-tag type="primary" size="small">消息推送</el-tag>
            </div>
          </template>
          <el-form :model="notifyForm" label-width="160px" class="settings-form">
            <el-form-item label="系统内通知">
              <el-switch v-model="notifyForm.systemNotify" />
              <span class="form-tip">在系统内显示预警通知消息</span>
            </el-form-item>

            <el-divider content-position="left">通知规则</el-divider>
            <el-form-item label="通知级别">
              <el-checkbox-group v-model="notifyForm.levels">
                <el-checkbox label="一般" />
                <el-checkbox label="严重" />
                <el-checkbox label="紧急" />
              </el-checkbox-group>
              <div class="form-tip">选择需要接收系统通知的预警级别</div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" @click="handleSaveNotify">
                <el-icon><Select /></el-icon>
                保存设置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 系统日志 -->
        <el-card v-show="activeTab === 'logs'" class="content-card">
          <template #header>
            <div class="card-header">
              <span>系统日志</span>
              <el-space>
                <el-select v-model="logLevel" placeholder="日志级别" style="width: 120px" @change="loadLogs">
                  <el-option label="全部" value="" />
                  <el-option label="INFO" value="INFO" />
                  <el-option label="WARNING" value="WARNING" />
                  <el-option label="ERROR" value="ERROR" />
                </el-select>
                <el-button @click="loadLogs">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
                <el-button @click="handleClearLogs" type="danger">
                  <el-icon><Delete /></el-icon>
                  清空日志
                </el-button>
              </el-space>
            </div>
          </template>
          <el-table :data="logs" stripe max-height="600">
            <el-table-column prop="id" label="ID" width="80" />
            <el-table-column label="级别" width="100">
              <template #default="{ row }">
                <el-tag :type="logLevelType(row.level)">{{ row.level }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="module" label="模块" width="150" />
            <el-table-column prop="message" label="消息" min-width="300" show-overflow-tooltip />
            <el-table-column prop="timestamp" label="时间" width="180" />
          </el-table>
          <el-pagination
            v-model:current-page="logPagination.page"
            v-model:page-size="logPagination.pageSize"
            :total="logPagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadLogs"
            @size-change="loadLogs"
            style="margin-top: 20px; justify-content: center"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- 用户管理对话框 -->
    <el-dialog
      v-model="userDialogVisible"
      :title="isEditUser ? '编辑用户' : '新增用户'"
      width="600px"
    >
      <el-form :model="userForm" :rules="userFormRules" ref="userFormRef" label-width="100px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="userForm.username" :disabled="isEditUser" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="userForm.password" type="password" show-password />
          <span v-if="isEditUser" style="color: #909399; font-size: 12px">留空则不修改密码</span>
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
        <el-button @click="userDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmitUser">确定</el-button>
      </template>
    </el-dialog>

    <!-- 模型评估报告对话框 -->
    <el-dialog
      v-model="evaluationDialogVisible"
      title="模型训练评估报告"
      width="900px"
      :close-on-click-modal="false"
    >
      <div v-if="evaluationReport" class="evaluation-report">
        <!-- 性能指标 -->
        <el-card class="metrics-card" shadow="never">
          <template #header>
            <div class="card-header">
              <el-icon><TrendCharts /></el-icon>
              <span>性能指标</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="6">
              <div class="metric-item">
                <div class="metric-label">准确率</div>
                <div class="metric-value" :class="getMetricClass(evaluationReport.performance_metrics.accuracy)">
                  {{ (evaluationReport.performance_metrics.accuracy * 100).toFixed(2) }}%
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <div class="metric-label">精确率</div>
                <div class="metric-value">
                  {{ (evaluationReport.performance_metrics.precision * 100).toFixed(2) }}%
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <div class="metric-label">召回率</div>
                <div class="metric-value">
                  {{ (evaluationReport.performance_metrics.recall * 100).toFixed(2) }}%
                </div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="metric-item">
                <div class="metric-label">F1分数</div>
                <div class="metric-value">
                  {{ (evaluationReport.performance_metrics.f1_score * 100).toFixed(2) }}%
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 实用性指标 -->
        <el-card class="metrics-card" shadow="never" style="margin-top: 15px">
          <template #header>
            <div class="card-header">
              <el-icon><Cpu /></el-icon>
              <span>实用性指标</span>
            </div>
          </template>
          <el-row :gutter="20">
            <el-col :span="12">
              <div class="metric-item">
                <div class="metric-label">推理时间</div>
                <div class="metric-value">
                  {{ evaluationReport.practical_metrics.inference_time_ms.toFixed(2) }} ms/样本
                </div>
              </div>
            </el-col>
            <el-col :span="12">
              <div class="metric-item">
                <div class="metric-label">模型大小</div>
                <div class="metric-value">
                  {{ evaluationReport.practical_metrics.model_size_mb }} MB
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>

        <!-- 训练配置 -->
        <el-card class="metrics-card" shadow="never" style="margin-top: 15px">
          <template #header>
            <div class="card-header">
              <el-icon><Setting /></el-icon>
              <span>训练配置</span>
            </div>
          </template>
          <el-descriptions :column="2" border>
            <el-descriptions-item label="学习率">{{ evaluationReport.training_config.learning_rate }}</el-descriptions-item>
            <el-descriptions-item label="批次大小">{{ evaluationReport.training_config.batch_size }}</el-descriptions-item>
            <el-descriptions-item label="最大训练轮数">{{ evaluationReport.training_config.num_epochs }}</el-descriptions-item>
            <el-descriptions-item label="早停耐心值">{{ evaluationReport.training_config.patience }}</el-descriptions-item>
            <el-descriptions-item label="数据划分" :span="2">
              训练集 {{ evaluationReport.training_config.data_split.train }} /
              验证集 {{ evaluationReport.training_config.data_split.validation }} /
              测试集 {{ evaluationReport.training_config.data_split.test }}
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <!-- 评估建议 -->
        <el-alert
          :title="getEvaluationSuggestion()"
          :type="getEvaluationAlertType()"
          style="margin-top: 15px"
          show-icon
          :closable="false"
        />
      </div>
      <div v-else style="text-align: center; padding: 40px; color: #909399">
        <el-icon :size="48"><Document /></el-icon>
        <p style="margin-top: 10px">暂无评估报告</p>
      </div>

      <template #footer>
        <el-button @click="evaluationDialogVisible = false">关闭</el-button>
        <el-button
          v-if="evaluationReport && evaluationReport.performance_metrics.accuracy >= 0.85"
          type="primary"
          @click="handleReloadModelFromDialog"
        >
          <el-icon><Refresh /></el-icon>
          应用此模型
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref, computed } from 'vue'
import { ElMessage, ElMessageBox, ElLoading, type FormInstance, type FormRules } from 'element-plus'
import type { UploadInstance, UploadRawFile } from 'element-plus'
import {
  Setting, Tools, DataAnalysis, Cpu, Bell, Message, Document,
  Select, RefreshLeft, Refresh, VideoPlay, TrendCharts, Close, Delete, Upload, MagicStick, User, Plus, Search
} from '@element-plus/icons-vue'
import { useUserStore } from '~/stores/user'

const userStore = useUserStore()

type AlgorithmType = 'NODE_IDS' | 'PAMMA'

type TrainingJob = {
  id: number
  algorithm: AlgorithmType
  status: string
  progress: number
  createdAt: string
  finishedAt?: string
}

type LogEntry = {
  id: number
  level: string
  module: string
  message: string
  timestamp: string
}

const activeTab = ref('system')

// 系统参数
const defaultSystem = {
  systemName: '智能电网故障诊断系统',
  autoDiagnosis: false
}
const systemForm = reactive({ ...defaultSystem })

// 算法配置
const algorithmConfig = reactive({
  hiddenDim: 256,
  compressDim: 16,
  numGnnLayers: 3,
  dropout: 0.143,
  learningRate: 0.0014,
  batchSize: 32,
  numEpochs: 100,
  patience: 20
})

// 超参数优化结果
const optimizationResult = ref<any>(null)

// 训练配置
const trainingConfig = reactive({ pythonExecutable: 'python', maxConcurrentJobs: 1 })
const trainingJobs = ref<TrainingJob[]>([])
const trainingStarting = ref(false)
const uploadRef = ref<UploadInstance>()
const uploadedFile = ref<UploadRawFile | null>(null)
const uploading = ref(false)

// 模型评估
const evaluationDialogVisible = ref(false)
const evaluationReport = ref<any>(null)

// 预警规则
const defaultAlert = {
  confidenceThreshold: 80,
  normalConditions: ['单相接地'],
  seriousConditions: ['相间短路', '两相接地'],
  urgentConditions: ['三相短路', '三相接地短路']
}
const alertForm = reactive({ ...defaultAlert })

// 通知设置
const notifyForm = reactive({
  systemNotify: true,
  levels: ['严重', '紧急']
})

// 系统日志
const logs = ref<LogEntry[]>([])
const logLevel = ref('')
const logPagination = reactive({ page: 1, pageSize: 20, total: 0 })

// 数据库统计
const dbStats = reactive({
  faults: { total: 0, byStatus: {} },
  alerts: { total: 0, byStatus: {} },
  logs: { total: 0, byLevel: {} },
  total: 0
})

// 用户管理
const users = ref<any[]>([])
const userSearchForm = reactive({
  username: '',
  roleCode: ''
})
const userDialogVisible = ref(false)
const isEditUser = ref(false)
const userFormRef = ref<FormInstance>()
const userForm = ref<any>({
  username: '',
  password: '',
  realName: '',
  email: '',
  phone: '',
  roleCode: 'OPERATOR',
  department: '',
  status: 1
})

const userFormRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  roleCode: [{ required: true, message: '请选择角色', trigger: 'change' }]
}

const filteredUsers = computed(() => {
  let result = users.value
  if (userSearchForm.username) {
    result = result.filter(u => u.username.includes(userSearchForm.username))
  }
  if (userSearchForm.roleCode) {
    result = result.filter(u => u.roleCode === userSearchForm.roleCode)
  }
  return result
})

// 切换标签
const handleTabChange = (tab: string) => {
  activeTab.value = tab
  if (tab === 'logs') {
    loadLogs()
  } else if (tab === 'users') {
    loadUsers()
  }
}

// 用户管理函数
const loadUsers = async () => {
  try {
    const res: any = await $fetch('/api/v1/user')
    if (res.code === 200) {
      users.value = res.data
    }
  } catch (error) {
    ElMessage.error('加载用户列表失败')
  }
}

const resetUserSearch = () => {
  userSearchForm.username = ''
  userSearchForm.roleCode = ''
  loadUsers()
}

const handleAddUser = () => {
  isEditUser.value = false
  userForm.value = {
    username: '',
    password: '',
    realName: '',
    email: '',
    phone: '',
    roleCode: 'OPERATOR',
    department: '',
    status: 1
  }
  userDialogVisible.value = true
}

const handleEditUser = (row: any) => {
  isEditUser.value = true
  userForm.value = { ...row, password: '' }
  userDialogVisible.value = true
}

const handleDeleteUser = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确定要删除用户 ${row.username} 吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const res: any = await $fetch('/api/v1/user/delete', {
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

const handleSubmitUser = async () => {
  if (!userFormRef.value) return

  await userFormRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      const url = isEditUser.value ? '/api/v1/user/update' : '/api/v1/user/create'
      const method = isEditUser.value ? 'PUT' : 'POST'

      const res: any = await $fetch(url, {
        method,
        body: userForm.value
      })

      if (res.code === 200) {
        ElMessage.success(isEditUser.value ? '更新成功' : '创建成功')
        userDialogVisible.value = false
        loadUsers()
      } else {
        ElMessage.error(res.message || '操作失败')
      }
    } catch (error) {
      ElMessage.error('操作失败')
    }
  })
}

// 系统参数
const handleSaveSystem = async () => {
  try {
    await $fetch('/api/v1/settings/system', {
      method: 'POST',
      body: systemForm
    })
    ElMessage.success('系统参数已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const handleResetSystem = () => {
  Object.assign(systemForm, defaultSystem)
  ElMessage.info('已恢复默认设置')
}

// 加载数据库统计
const loadDbStats = async () => {
  try {
    const res: any = await $fetch('/api/v1/system/stats')
    if (res.code === 0 && res.data) {
      Object.assign(dbStats, res.data)
    }
  } catch (error) {
    console.error('加载数据库统计失败:', error)
  }
}

// 手动清理数据库
const handleManualCleanup = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清理旧数据吗？将删除 90 天前的故障/预警记录，30 天前的系统日志。',
      '确认清理',
      {
        confirmButtonText: '确定清理',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const loading = ElLoading.service({
      lock: true,
      text: '正在清理数据...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      await $fetch('/api/v1/system/cleanup', { method: 'POST' })
      await loadDbStats()
      ElMessage.success('数据清理完成')
    } finally {
      loading.close()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('数据清理失败')
    }
  }
}

// 加载系统参数
const loadSystemSettings = async () => {
  try {
    const res: any = await $fetch('/api/v1/settings/system')
    if (res.data) {
      Object.assign(systemForm, res.data)
    }
  } catch (error) {
    console.error('加载系统参数失败:', error)
  }
}

onMounted(() => {
  loadSystemSettings()
  loadAlertSettings()
  loadNotificationSettings()
  loadDbStats()
  loadOptimizationResult() // 加载优化结果
})

// 算法配置结果
const loadOptimizationResult = async () => {
  try {
    const res: any = await $fetch('/api/v1/training/optimization-result')
    if (res.success && res.data) {
      optimizationResult.value = res.data

      if (res.data.best_params) {
        algorithmConfig.hiddenDim = res.data.best_params.hidden_dim ?? algorithmConfig.hiddenDim
        algorithmConfig.compressDim = res.data.best_params.compressed_dim ?? algorithmConfig.compressDim
        algorithmConfig.dropout = Number((res.data.best_params.dropout ?? algorithmConfig.dropout).toFixed(3))
        algorithmConfig.learningRate = Number((res.data.best_params.learning_rate ?? algorithmConfig.learningRate).toFixed(4))
        algorithmConfig.batchSize = res.data.best_params.batch_size ?? algorithmConfig.batchSize
      }
    }
  } catch (error) {
    console.error('加载优化结果失败:', error)
  }
}

// 训练管理
const loadTrainingConfig = async () => {
  try {
    const res: any = await $fetch('/api/v1/training/config')
    Object.assign(trainingConfig, res.data || {})
  } catch (error) {
    console.error('加载训练配置失败:', error)
  }
}

const handleSaveTrainingConfig = async () => {
  try {
    await $fetch('/api/v1/training/config', {
      method: 'POST',
      body: {
        pythonExecutable: trainingConfig.pythonPath,
        maxConcurrentJobs: trainingConfig.maxConcurrent
      }
    })
    ElMessage.success('训练配置已保存')
  } catch (error) {
    ElMessage.error('保存训练配置失败')
  }
}

const loadTrainingJobs = async () => {
  try {
    const res: any = await $fetch('/api/v1/training/jobs')
    trainingJobs.value = res.data || []
  } catch (error) {
    console.error('加载训练任务失败:', error)
  }
}

const handleRefreshTrainingJobs = () => {
  loadTrainingJobs()
  ElMessage.success('已刷新任务列表')
}

const handleStartTraining = async (algorithm: AlgorithmType) => {
  trainingStarting.value = true
  try {
    await $fetch('/api/v1/training/jobs', {
      method: 'POST',
      body: { algorithm }
    })
    ElMessage.success(`${algorithm === 'NODE_IDS' ? 'Node IDs' : 'PaMMA-Net'} 训练任务已启动`)
    await loadTrainingJobs()
  } catch (error: any) {
    ElMessage.error(error.data?.message || '启动训练失败')
  } finally {
    trainingStarting.value = false
  }
}

// 文件上传
const handleFileChange = (file: any) => {
  uploadedFile.value = file.raw
}

const handleExceed = () => {
  ElMessage.warning('只能上传一个文件')
}

const handleUploadData = async () => {
  if (!uploadedFile.value) {
    ElMessage.warning('请先选择文件')
    return
  }

  uploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', uploadedFile.value)

    const res: any = await $fetch('/api/v1/training/upload', {
      method: 'POST',
      body: formData
    })

    ElMessage.success({
      message: `训练数据上传成功！\n样本数：${res.data.samples}\n文件路径：${res.data.path}`,
      duration: 3000
    })
    uploadedFile.value = null
    uploadRef.value?.clearFiles()
  } catch (error: any) {
    ElMessage.error(error.data?.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

const handleStopTraining = async (id: number) => {
  try {
    await ElMessageBox.confirm('确定要停止此训练任务吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await $fetch(`/api/v1/training/stop/${id}`, { method: 'POST' })
    ElMessage.success('训练任务已停止')
    await loadTrainingJobs()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('停止训练失败')
    }
  }
}

const trainingStatusType = (status: string) => {
  const map: Record<string, any> = {
    'PENDING': 'info',
    'RUNNING': 'warning',
    'COMPLETED': 'success',
    'FAILED': 'danger',
    'STOPPED': 'info'
  }
  return map[status] || 'info'
}

const progressColor = (progress: number) => {
  if (progress < 30) return '#F56C6C'
  if (progress < 70) return '#E6A23C'
  return '#67C23A'
}

// 重载模型
const handleReloadModel = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要将新训练的模型应用到系统中吗？应用后，所有故障诊断将使用新模型进行推理。',
      '确认重载模型',
      {
        confirmButtonText: '确定应用',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: true
      }
    )

    const loading = ElLoading.service({
      lock: true,
      text: '正在重载模型...',
      background: 'rgba(0, 0, 0, 0.7)'
    })

    try {
      await $fetch('/api/v1/model/reload', { method: 'POST' })
      ElMessage.success({
        message: '模型重载成功！新训练的模型已生效',
        duration: 3000
      })
      evaluationDialogVisible.value = false
    } finally {
      loading.close()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.data?.message || '模型重载失败')
    }
  }
}

// 查看评估报告
const handleViewEvaluation = async () => {
  try {
    const res: any = await $fetch('/api/v1/model/evaluation')
    if (res.code === 0 && res.data) {
      evaluationReport.value = res.data
      evaluationDialogVisible.value = true
    } else {
      ElMessage.warning(res.message || '暂无评估报告')
    }
  } catch (error: any) {
    ElMessage.error('加载评估报告失败')
  }
}

// 从对话框重载模型
const handleReloadModelFromDialog = () => {
  evaluationDialogVisible.value = false
  handleReloadModel()
}

// 获取指标样式类
const getMetricClass = (value: number) => {
  if (value >= 0.90) return 'metric-excellent'
  if (value >= 0.85) return 'metric-good'
  if (value >= 0.75) return 'metric-fair'
  return 'metric-poor'
}

// 获取评估建议
const getEvaluationSuggestion = () => {
  if (!evaluationReport.value) return ''
  const acc = evaluationReport.value.performance_metrics.accuracy
  if (acc >= 0.90) return '✅ 模型性能优秀！准确率达到 90% 以上，建议应用到生产环境。'
  if (acc >= 0.85) return '✅ 模型性能良好！准确率在 85%-90% 之间，可以应用到生产环境。'
  if (acc >= 0.75) return '⚠️ 模型性能一般。准确率在 75%-85% 之间，建议调整参数后重新训练。'
  return '❌ 模型性能较差。准确率低于 75%，不建议应用，请检查数据质量或调整算法参数。'
}

// 获取评估提示类型
const getEvaluationAlertType = () => {
  if (!evaluationReport.value) return 'info'
  const acc = evaluationReport.value.performance_metrics.accuracy
  if (acc >= 0.85) return 'success'
  if (acc >= 0.75) return 'warning'
  return 'error'
}

// 预警规则
const handleSaveAlert = async () => {
  try {
    await $fetch('/api/v1/settings/alert', {
      method: 'POST',
      body: alertForm
    })
    ElMessage.success('预警规则已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

const handleResetAlert = () => {
  Object.assign(alertForm, defaultAlert)
  ElMessage.info('已恢复默认规则')
}

// 加载预警规则
const loadAlertSettings = async () => {
  try {
    const res: any = await $fetch('/api/v1/settings/alert')
    if (res.data) {
      Object.assign(alertForm, res.data)
    }
  } catch (error) {
    console.error('加载预警规则失败:', error)
  }
}

// 通知设置
const handleSaveNotify = async () => {
  try {
    await $fetch('/api/v1/settings/notification', {
      method: 'POST',
      body: notifyForm
    })
    ElMessage.success('通知设置已保存')
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

// 加载通知设置
const loadNotificationSettings = async () => {
  try {
    const res: any = await $fetch('/api/v1/settings/notification')
    if (res.data) {
      Object.assign(notifyForm, res.data)
    }
  } catch (error) {
    console.error('加载通知设置失败:', error)
  }
}


// 系统日志
const loadLogs = async () => {
  try {
    const params = new URLSearchParams({
      page: logPagination.page.toString(),
      pageSize: logPagination.pageSize.toString(),
      level: logLevel.value
    })
    const res: any = await $fetch(`/api/v1/system/logs?${params}`)
    logs.value = res.data.records || []
    logPagination.total = res.data.total || 0
  } catch (error) {
    console.error('加载系统日志失败:', error)
    ElMessage.error('加载日志失败')
  }
}

const handleClearLogs = async () => {
  try {
    await ElMessageBox.confirm('确定要清空所有日志吗？此操作不可恢复！', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await $fetch('/api/v1/system/logs', { method: 'DELETE' })
    ElMessage.success('日志已清空')
    await loadLogs()
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('清空日志失败')
    }
  }
}

const logLevelType = (level: string) => {
  const map: Record<string, any> = {
    'INFO': 'info',
    'WARNING': 'warning',
    'ERROR': 'danger'
  }
  return map[level] || 'info'
}

// 定时刷新训练任务
let refreshTimer: NodeJS.Timeout | null = null

onMounted(() => {
  // 恢复用户状态
  userStore.restoreState()

  loadTrainingConfig()
  loadTrainingJobs()

  // 每5秒刷新一次训练任务
  refreshTimer = setInterval(() => {
    if (activeTab.value === 'training') {
      loadTrainingJobs()
    }
  }, 5000)
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped lang="scss">
.settings-page {
  padding: 20px;
  min-height: calc(100vh - 100px);
}

.nav-card {
  position: sticky;
  top: 20px;

  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
  }

  .settings-menu {
    border: none;
    background: transparent;

    :deep(.el-menu-item) {
      margin: 4px 0;
      border-radius: 6px;

      &:hover {
        background: rgba(64, 158, 255, 0.1);
      }

      &.is-active {
        background: rgba(64, 158, 255, 0.15);
        color: #409EFF;
      }
    }
  }
}

.content-card {
  min-height: 500px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.settings-form {
  max-width: 800px;

  .form-tip {
    margin-left: 12px;
    font-size: 13px;
    color: $text-secondary;
  }

  :deep(.el-divider__text) {
    font-weight: 600;
    color: $text-primary;
  }
}

.training-actions {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;

  .training-card {
    flex: 1;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .training-card-content {
      display: flex;
      align-items: center;
      gap: 16px;

      .training-icon {
        font-size: 48px;
      }

      .training-info {
        flex: 1;

        .training-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .training-desc {
          font-size: 13px;
          color: $text-secondary;
        }
      }
    }
  }
}

.table-container {
  overflow-x: auto;

  .action-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;

    .el-button {
      margin: 0;
    }
  }
}

.evaluation-report {
  .metrics-card {
    margin-bottom: 0;

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
    }
  }

  .metric-item {
    text-align: center;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;

    .metric-label {
      font-size: 13px;
      color: $text-secondary;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 24px;
      font-weight: 600;
      color: $text-primary;

      &.metric-excellent {
        color: #67C23A;
      }

      &.metric-good {
        color: #409EFF;
      }

      &.metric-fair {
        color: #E6A23C;
      }

      &.metric-poor {
        color: #F56C6C;
      }
    }
  }
}
</style>
