# -*- coding: utf-8 -*-
"""
压测驱动 v4：并发阶梯 10/30/60/100
locust --json 顶层是接口 stats 数组；response_times 键是字符串，转数字后自算百分位。
"""
import subprocess, json, sys, io, os
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

PY = r'C:\Users\gjy\.conda\envs\smart-grid\python.exe'
os.chdir(r'D:\learned\idea\xiangmu\bishe\algorithm')

CONCURRENCY = [10, 30, 60, 100]
DURATION = '15s'


def percentile(response_times, p):
    """从 {ms(str): count} 直方图算第 p 百分位响应时间（键转数字后排序）"""
    items = sorted((int(float(ms)), cnt) for ms, cnt in response_times.items())
    total = sum(response_times.values())
    if total == 0:
        return 0
    target = total * p
    acc = 0
    for ms, cnt in items:
        acc += cnt
        if acc >= target:
            return ms
    return items[-1][0]


def run_once(users):
    cmd = [PY, '-m', 'locust', '-f', 'load_test_stress.py',
           '--host', 'http://localhost:8000',
           '--headless', '-u', str(users), '-r', str(users), '-t', DURATION, '--json']
    p = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    out = p.stdout
    start = out.find('[')
    if start < 0:
        print(f'[并发{users}] 无 JSON 数组输出')
        return None
    try:
        arr, _ = json.JSONDecoder().raw_decode(out[start:])
    except Exception as e:
        print(f'[并发{users}] JSON 解析失败: {e}')
        return None
    if not arr:
        print(f'[并发{users}] 空统计')
        return None
    total_reqs = sum(s.get('num_requests', 0) for s in arr)
    total_fails = sum(s.get('num_failures', 0) for s in arr)
    total_rt = sum(s.get('total_response_time', 0) for s in arr)
    merged = {}
    for s in arr:
        for ms, cnt in (s.get('response_times') or {}).items():
            merged[ms] = merged.get(ms, 0) + cnt
    per_sec = []
    for s in arr:
        per_sec += s.get('num_reqs_per_sec') or []
    secs = max(len(per_sec), 1)
    return {
        'users': users,
        'reqs': total_reqs,
        'fails': total_fails,
        'rps': round(total_reqs / secs, 2),
        'avg_ms': round(total_rt / total_reqs, 1) if total_reqs else 0,
        'p50': percentile(merged, 0.50),
        'p95': percentile(merged, 0.95),
        'p99': percentile(merged, 0.99),
    }


rows = []
for u in CONCURRENCY:
    print(f'>>> 压测并发 {u} ...')
    r = run_once(u)
    if r:
        rows.append(r)
        err = 100.0 * r['fails'] / r['reqs'] if r['reqs'] else 0
        print(f'    完成: {r["reqs"]} 请求, RPS={r["rps"]}, avg={r["avg_ms"]}ms, '
              f'P50={r["p50"]}ms, P95={r["p95"]}ms, P99={r["p99"]}ms, 错误率={err:.2f}%')

print()
print('=' * 90)
print(f'{"并发":>6} | {"请求数":>7} | {"RPS":>8} | {"平均ms":>7} | {"P50":>6} | {"P95":>6} | {"P99":>7} | {"错误率":>7}')
print('-' * 90)
for r in rows:
    err = 100.0 * r['fails'] / r['reqs'] if r['reqs'] else 0
    print(f'{r["users"]:>6} | {r["reqs"]:>7} | {r["rps"]:>8} | {r["avg_ms"]:>7} | '
          f'{r["p50"]:>6} | {r["p95"]:>6} | {r["p99"]:>7} | {err:>6.2f}%')
print('=' * 90)
