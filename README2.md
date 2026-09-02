# 智能电网故障诊断系统 —— 项目全档案（学习版）

> 本文档是毕设项目的**逐文件讲解笔记**，把每个文件夹、每个重要文件是干嘛的讲清楚，配合 `README.md`（官方启动说明）一起看。

## 项目一句话

**这个毕设 = 一个网页系统（Nuxt）＋ 一个 AI 服务（Python）＋ 一堆数据和模型（data_new）。网页负责给人用，AI 负责判断故障，数据仓库负责存料。**

| 你学过的文件 | 在哪个盒子 | 角色 |
|---|---|---|
| `diagnosis/index.vue` | frontend/pages/ | 诊断页面（用户看的） |
| `index.post.ts` | frontend/server/api/ | 诊断业务接口（经理） |
| `database.ts` | frontend/server/data/ | SQLite 操作（仓库管理员） |
| `diagnosis-policy.ts` | frontend/server/utils/ | 预警规则（规则手册） |
| `model_inference_service.py` | algorithm/ | FastAPI 模型服务 |
| `vq_mlp_model.py` | algorithm/ | 模型图纸（3 个类） |

## 技术栈

- 前端：Nuxt 3、Vue 3、TypeScript、Element Plus、Pinia、ECharts
- 后端接口：Nuxt Server API、SQLite（better-sqlite3）
- 算法服务：Python、FastAPI、PyTorch、NumPy、Pandas、scikit-learn、Optuna

## 项目结构总览

```text
bishe/
├── algorithm/          # Python 算法：训练、实验、推理服务
├── data_new/           # 数据仓库：训练数据 + 模型权重 + 实验结果
├── frontend/           # Nuxt 3 前端与服务端接口（全栈）
├── run_logs/           # 运行日志
├── README.md           # 官方说明（启动命令/接口/故障类型）
└── .gitignore          # git 忽略规则
```

---

## 一、frontend/ —— Nuxt 3 全栈（TypeScript + Node.js，跑在 3000 端口）

### 1. pages/ 页面（用户看到的每一个界面）

| 文件 | 干嘛 |
|---|---|
| `login.vue` | 登录页 |
| `index.vue` | 首页（自动跳转） |
| `dashboard/index.vue` | 仪表盘首页（统计卡片） |
| `diagnosis/index.vue` | 🔥 **诊断页**（核心，已学） |
| `device/index.vue` | 设备管理页（增删改查） |
| `alert/index.vue` | 预警列表页 |
| `alert/notifications.vue` | 通知页 |
| `analysis/index.vue` | 分析页（ECharts 图表） |
| `optimization/index.vue` | 训练调优页（触发 Python 训练） |
| `profile/index.vue` | 个人中心 |
| `settings/index.vue` + `settings/users.vue` | 系统设置 / 用户管理 |

> **规律**：Nuxt 里 `pages/xxx.vue` 就是一个页面，路径就是 `/xxx`。`diagnosis/index.vue` → 浏览器访问 `/diagnosis`。

### 2. server/api/ 业务接口（后端"经理"们）

- `auth/`：登录（login.post.ts）、注册、退出、查用户信息
- `v1/diagnosis/`：**诊断**（index.post 单条诊断＝已学）、batch.post（批量）、samples.get（测试样本）、dataset.get（数据集）、codebook-map.get（码本映射）、page.get（诊断记录分页）、import.post（导入）
- `v1/device/`：设备增删改查、导入、统计
- `v1/model/`：reload.post（热重载模型）、evaluation.get（评估）
- `v1/training/`：**在线训练**（配置、启停训练任务、上传数据、查调参结果）
- `v1/alert/`、`v1/notification/`、`v1/settings/`、`v1/system/`、`v1/user/`、`v1/analysis/`

> **规律**：`server/api/v1/diagnosis/index.post.ts` 的**文件名**就决定了接口地址和请求方法——`index.post.ts` = `POST /api/v1/diagnosis`。一个文件一个接口。

### 3. server/data/ 数据层（仓库管理员）

| 文件 | 干嘛 |
|---|---|
| `database.ts` | 🔥 **SQLite 全部操作**（7 张表，已学） |
| `store.ts` | 内存数据 + 类型定义（User/Device/FaultRecord 等 interface） |
| `training.ts` | **训练任务管理**：用 `spawn` 启动 Python 训练脚本，管理任务状态（PENDING→RUNNING→SUCCESS）——这就是"前端在线训练"的实现 |

### 4. server/utils/ 业务规则工具

| 文件 | 干嘛 |
|---|---|
| `diagnosis-policy.ts` | 🔥 **预警规则**（30% 阈值、等级、文案，已学） |
| `auto-diagnosis.ts` | 自动诊断（定时/后台跑诊断） |
| `notifications.ts` | 通知发送（邮件等） |
| `analysis.ts` | 分析统计计算 |
| `cleanup.ts` | 定期清理旧数据 |
| `diagnosis-samples.ts` | 诊断测试样本管理 |

### 5. 配置类（认识就行）

- `nuxt.config.ts`：Nuxt 配置。注意 `ssr: false`（纯前端渲染）、装了 element-plus 和 pinia 两个模块、全局样式
- `package.json`：所有 JS 依赖清单（点菜的地方）
- `.env`：环境变量（目前只有邮件配置 `EMAIL_*`，邮件功能关闭 `EMAIL_ENABLED=false`）
- `data/smart_grid.db`：**SQLite 数据库文件**（前端数据的家）
- `stores/user.ts`：登录状态（Pinia）
- `layouts/`：页面布局（default/blank）
- `components/common/`：公共组件
- `assets/styles/`：scss 样式
- `plugins/init.ts`：服务启动初始化
- `utils/export.ts`：前端导出工具

---

## 二、algorithm/ —— Python（模型训练 + 推理服务，跑在 8000 端口）

| 文件 | 干嘛 |
|---|---|
| `vq_mlp_model.py` | 🔥 模型图纸：编码器（NodeIDsEncoder）/ 量化层（VectorQuantizer）/ 分类器（FaultClassifier）3 个类（已学） |
| `model_inference_service.py` | 🔥 FastAPI 推理服务：对外提供 `/api/diagnose`、`/api/batch_diagnose`、`/reload` 等接口（已学） |
| `train_6class_model.py` | 训练主脚本：读 CSV → 训练 → 存权重到 data_new/models |
| `optimize_hyperparameters.py` | Optuna 自动调参，存 `*_optimized.pth` |
| `baseline_models.py` | 基线模型定义（论文对比用） |
| `train_baseline_models.py` | 训练基线模型 |
| `run_all_experiments.py` | 一键跑全部实验（消融/对比），汇总到 experiment_results.json |
| `visualize_optuna_results.py` | 把调参过程画成图 |
| `print_results.py` | 打印实验结果的辅助脚本 |
| `realistic_data_adapter.py` | 把真实/模拟数据转成模型输入格式 |
| `start_service.py` | 启动入口（内部调 model_inference_service.py） |
| `requirements.txt` | Python 依赖清单（fastapi/torch/optuna 等） |

> **算法侧流程**：训练（train/optimize）→ 存权重到 data_new/models → 推理服务（model_inference_service）读权重 → 等着被调用。

---

## 三、data_new/ —— 数据仓库

- `kaggle/classData.csv`：**训练数据**——六类故障的三相电流电压样本（模型就学的这个）
- `kaggle/detect_dataset.csv`：检测数据
- `models/fault_6class/`：**正式模型目录**（推理服务读这里）
  - `encoder.pth` / `vq_layer.pth` / `classifier.pth`：普通训练保存的权重
  - `encoder_optimized.pth` 等 3 个：**Optuna 调优后的最优权重**（推理服务实际加载的）
  - `scaler_params.json`：标准化参数（mean/std）
  - `codebook_map.json`：码本编号 → 故障含义的映射
  - `optimization_result.json`：调参全过程结果
- `models/` 下还有 10 个实验版本（_default/_optimized/_improved/_balanced/_weighted/seed123…）：论文实验对比留下，记录哪个配置好
- `models/experiment_results.json`：所有实验的汇总结果

---

## 四、根目录

- `README.md`：项目说明（启动命令/接口/故障类型）
- `.gitignore`：git 忽略规则
- `run_logs/`：运行日志

---

## 五、系统运行流程（端到端）

```text
启动①：python algorithm/start_service.py     → FastAPI 跑在 8000（模型服务）
启动②：cd frontend && npm run dev             → Nuxt 跑在 3000（网页）

浏览器 http://localhost:3000/diagnosis
  ↓ 点"开始诊断"，提交 deviceId + [Ia,Ib,Ic,Va,Vb,Vc]
Nuxt 接口 server/api/v1/diagnosis/index.post.ts
  ↓ fetch → http://localhost:8000/api/diagnose
FastAPI model_inference_service.py
  ↓ 读 data_new/models/fault_6class/*.pth 权重 → 标准化→编码→量化→分类
  ↓ 返回 故障类型 + 置信度
Nuxt 收结果 → diagnosis-policy 判断等级/预警 → database.ts 写入 smart_grid.db
  ↓
页面显示：故障类型、置信度、预警
```

**一句话记忆**："**页面提需求 → Nuxt 办业务 → Python 出诊断 → SQLite 留档案 → 页面看结果**"

---

## 六、两条核心链路

### 链路 1：诊断推理（面试必问）

```
diagnosis/index.vue（页面提交6维特征）
  → server/api/v1/diagnosis/index.post.ts（校验+调模型+落库+预警）
  → algorithm/model_inference_service.py（FastAPI：标准化→编码→量化→分类）
  → algorithm/vq_mlp_model.py（模型图纸：Encoder / VQ / Classifier）
  → data_new/models/fault_6class/*.pth（权重）
  → 结果回 Nuxt：diagnosis-policy.ts（算等级/判断预警）+ database.ts（写SQLite）
```

### 链路 2：模型训练

```
train_6class_model.py（读 classData.csv 训练）
  → optimize_hyperparameters.py（Optuna 调优，存 *_optimized.pth）
  → data_new/models/fault_6class/
  → model_inference_service.py（加载权重，热重载 /reload）
```

---

## 七、学习路径地图（按这个顺序学不迷路）

1. **先懂总框架**——知道每个文件站哪
2. **主链路**（面试必问）：`diagnosis/index.vue` → `index.post.ts` → `model_inference_service.py` → `vq_mlp_model.py` → `database.ts` + `diagnosis-policy.ts`
3. **训练链路**：`train_6class_model.py` → `optimize_hyperparameters.py` → 产出 `.pth` → `model_inference_service.py` 加载
4. **进阶**：`training.ts`（在线训练）、`auto-diagnosis.ts`（自动诊断）、`ws/`（推送）

---

## 八、面试总结（一页纸）

> "项目分三层：前端 + 业务后端用 Nuxt（TypeScript，跑 Node.js），包含页面（pages）、业务接口（server/api）、数据访问（server/data/database.ts 操作 SQLite）和业务规则（server/utils/diagnosis-policy.ts）；AI 模型单独在 algorithm 目录，用 Python 实现——vq_mlp_model.py 定义模型结构，训练脚本和 Optuna 调参产出权重到 data_new/models，FastAPI 推理服务加载权重对外提供 HTTP 接口。浏览器 → Nuxt → FastAPI → 模型 → SQLite 整条链路解耦清晰，模型可独立热更新。"

### 故障类型编号（记忆表）

| 编号 | 故障类型 |
|---|---|
| 0 | 正常 |
| 1 | 单相接地故障 |
| 2 | 相间短路故障 |
| 3 | 三相短路故障 |
| 4 | 两相接地故障 |
| 5 | 三相接地短路 |
