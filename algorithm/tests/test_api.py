# -*- coding: utf-8 -*-
"""
接口单元测试（pytest）

运行方式（在 algorithm 目录下）：
    python -m pytest tests/test_api.py -v

覆盖（对齐"正常输入 / 边界 / 异常分支 / 返回值"四个测试要点）：
    1. 健康检查正常返回
    2. 单条诊断：正常输入
    3. 单条诊断：特征维度错误（异常分支 → 400）
    4. 批量诊断：多个合法样本
    5. 批量诊断：混入非法样本（单条失败不影响整批）
    6. 回归：批量结果 == 单条结果（向量化批推理不改变正确性）
"""
import pytest
from fastapi.testclient import TestClient
from model_inference_service import app


@pytest.fixture(scope="module")
def client():
    """测试客户端：with 进入时触发 startup 事件（加载模型一次），模块内所有测试共用"""
    with TestClient(app) as c:
        yield c


# 一个合法 6 维样本 [Ia, Ib, Ic, Va, Vb, Vc]，来自真实电网数据风格
GOOD = {"device_id": 1, "features": [27000.0, 28000.0, 26500.0, 105.0, 110.0, 108.0]}


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"


def test_diagnose_normal(client):
    resp = client.post("/api/diagnose", json=GOOD)
    assert resp.status_code == 200
    data = resp.json()
    assert data["device_id"] == 1
    assert 0 <= data["fault_type"] <= 5            # 故障类型在合法范围内
    assert 0.0 <= data["confidence"] <= 1.0        # 置信度是 0~1 的概率
    assert len(data["encoding_indices"]) == 1      # VQ 离散索引长度 1
    assert len(data["probabilities"]) == 6         # 6 分类概率
    assert data["inference_time_ms"] > 0           # 推理耗时为正


def test_diagnose_wrong_dim(client):
    bad = {"device_id": 2, "features": [1.0, 2.0, 3.0, 4.0, 5.0]}  # 只有 5 维，应被拒绝
    resp = client.post("/api/diagnose", json=bad)
    assert resp.status_code == 400
    assert "特征维度" in resp.json()["detail"]


def test_batch_diagnose_normal(client):
    reqs = [
        {"device_id": 1, "features": [27000.0, 28000.0, 26500.0, 105.0, 110.0, 108.0]},
        {"device_id": 2, "features": [24000.0, 25000.0, 24500.0, 101.0, 102.0, 100.0]},
        {"device_id": 3, "features": [29000.0, 30000.0, 29500.0, 115.0, 120.0, 118.0]},
    ]
    resp = client.post("/api/batch_diagnose", json=reqs)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert len(data["results"]) == 3
    for r in data["results"]:
        assert "fault_type" in r   # 每条都有诊断结果，不是 error


def test_batch_diagnose_mixed(client):
    """混入一个非法样本：合法条正常返回、非法条给 error，单条失败不影响整批"""
    reqs = [
        {"device_id": 1, "features": [27000.0, 28000.0, 26500.0, 105.0, 110.0, 108.0]},
        {"device_id": 2, "features": [1.0, 2.0, 3.0]},  # 非法：只有 3 维
    ]
    resp = client.post("/api/batch_diagnose", json=reqs)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    ok = [r for r in data["results"] if "fault_type" in r]
    err = [r for r in data["results"] if "error" in r]
    assert len(ok) == 1
    assert len(err) == 1
    assert "特征维度" in err[0]["error"]


def test_batch_equals_single(client):
    """回归：批量推理结果必须和单条推理完全一致（向量化批推理不改变正确性）"""
    single = client.post("/api/diagnose", json=GOOD).json()
    batch = client.post("/api/batch_diagnose", json=[GOOD]).json()
    b0 = batch["results"][0]
    assert b0["fault_type"] == single["fault_type"]
    assert b0["confidence"] == single["confidence"]
    assert b0["encoding_indices"] == single["encoding_indices"]
