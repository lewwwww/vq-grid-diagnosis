# -*- coding: utf-8 -*-
"""
单条推理 vs 批量（向量化）推理耗时对比 benchmark

对比对象（同一引擎、同一批真实样本）：
  - 逐条：for 循环逐个调 engine.diagnose()   （旧实现）
  - 批量：一次调 engine.diagnose_batch()      （新实现，[N,6] 一次前向）

用法（在项目根或任意目录运行均可，脚本会 chdir 到项目根）：
  C:/Users/gjy/.conda/envs/smart-grid/python.exe algorithm/benchmark_inference.py
"""
import os
import sys
import time
import csv
import statistics

PROJ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # bishe 根
os.chdir(PROJ)
sys.path.insert(0, os.path.join(PROJ, 'algorithm'))

from model_inference_service import ModelInferenceEngine  # noqa: E402


def load_samples(csv_path, max_rows=200):
    """从 classData.csv 读取真实样本，返回 [ [Ia,Ib,Ic,Va,Vb,Vc], ... ]"""
    samples = []
    with open(csv_path, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if len(samples) >= max_rows:
                break
            try:
                samples.append([
                    float(row['Ia']), float(row['Ib']), float(row['Ic']),
                    float(row['Va']), float(row['Vb']), float(row['Vc'])
                ])
            except (ValueError, KeyError):
                continue
    return samples


def bench(engine, samples, repeats=30):
    """对一组样本测两种方式的耗时，返回 (逐条总耗时中位数ms, 批量总耗时中位数ms)"""
    # 预热（让 CPU 算子/缓存进入稳态）
    for _ in range(3):
        engine.diagnose(samples[0])
        engine.diagnose_batch(samples)

    single_times, batch_times = [], []
    for _ in range(repeats):
        # 逐条：N 次 diagnose，累计
        t0 = time.perf_counter()
        for s in samples:
            engine.diagnose(s)
        single_times.append((time.perf_counter() - t0) * 1000)

        # 批量：一次 diagnose_batch
        t0 = time.perf_counter()
        engine.diagnose_batch(samples)
        batch_times.append((time.perf_counter() - t0) * 1000)

    return statistics.median(single_times), statistics.median(batch_times)


def main():
    print("=" * 78)
    print("单条推理 vs 批量（向量化）推理耗时对比")
    print("设备:", engine.device, "| torch 线程:", torch.get_num_threads())
    print("=" * 78)

    csv_path = os.path.join(PROJ, 'data_new', 'kaggle', 'classData.csv')
    all_samples = load_samples(csv_path)
    print(f"已加载真实样本 {len(all_samples)} 条: {csv_path}")

    ns = [1, 4, 8, 16, 32, 64, 128]
    header = (f"{'样本数N':>6} | {'逐条总耗时(ms)':>16} | {'批量总耗时(ms)':>16} | "
              f"{'加速比':>6} | {'逐条均摊/样本(ms)':>16} | {'批量均摊/样本(ms)':>16}")
    print(header)
    print("-" * 78)

    rows = []
    for n in ns:
        samples = all_samples[:n]
        s_t, b_t = bench(engine, samples)
        speedup = s_t / b_t if b_t > 0 else float('inf')
        per_single = s_t / n
        per_batch = b_t / n
        rows.append((n, s_t, b_t, speedup, per_single, per_batch))
        print(f"{n:>6} | {s_t:>16.2f} | {b_t:>16.2f} | {speedup:>5.2f}x | "
              f"{per_single:>16.3f} | {per_batch:>16.3f}")

    print("-" * 78)
    print("注：加速比 = 逐条总耗时 / 批量总耗时；均摊/样本 = 总耗时 / N（越小越快）")


if __name__ == "__main__":
    import torch
    engine = ModelInferenceEngine()
    main()
