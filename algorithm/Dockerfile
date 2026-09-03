# ============================================================
# 算法推理服务镜像（FastAPI + PyTorch CPU）
# 构建上下文：项目根目录（docker compose 默认）
# ============================================================

FROM python:3.11-slim

WORKDIR /app

# 系统依赖：PyTorch CPU 版运行时需要 OpenMP 动态库（libgomp）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# 先安装 CPU 版 PyTorch（避免拉取数 GB 的 CUDA 版本，本机推理用 CPU 足够）
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 安装其余 Python 依赖（requirements 中的 torch 已满足，不会重复下载）
COPY algorithm/requirements.txt /app/algorithm/requirements.txt
RUN pip install --no-cache-dir -r /app/algorithm/requirements.txt

# 拷贝算法服务代码与模型权重
COPY algorithm/ /app/algorithm/
COPY data_new/models/fault_6class/ /app/data_new/models/fault_6class/

EXPOSE 8000

# 模型路径解析：cwd=/app 时模型目录为 data_new/models/fault_6class
CMD ["python", "algorithm/model_inference_service.py"]
