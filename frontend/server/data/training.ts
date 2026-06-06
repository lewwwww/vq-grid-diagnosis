import { spawn, type ChildProcess } from 'child_process'
import { resolve } from 'path'
import { logInfo, logError } from './database'

export type AlgorithmType = 'NODE_IDS' | 'OPTIMIZATION'
export type JobStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'STOPPED'

export interface TrainingJob {
  id: number
  algorithm: AlgorithmType
  status: JobStatus
  progress: number
  command: string
  scriptPath: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
  exitCode?: number | null
  requestedBy: string
  logs: string[]
  optimizationResult?: any  // 超参数优化结果
}

interface TrainingConfig {
  pythonExecutable: string
  maxConcurrentJobs: number
  scripts: Record<AlgorithmType, string>
  epochHints: Record<AlgorithmType, number>
  algorithmSettings: Record<string, any>
}

const _config: TrainingConfig = {
  pythonExecutable: 'python',
  maxConcurrentJobs: 1,
  scripts: {
    NODE_IDS: 'algorithm/train_6class_model.py',
    OPTIMIZATION: 'algorithm/optimize_hyperparameters.py'
  },
  epochHints: {
    NODE_IDS: 100,
    OPTIMIZATION: 30  // 优化试验次数
  },
  algorithmSettings: {
    hiddenDim: 128,
    compressDim: 10,
    confidenceThreshold: 80,
    dropout: 0.1,
    learningRate: 0.001,
    weightDecay: 0.0005,
    batchSize: 64
  }
}

let _nextJobId = 1
const _jobs: TrainingJob[] = []
const _runningJobs = new Map<number, ChildProcess>()

const now = () => {
  const date = new Date()
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).replace(/\//g, '-')
}

function appendLog(job: TrainingJob, line: string) {
  const text = line?.trim()
  if (!text) return
  job.logs.push(text)
  if (job.logs.length > 300) job.logs = job.logs.slice(-300)
  const m = text.match(/Epoch\s+([0-9]+)/i)
  if (m) {
    const epoch = Number(m[1])
    const total = _config.epochHints[job.algorithm] || 100
    job.progress = Math.min(95, Math.floor((epoch / Math.max(total, 1)) * 100))
  }
  if (text.includes('训练完成') || text.includes('[SUCCESS]')) job.progress = 100
}

export function getTrainingConfig() {
  return JSON.parse(JSON.stringify(_config))
}

export function updateTrainingConfig(patch: Partial<TrainingConfig>) {
  if (patch.pythonExecutable) _config.pythonExecutable = patch.pythonExecutable
  if (patch.maxConcurrentJobs) _config.maxConcurrentJobs = Math.max(1, patch.maxConcurrentJobs)
  if (patch.algorithmSettings) {
    _config.algorithmSettings = { ..._config.algorithmSettings, ...patch.algorithmSettings }
  }
  return getTrainingConfig()
}

export function listTrainingJobs(limit = 20) {
  return [..._jobs].sort((a, b) => b.id - a.id).slice(0, limit)
}

export function getTrainingJob(id: number) {
  return _jobs.find(j => j.id === id)
}

export function createTrainingJob(algorithm: AlgorithmType, requestedBy = 'system') {
  const rootDir = resolve(process.cwd(), '..')

  // 构建命令行参数（使用相对路径）
  const args = [_config.scripts[algorithm]]  // 使用相对路径
  const settings = _config.algorithmSettings

  if (settings.hiddenDim) args.push('--hidden_dim', String(settings.hiddenDim))
  if (settings.compressDim) args.push('--compressed_dim', String(settings.compressDim))
  if (settings.dropout !== undefined) args.push('--dropout', String(settings.dropout))
  if (settings.learningRate) args.push('--learning_rate', String(settings.learningRate))
  if (settings.batchSize) args.push('--batch_size', String(settings.batchSize))
  if (settings.numEpochs) args.push('--num_epochs', String(settings.numEpochs))
  if (settings.patience) args.push('--patience', String(settings.patience))

  const command = `${_config.pythonExecutable} ${args.join(' ')}`

  const job: TrainingJob = {
    id: _nextJobId++, algorithm, status: 'PENDING', progress: 0,
    command, scriptPath: _config.scripts[algorithm], createdAt: now(), requestedBy, logs: []
  }
  _jobs.push(job)

  if (_runningJobs.size >= _config.maxConcurrentJobs) {
    job.status = 'FAILED'
    job.finishedAt = now()
    appendLog(job, '[ERROR] 当前并发训练任务已达上限，请稍后再试')
    return job
  }

  try {
    console.log(`[训练任务] 启动命令: ${command}`)
    console.log(`[训练任务] 工作目录: ${rootDir}`)
    const child = spawn(_config.pythonExecutable, args, { cwd: rootDir, shell: true })
    _runningJobs.set(job.id, child)
    job.status = 'RUNNING'
    job.startedAt = now()

    child.stdout?.on('data', d => d.toString().split(/\r?\n/).forEach((l: string) => appendLog(job, l)))
    child.stderr?.on('data', d => d.toString().split(/\r?\n/).forEach((l: string) => appendLog(job, `[ERR] ${l}`)))

    child.on('close', code => {
      _runningJobs.delete(job.id)
      if (job.status === 'STOPPED') return
      job.exitCode = code
      job.finishedAt = now()
      job.status = code === 0 ? 'SUCCESS' : 'FAILED'
      if (job.status === 'SUCCESS') {
        job.progress = 100
        logInfo('模型训练', `训练任务 #${job.id} (${algorithm}) 完成`)
      } else {
        logError('模型训练', `训练任务 #${job.id} (${algorithm}) 失败，退出码: ${code}`)
      }
    })

    child.on('error', e => {
      _runningJobs.delete(job.id)
      job.status = 'FAILED'
      job.finishedAt = now()
      appendLog(job, `[ERROR] ${e.message}`)
    })
  } catch (e: any) {
    job.status = 'FAILED'
    job.finishedAt = now()
    appendLog(job, `[ERROR] ${e?.message || '训练任务启动失败'}`)
  }

  return job
}

export function stopTrainingJob(id: number) {
  const job = getTrainingJob(id)
  const child = _runningJobs.get(id)
  if (!job || !child) return null
  child.kill()
  _runningJobs.delete(id)
  job.status = 'STOPPED'
  job.finishedAt = now()
  appendLog(job, '[INFO] 任务已手动停止')
  return job
}

/**
 * 创建超参数优化任务
 */
export async function createOptimizationJob(params: {
  n_trials?: number
  data_path?: string
}) {
  const { n_trials = 30, data_path = 'data_new/kaggle/classData.csv' } = params

  const rootDir = resolve(process.cwd(), '..')
  const scriptPath = resolve(rootDir, _config.scripts.OPTIMIZATION)

  const job: TrainingJob = {
    id: _nextJobId++,
    algorithm: 'OPTIMIZATION',
    status: 'PENDING',
    progress: 0,
    command: '',
    scriptPath: _config.scripts.OPTIMIZATION,
    createdAt: now(),
    requestedBy: 'system',
    logs: []
  }

  _jobs.push(job)
  appendLog(job, `[INFO] 创建超参数优化任务 #${job.id}`)
  appendLog(job, `[INFO] 试验次数: ${n_trials}`)
  appendLog(job, `[INFO] 数据路径: ${data_path}`)

  // 检查并发限制
  if (_runningJobs.size >= _config.maxConcurrentJobs) {
    job.status = 'FAILED'
    job.finishedAt = now()
    appendLog(job, '[ERROR] 当前并发训练任务已达上限，请稍后再试')
    return job
  }

  // 启动优化任务
  try {
    const args = [
      _config.scripts.OPTIMIZATION,  // 使用相对路径
      '--n_trials', n_trials.toString(),
      '--data_path', data_path,
      '--output_dir', 'data_new/models/fault_6class'
    ]

    job.command = `${_config.pythonExecutable} ${args.join(' ')}`
    appendLog(job, `[INFO] 执行命令: ${job.command}`)

    console.log(`[优化任务] 启动命令: ${job.command}`)
    console.log(`[优化任务] 工作目录: ${rootDir}`)

    const child = spawn(_config.pythonExecutable, args, {
      cwd: rootDir,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',  // 设置 Python 输出编码
        PYTHONUTF8: '1'  // Python 3.7+ UTF-8 模式
      }
    })

    _runningJobs.set(job.id, child)
    job.status = 'RUNNING'
    job.startedAt = now()

    // 处理标准输出
    child.stdout?.on('data', (data) => {
      const text = data.toString('utf-8')
      appendLog(job, text)

      // 解析进度 - 支持多种格式
      // 格式1: "Trial 5 finished..."
      // 格式2: "17%|█████▌ | 5/30 [00:45<03:30, 8.42s/trial]"
      const trialMatch1 = text.match(/Trial (\d+)/i)
      const trialMatch2 = text.match(/(\d+)%\|/)
      const trialMatch3 = text.match(/\|\s*(\d+)\/(\d+)\s*\[/)

      if (trialMatch1) {
        const currentTrial = parseInt(trialMatch1[1])
        job.progress = Math.round((currentTrial / n_trials) * 100)
        console.log(`[优化进度] Trial ${currentTrial}/${n_trials} = ${job.progress}%`)
      } else if (trialMatch2) {
        job.progress = parseInt(trialMatch2[1])
        console.log(`[优化进度] 直接解析: ${job.progress}%`)
      } else if (trialMatch3) {
        const current = parseInt(trialMatch3[1])
        const total = parseInt(trialMatch3[2])
        job.progress = Math.round((current / total) * 100)
        console.log(`[优化进度] ${current}/${total} = ${job.progress}%`)
      }
    })

    // 处理标准错误
    child.stderr?.on('data', (data) => {
      const text = data.toString('utf-8')
      appendLog(job, `[STDERR] ${text}`)

      // stderr 中也可能有进度信息（Optuna 的进度条输出到 stderr）
      const trialMatch1 = text.match(/Trial (\d+)/i)
      const trialMatch2 = text.match(/(\d+)%\|/)
      const trialMatch3 = text.match(/\|\s*(\d+)\/(\d+)\s*\[/)

      if (trialMatch1) {
        const currentTrial = parseInt(trialMatch1[1])
        job.progress = Math.round((currentTrial / n_trials) * 100)
        console.log(`[优化进度-stderr] Trial ${currentTrial}/${n_trials} = ${job.progress}%`)
      } else if (trialMatch2) {
        job.progress = parseInt(trialMatch2[1])
        console.log(`[优化进度-stderr] 直接解析: ${job.progress}%`)
      } else if (trialMatch3) {
        const current = parseInt(trialMatch3[1])
        const total = parseInt(trialMatch3[2])
        job.progress = Math.round((current / total) * 100)
        console.log(`[优化进度-stderr] ${current}/${total} = ${job.progress}%`)
      }
    })

    // 处理进程结束
    child.on('close', async (code) => {
      console.log(`[优化任务] 进程结束，退出码: ${code}`)
      _runningJobs.delete(job.id)
      job.exitCode = code
      job.finishedAt = now()

      if (code === 0) {
        job.status = 'SUCCESS'
        job.progress = 100
        appendLog(job, '[INFO] 超参数优化完成')
        console.log(`[优化任务] 任务 #${job.id} 成功完成`)

        // 读取优化结果
        try {
          const fs = await import('fs/promises')
          const resultPath = resolve(rootDir, 'data_new/models/fault_6class/optimization_result.json')
          console.log(`[优化任务] 读取结果文件: ${resultPath}`)
          const resultData = await fs.readFile(resultPath, 'utf-8')
          job.optimizationResult = JSON.parse(resultData)
          appendLog(job, `[INFO] 最优验证准确率: ${job.optimizationResult.best_value.toFixed(4)}`)
          appendLog(job, `[INFO] 最优超参数: ${JSON.stringify(job.optimizationResult.best_params)}`)
          console.log(`[优化任务] 结果读取成功`)
        } catch (e: any) {
          appendLog(job, `[WARN] 无法读取优化结果: ${e.message}`)
          console.error(`[优化任务] 读取结果失败:`, e)
        }
      } else {
        job.status = 'FAILED'
        appendLog(job, `[ERROR] 优化失败，退出码: ${code}`)
        console.error(`[优化任务] 任务 #${job.id} 失败，退出码: ${code}`)
      }
    })

    child.on('error', (e) => {
      console.error(`[优化任务] 进程错误:`, e)
      _runningJobs.delete(job.id)
      job.status = 'FAILED'
      job.finishedAt = now()
      appendLog(job, `[ERROR] ${e.message}`)
    })
  } catch (e: any) {
    job.status = 'FAILED'
    job.finishedAt = now()
    appendLog(job, `[ERROR] ${e?.message || '优化任务启动失败'}`)
  }

  return job
}
