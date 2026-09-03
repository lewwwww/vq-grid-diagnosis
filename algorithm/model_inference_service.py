"""
 模型推理服务
使用训练好的 Optuna 最优模型权重进行实时故障诊断
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

import torch
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
from datetime import datetime


from vq_mlp_model import NodeIDsEncoder, VectorQuantizer, FaultClassifier


# ==================== 数据模型 ====================

class DiagnosisRequest(BaseModel):
    """诊断请求"""
    device_id: int
    features: List[float]  # [Ia, Ib, Ic, Va, Vb, Vc]


class DiagnosisResponse(BaseModel):
    """诊断响应"""
    device_id: int
    fault_type: int  # 0-5: 正常/单相接地/相间短路/三相短路/两相接地/三相接地短路
    fault_type_name: str
    confidence: float
    encoding_indices: List[int]  # VQ层输出的离散索引，当前为长度1列表
    quantized_vector: List[float]  # 码本查表得到的16维量化向量
    probabilities: List[float]
    inference_time_ms: float
    timestamp: str


# ==================== 模型加载 ====================

class ModelInferenceEngine:
    """模型推理引擎"""

    def __init__(self, model_dir: str = "data_new/models/fault_6class"):
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        print(f"[INFO] 使用设备: {self.device}")

        # 处理路径：如果在 algorithm 目录下运行，需要回到上级目录
        if Path.cwd().name == 'algorithm':
            model_dir = Path("..") / model_dir
        else:
            model_dir = Path(model_dir)

        print(f"[INFO] 模型目录: {model_dir}")

        # 加载编码器（Optuna最优配置：hidden_dim=256, compressed_dim=16）
        self.encoder = NodeIDsEncoder(input_dim=6, hidden_dim=256, compressed_dim=16)
        encoder_path = model_dir / "encoder_optimized.pth"

        if not encoder_path.exists():
            raise FileNotFoundError(f"编码器文件不存在: {encoder_path}")

        self.encoder.load_state_dict(torch.load(encoder_path, map_location=self.device, weights_only=True))
        self.encoder.to(self.device)
        self.encoder.eval()
        print(f"[INFO] 编码器已加载: {encoder_path}")

        # 加载VQ层（Codebook=16, embedding_dim=16）
        self.vq_layer = VectorQuantizer(num_embeddings=16, embedding_dim=16)
        vq_path = model_dir / "vq_layer_optimized.pth"

        if not vq_path.exists():
            raise FileNotFoundError(f"VQ层文件不存在: {vq_path}")

        self.vq_layer.load_state_dict(torch.load(vq_path, map_location=self.device, weights_only=True))
        self.vq_layer.to(self.device)
        self.vq_layer.eval()
        print(f"[INFO] VQ层已加载: {vq_path}")

        # 加载分类器（6分类，最优配置对应 input_dim=16, hidden_dim=128）
        self.classifier = FaultClassifier(input_dim=16, hidden_dim=128, num_classes=6)
        classifier_path = model_dir / "classifier_optimized.pth"

        if not classifier_path.exists():
            raise FileNotFoundError(f"分类器文件不存在: {classifier_path}")

        self.classifier.load_state_dict(torch.load(classifier_path, map_location=self.device, weights_only=True))
        self.classifier.to(self.device)
        self.classifier.eval()
        print(f"[INFO] 分类器已加载: {classifier_path}")

        # 加载归一化参数
        scaler_path = model_dir / "scaler_params.json"
        if scaler_path.exists():
            import json
            with open(scaler_path, 'r') as f:
                scaler_params = json.load(f)
                self.mean = np.array(scaler_params['mean'])
                self.std = np.array(scaler_params['scale'])
            print(f"[INFO] 归一化参数已从文件加载")
        else:
            # 使用默认参数（classData.csv 的统计值）
            self.mean = np.array([13.72, -44.85, 34.39, -0.0077, 0.0012, 0.0065])
            self.std = np.array([464.71, 439.24, 371.08, 0.289, 0.313, 0.308])
            print(f"[INFO] 使用默认归一化参数")

        # 故障类型名称
        self.fault_names = [
            '正常',
            '单相接地故障',
            '相间短路故障',
            '三相短路故障',
            '两相接地故障',
            '三相接地短路'
        ]
        print(f"[INFO] 模型推理引擎已启动 (6 分类模型, Optuna最优配置)")

    def normalize(self, features: np.ndarray) -> np.ndarray:
        """Z-score 归一化"""
        return (features - self.mean) / self.std

    def diagnose(self, features: List[float]) -> dict:
        """
        故障诊断

        Args:
            features: [Ia, Ib, Ic, Va, Vb, Vc] 六维特征

        Returns:
            诊断结果字典
        """
        import time
        start_time = time.time()

        # 1. 数据预处理
        features_array = np.array(features, dtype=np.float32)
        features_normalized = self.normalize(features_array)
        x = torch.tensor([features_normalized], dtype=torch.float32).to(self.device)

        # 2. 模型推理
        with torch.no_grad():
            # 编码器：提取连续表征
            z = self.encoder(x)

            # VQ层：量化为离散编码
            z_q, _, _, encoding_indices = self.vq_layer(z)

            # 分类器：故障分类
            logits = self.classifier(z_q)
            probs = torch.softmax(logits, dim=1)

            # 预测结果
            fault_type = torch.argmax(probs, dim=1).item()
            confidence = probs[0][fault_type].item()

        inference_time = (time.time() - start_time) * 1000  # 转换为毫秒

        return {
            'fault_type': fault_type,
            'confidence': confidence,
            'encoding_indices': encoding_indices.cpu().tolist(),
            'quantized_vector': [round(x, 6) for x in z_q[0].cpu().tolist()],
            'probabilities': probs[0].cpu().tolist(),
            'inference_time_ms': round(inference_time, 2)
        }

    def diagnose_batch(self, features_list: List[List[float]]) -> List[dict]:
        """
        批量诊断（向量化批推理）

        把所有样本拼成一个 [N, 6] 张量，只做一次前向完成 N 个样本的推理，
        相比 for 循环逐个调 diagnose()：
          - 权重矩阵只加载一次、被 N 个样本复用
          - 算子启动 / 内存搬运等固定开销只付一次
          - 底层矩阵库（GEMM）对 [N, 6] 的并行优化远好于 N 个 [1, 6]

        Args:
            features_list: N 个样本的六维特征，[[Ia,Ib,Ic,Va,Vb,Vc], ...]

        Returns:
            N 个诊断结果字典（字段与 diagnose 完全一致）
        """
        import time
        start_time = time.time()

        # 1. 数据预处理：所有样本拼成一个 [N, 6] 的 ndarray，整体向量化归一化
        #    注意 normalize 里 mean/std 是 float64，必须显式转回 float32 与模型权重匹配
        features_array = np.asarray(features_list, dtype=np.float32)     # [N, 6]
        features_normalized = self.normalize(features_array).astype(np.float32)  # [N, 6]
        x = torch.from_numpy(features_normalized).to(self.device)        # [N, 6]

        # 2. 模型推理：一次前向跑完 N 个样本（batch=N）
        with torch.no_grad():
            z = self.encoder(x)                                          # [N, 16]
            z_q, _, _, encoding_indices = self.vq_layer(z)               # [N, 16], [N]
            logits = self.classifier(z_q)                                # [N, 6]
            probs = torch.softmax(logits, dim=1)                         # [N, 6]
            fault_types = torch.argmax(probs, dim=1)                     # [N]
            # 逐样本取预测类别对应的置信度（等价于单条的 probs[0][fault_type]）
            confidences = probs[torch.arange(probs.size(0)), fault_types]

        inference_time = (time.time() - start_time) * 1000  # 整批总耗时(ms)

        # 3. 把 [N, ...] 张量拆成 N 条结果（与 diagnose 返回格式一致）
        quantized_np = z_q.cpu().numpy()
        prob_np = probs.cpu().numpy()
        idx_np = encoding_indices.cpu().numpy()
        ft_np = fault_types.cpu().numpy()
        conf_np = confidences.cpu().numpy()

        return [
            {
                'fault_type': int(ft_np[i]),
                'confidence': float(conf_np[i]),
                'encoding_indices': [int(idx_np[i])],
                'quantized_vector': [round(float(v), 6) for v in quantized_np[i]],
                'probabilities': [float(p) for p in prob_np[i]],
                'inference_time_ms': round(inference_time, 2)
            }
            for i in range(x.size(0))
        ]


# ==================== FastAPI 应用 ====================

app = FastAPI(
    title="向量量化模型推理服务",
    description="基于VQ的电网故障诊断模型推理服务",
    version="2.0.0"
)

# CORS 中间件（允许前端跨域访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局模型引擎
engine = None


@app.on_event("startup")
async def startup_event():
    """启动时加载模型"""
    global engine
    try:
        engine = ModelInferenceEngine()
        print("[INFO] 模型推理引擎已启动")
    except Exception as e:
        print(f"[ERROR] 模型加载失败: {e}")
        raise


@app.get("/", tags=["系统"], summary="服务根信息")
async def root():
    """健康检查"""
    return {
        "service": "向量量化模型推理服务",
        "status": "running",
        "version": "2.0.0",
        "model": "encoder_optimized.pth + vq_layer_optimized.pth + classifier_optimized.pth",
        "device": str(engine.device) if engine else "未加载"
    }


@app.get("/health", tags=["系统"], summary="健康检查")
async def health_check():
    """健康检查"""
    if engine is None:
        raise HTTPException(status_code=503, detail="模型未加载")
    return {"status": "healthy", "device": str(engine.device)}


@app.post("/reload", tags=["系统"], summary="热重载模型")
async def reload_model():
    """重新加载模型（用于训练完成后更新模型）"""
    global engine
    try:
        print("[INFO] 开始重新加载模型...")
        engine = ModelInferenceEngine()
        print("[INFO] 模型重新加载成功")
        return {
            "status": "success",
            "message": "模型已重新加载",
            "device": str(engine.device),
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"[ERROR] 模型重新加载失败: {e}")
        raise HTTPException(status_code=500, detail=f"模型重新加载失败: {str(e)}")


@app.post("/api/diagnose", response_model=DiagnosisResponse, tags=["诊断"], summary="单条故障诊断")
async def diagnose(request: DiagnosisRequest):
    """
    故障诊断接口

    请求示例:
    {
        "device_id": 1,
        "features": [27000, 28000, 26500, 105, 110, 108]
    }

    响应示例:
    {
        "device_id": 1,
        "fault_type": 1,
        "fault_type_name": "单相接地故障",
        "confidence": 0.9856,
        "encoding_indices": [11],
        "quantized_vector": [0.1234, -0.0567, 0.2041, -0.1188, 0.0912, -0.0345, 0.2211, -0.1477, 0.0532, 0.1844, -0.0721, 0.0165, -0.2033, 0.0976, -0.0411, 0.1328],
        "probabilities": [0.0012, 0.9856, 0.0045, 0.0032, 0.0028, 0.0027],
        "inference_time_ms": 1.23,
        "timestamp": "2026-03-14 16:30:00"
    }
    """
    if engine is None:
        raise HTTPException(status_code=503, detail="模型未加载")

    # 验证特征维度
    if len(request.features) != 6:
        raise HTTPException(
            status_code=400,
            detail=f"特征维度错误：期望 6 维，实际 {len(request.features)} 维"
        )

    try:
        # 模型推理
        result = engine.diagnose(request.features)

        # 故障类型映射（6 分类）
        fault_type_names = {
            0: "正常",
            1: "单相接地故障",
            2: "相间短路故障",
            3: "三相短路故障",
            4: "两相接地故障",
            5: "三相接地短路"
        }

        return DiagnosisResponse(
            device_id=request.device_id,
            fault_type=result['fault_type'],
            fault_type_name=fault_type_names.get(result['fault_type'], "未知故障"),
            confidence=round(result['confidence'], 4),
            encoding_indices=result['encoding_indices'],
            quantized_vector=result['quantized_vector'],
            probabilities=[round(x, 4) for x in result['probabilities']],
            inference_time_ms=result['inference_time_ms'],
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"诊断失败: {str(e)}")


@app.post("/api/batch_diagnose", tags=["诊断"], summary="批量故障诊断（向量化批推理）")
async def batch_diagnose(requests: List[DiagnosisRequest]):
    """批量诊断接口"""
    if engine is None:
        raise HTTPException(status_code=503, detail="模型未加载")

    fault_type_names = {
        0: "正常",
        1: "单相接地故障",
        2: "相间短路故障",
        3: "三相短路故障",
        4: "两相接地故障",
        5: "三相接地短路"
    }

    # 先做维度校验：非法样本单独标记 error，不拖垮整批（保持"单条失败不影响整批"语义）
    valid_reqs = []
    invalid_results = []
    for req in requests:
        if len(req.features) != 6:
            invalid_results.append({
                "device_id": req.device_id,
                "error": f"特征维度错误：期望 6 维，实际 {len(req.features)} 维"
            })
        else:
            valid_reqs.append(req)

    try:
        # 向量化批推理：合法样本拼成一个 [N,6] 张量，一次前向完成
        batch_results = engine.diagnose_batch([req.features for req in valid_reqs])
        results = invalid_results + [
            {
                "device_id": req.device_id,
                "fault_type": r['fault_type'],
                "fault_type_name": fault_type_names.get(r['fault_type'], "未知故障"),
                "confidence": round(r['confidence'], 4),
                "encoding_indices": r['encoding_indices'],
                "quantized_vector": r['quantized_vector'],
                "probabilities": [round(p, 4) for p in r['probabilities']],
                "inference_time_ms": r['inference_time_ms']
            }
            for req, r in zip(valid_reqs, batch_results)
        ]
        return {"results": results, "total": len(results)}
    except Exception as e:
        # 整批前向失败：全部按 error 返回（不抛出，与旧行为一致）
        return {
            "results": [{"device_id": req.device_id, "error": str(e)} for req in requests],
            "total": len(requests)
        }


# ==================== 主函数 ====================

if __name__ == "__main__":
    print("=" * 70)
    print("Node IDs 模型推理服务")
    print("=" * 70)
    print(f"启动时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"模型路径: data_new/models/fault_6class/")
    print(f"服务地址: http://localhost:8000")
    print(f"API 文档: http://localhost:8000/docs")
    print("=" * 70)

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )

