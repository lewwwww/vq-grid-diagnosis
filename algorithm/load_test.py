# -*- coding: utf-8 -*-
"""
HTTP 接口压测脚本（locust）

运行方式（FastAPI 服务需已启动在 8000 端口）：
    python -m locust -f load_test.py --host http://localhost:8000 --headless -u 20 -r 5 -t 30s

参数说明：
    -u 20  模拟 20 个并发用户
    -r 5   每秒启动 5 个用户（逐步加压）
    -t 30s 持续压 30 秒

场景设计（模拟前端真实用法）：
    权重 3：批量诊断 /api/batch_diagnose（前端默认一次送 N 条）
    权重 1：单条诊断 /api/diagnose
"""
from locust import HttpUser, task, between

# 真实电网数据风格的 6 维特征 [Ia, Ib, Ic, Va, Vb, Vc]
FEATURES = [27000.0, 28000.0, 26500.0, 105.0, 110.0, 108.0]

# 前端默认批量场景：一次送 10 条
BATCH_SIZE = 10


class DiagnosisUser(HttpUser):
    wait_time = between(0.5, 1.5)  # 两次请求间随机等 0.5~1.5 秒，模拟真人操作间隔

    @task(3)  # 权重 3：主要场景 = 批量诊断（前端默认）
    def batch_diagnose(self):
        reqs = [
            {"device_id": i, "features": FEATURES}
            for i in range(BATCH_SIZE)
        ]
        self.client.post("/api/batch_diagnose", json=reqs)

    @task(1)  # 权重 1：次要场景 = 单条诊断
    def single_diagnose(self):
        self.client.post("/api/diagnose", json={"device_id": 1, "features": FEATURES})
