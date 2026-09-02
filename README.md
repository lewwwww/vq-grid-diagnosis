# 智能电网故障诊断系统

本项目是一个智能电网故障诊断系统，包含前端管理平台和 Python 算法服务两部分。前端负责设备、告警、诊断、训练和分析等页面展示；算法服务负责加载训练好的故障诊断模型，并对设备特征进行实时推理。

## 项目结构

```text
.
├── algorithm/                 # Python 算法训练、实验和推理服务
├── data_new/                  # 数据集、模型权重和实验结果
│   ├── kaggle/                # 原始/处理后的数据集
│   └── models/                # 已训练模型与评估结果
├── frontend/                  # Nuxt 3 前端与服务端接口（server/ 为服务端）
└── run_logs/                  # 运行日志
```

## 技术栈

- 前端：Nuxt 3、Vue 3、TypeScript、Element Plus、Pinia、ECharts
- 后端接口：Nuxt Server API、SQLite
- 算法服务：Python、FastAPI、PyTorch、NumPy、Pandas、scikit-learn、Optuna

## 前端启动

**环境要求**：Node.js ≥ 22（项目使用 better-sqlite3 原生模块，按 Node 22 ABI 编译，Node 18/20 会报 ERR_DLOPEN_FAILED）。

进入前端目录：

```bash
cd frontend
npm install
npm run dev
```

默认访问地址通常为：

```text
http://localhost:3000
```

## Python 算法环境

**环境要求**：Python 3.10+，建议使用 conda 或 venv 创建独立环境：

```bash
conda create -n smart-grid python=3.11 -y
conda activate smart-grid
pip install -r algorithm/requirements.txt
```

## 启动模型推理服务

在项目根目录执行：

```bash
python algorithm/start_service.py
```

或直接运行：

```bash
python algorithm/model_inference_service.py
```

服务默认地址：

```text
http://localhost:8000
```

接口文档：

```text
http://localhost:8000/docs
```

## 主要接口

单条故障诊断：

```http
POST /api/diagnose
```

请求示例：

```json
{
  "device_id": 1,
  "features": [27000, 28000, 26500, 105, 110, 108]
}
```

其中 `features` 为 6 维特征：

```text
[Ia, Ib, Ic, Va, Vb, Vc]
```

批量故障诊断：

```http
POST /api/batch_diagnose
```

## 知识库增强问答模块

面向故障处置的知识库问答：模型输出故障类型后，从内置检修规程知识库（依据 DL/T 1753、Q/GDW 1519 整理）中按故障类型/关键词检索，返回带来源的故障解释与处置建议；检索未命中时降级返回通用处置建议。

```http
POST /api/v1/qa
```

请求示例：

```json
{
  "faultType": 4
}
```

或按关键词查询：

```json
{
  "question": "单相接地"
}
```

## 模型训练与实验

训练 6 分类故障诊断模型：

```bash
python algorithm/train_6class_model.py
```

执行超参数优化：

```bash
python algorithm/optimize_hyperparameters.py --n_trials 100
```

运行对比实验和消融实验：

```bash
python algorithm/run_all_experiments.py --exp all
```

实验结果和模型权重会保存到 `data_new/models/` 目录。

## 故障类型

模型输出为 6 分类结果：

| 编号 | 故障类型 |
| --- | --- |
| 0 | 正常 |
| 1 | 单相接地故障 |
| 2 | 相间短路故障 |
| 3 | 三相短路故障 |
| 4 | 两相接地故障 |
| 5 | 三相接地短路 |

## 常用开发顺序

1. 启动 Python 模型推理服务。
2. 启动前端 Nuxt 项目。
3. 在前端页面录入或导入设备数据。
4. 前端调用诊断接口，获取故障类型、置信度和量化编码结果。
5. 在告警、诊断、分析等页面查看结果。
