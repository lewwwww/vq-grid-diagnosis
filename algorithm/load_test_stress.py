# -*- coding: utf-8 -*-
"""
压力测试脚本（locust）：测系统真实上限

与 load_test.py（模拟真人操作间隔）不同：
    - wait_time = 0：用户无间隔疯狂发请求，把系统打满
    - 纯批量场景：/api/batch_diagnose N=10（前端主要路径）

由 load_stress_driver.py 循环调用，自动收集 10/30/60/100 档并发数据。
"""
from locust import HttpUser, task, events

FEATURES = [27000.0, 28000.0, 26500.0, 105.0, 110.0, 108.0]
BATCH_SIZE = 10


@events.test_stop.add_listener
def on_test_stop(environment, **kw):
    """测试结束时用 locust 官方 API 输出聚合统计（百分位由 locust 自身计算，可靠）"""
    total = environment.stats.total
    if total is None:
        return
    pcts = dict(total.get_response_time_percentiles())
    print(
        f'[RESULT] reqs={total.num_requests} fails={total.num_failures} '
        f'rps={total.total_rps:.2f} avg={total.avg_response_time:.1f} '
        f'p50={pcts.get(50, 0):.1f} p95={pcts.get(95, 0):.1f} '
        f'p99={pcts.get(99, 0):.1f} p999={pcts.get(99.9, 0):.1f}'
    )


class StressUser(HttpUser):
    wait_time = lambda self: 0  # 无操作间隔，疯狂打满

    @task
    def batch_diagnose(self):
        reqs = [
            {"device_id": i, "features": FEATURES}
            for i in range(BATCH_SIZE)
        ]
        self.client.post("/api/batch_diagnose", json=reqs)
