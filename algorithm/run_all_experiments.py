"""
run_all_experiments.py
逐个运行论文实验，结果合并保存到 data_new/models/experiment_results.json

实验B：压缩维度消融 comp=8/10/12/16 (fixed hidden=256) -> 表5（含表3/4主模型）
实验C：量化位数消融 codebook=4/16/256 (fixed hidden=256,comp=16) -> 表6
实验D：对比实验 1D-CNN / LSTM / 标准MLP(hidden=256) -> 表7

运行方式（逐个）：
  python algorithm/run_all_experiments.py --exp b
  python algorithm/run_all_experiments.py --exp c
  python algorithm/run_all_experiments.py --exp d
  python algorithm/run_all_experiments.py --exp all   # 全部一次跑完
"""

import sys
import os
import json
import time
import argparse
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
from sklearn.metrics import (
    accuracy_score, classification_report,
    confusion_matrix, precision_recall_fscore_support
)

if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', line_buffering=True)

sys.path.append(str(Path(__file__).parent))
from train_6class_model import (
    load_and_preprocess_data, train_model, NodeIDsEncoder,
    VectorQuantizer, FaultClassifier
)
from train_baseline_models import (
    train_model as train_baseline,
    evaluate_model as evaluate_baseline
)
from baseline_models import CNN1D, LSTMModel, StandardMLP

# ── 全局配置 ──────────────────────────────────────────────
DATA_PATH    = 'data_new/kaggle/classData.csv'
OUTPUT_PATH  = 'data_new/models/experiment_results.json'
RANDOM_STATE = 42
LABEL_NAMES  = ['正常', '单相接地', '相间短路', '三相短路', '两相接地', '三相接地短路']

# Optuna 最优超参数
BEST = dict(hidden_dim=256, compressed_dim=16,
            dropout=0.143, lr=0.00141, weight_decay=3.86e-5, batch_size=32)

# ── 工具函数 ──────────────────────────────────────────────
def measure_inference_time(fn, n=1000):
    """单样本推理时间(ms)，重复 n 次取均值"""
    times = []
    for _ in range(n):
        t0 = time.perf_counter()
        fn()
        times.append((time.perf_counter() - t0) * 1000)
    return float(np.mean(times))


def model_size_mb(*state_dicts):
    """把模型权重写到内存，统计大小(MB)"""
    import io as _io
    total = 0
    for sd in state_dicts:
        buf = _io.BytesIO()
        torch.save(sd, buf)
        total += buf.tell()
    return round(total / 1024 / 1024, 3)


def eval_vqmlp(encoder, vq, clf, X_test, y_test, device):
    """VQ-MLP 详细评估，返回 dict"""
    encoder.eval(); vq.eval(); clf.eval()
    Xt = torch.FloatTensor(X_test).to(device)
    yt = torch.LongTensor(y_test).to(device)

    with torch.no_grad():
        z    = encoder(Xt)
        z_q, _, _, _ = vq(z)
        logits = clf(z_q)
        preds  = logits.argmax(1).cpu().numpy()

    # 单样本推理时间
    x1 = Xt[:1]
    def _fn():
        with torch.no_grad():
            encoder(x1); vq(encoder(x1)); clf(vq(encoder(x1))[0])
    infer_ms = measure_inference_time(_fn)

    acc = accuracy_score(y_test, preds)
    report = classification_report(
        y_test, preds, target_names=LABEL_NAMES, digits=4, output_dict=True,
        zero_division=0
    )
    cm = confusion_matrix(y_test, preds).tolist()
    macro_p  = report['macro avg']['precision']
    macro_r  = report['macro avg']['recall']
    macro_f1 = report['macro avg']['f1-score']
    size_mb  = model_size_mb(encoder.state_dict(), vq.state_dict(), clf.state_dict())

    return dict(
        accuracy=round(float(acc)*100, 2),
        macro_precision=round(macro_p*100, 2),
        macro_recall=round(macro_r*100, 2),
        macro_f1=round(macro_f1*100, 2),
        inference_ms=round(infer_ms, 4),
        model_size_mb=size_mb,
        per_class={name: {
            'precision': round(report[name]['precision']*100, 2),
            'recall':    round(report[name]['recall']*100, 2),
            'f1':        round(report[name]['f1-score']*100, 2),
            'support':   int(report[name]['support'])
        } for name in LABEL_NAMES},
        confusion_matrix=cm
    )


def train_vqmlp(X_train, y_train, X_val, y_val, device,
                hidden_dim, compressed_dim, num_embeddings=16,
                dropout=BEST['dropout'], lr=BEST['lr'],
                weight_decay=BEST['weight_decay'], batch_size=BEST['batch_size']):
    """训练 VQ-MLP，返回 encoder, vq, classifier"""
    return train_model(
        X_train, y_train, X_val, y_val, device,
        hidden_dim=hidden_dim,
        compressed_dim=compressed_dim,
        num_embeddings=num_embeddings,
        dropout=dropout,
        learning_rate=lr,
        weight_decay=weight_decay,
        batch_size=batch_size,
        num_epochs=100,
        patience=20,
        verbose=False
    )


N_RUNS = 3   # 每个配置训练次数


def avg_results(res_list):
    """对多次运行结果取均值，per_class 各指标分别平均，confusion_matrix 累加"""
    keys = ['accuracy', 'macro_precision', 'macro_recall', 'macro_f1', 'inference_ms']
    avg = {}
    for k in keys:
        avg[k] = round(float(np.mean([r[k] for r in res_list])), 2)
    avg['model_size_mb'] = res_list[0]['model_size_mb']  # 大小不变
    # per_class
    avg['per_class'] = {}
    for name in LABEL_NAMES:
        avg['per_class'][name] = {}
        for m in ['precision', 'recall', 'f1']:
            avg['per_class'][name][m] = round(
                float(np.mean([r['per_class'][name][m] for r in res_list])), 2
            )
        avg['per_class'][name]['support'] = res_list[0]['per_class'][name]['support']
    # confusion_matrix：取最后一次（或取均值取整）
    cm = np.round(np.mean([np.array(r['confusion_matrix']) for r in res_list], axis=0)).astype(int)
    avg['confusion_matrix'] = cm.tolist()
    # 附带各次准确率列表，方便检查稳定性
    avg['all_run_accuracies'] = [r['accuracy'] for r in res_list]
    avg['accuracy_std'] = round(float(np.std([r['accuracy'] for r in res_list])), 2)
    return avg


# ── 实验B：压缩维度消融 ──────────────────────────────────
def experiment_b_compressed_dim(X_train, y_train, X_val, y_val, X_test, y_test, device):
    """表5：不同压缩维度 comp=8/10/12/16 (fixed hidden=256)，每配置训练N_RUNS次取均值"""
    print(f"\n{'='*70}", flush=True)
    print(f"实验B：压缩维度消融 (hidden=256, comp=8/10/12/16, 每配置{N_RUNS}次)", flush=True)
    print(f"{'='*70}", flush=True)

    results = {}
    for comp in [8, 10, 12, 16]:
        run_res = []
        for i in range(N_RUNS):
            print(f"\n  comp={comp} 第{i+1}/{N_RUNS}次...", flush=True)
            enc, vq, clf = train_vqmlp(
                X_train, y_train, X_val, y_val, device,
                hidden_dim=256, compressed_dim=comp, num_embeddings=16
            )
            res = eval_vqmlp(enc, vq, clf, X_test, y_test, device)
            run_res.append(res)
            print(f"    准确率={res['accuracy']:.2f}%", flush=True)
        avg = avg_results(run_res)
        results[f'comp_{comp}'] = avg
        print(f"  comp={comp} 均值: 准确率={avg['accuracy']:.2f}% ±{avg['accuracy_std']:.2f}%", flush=True)

    return results


# ── 实验C：量化位数消融 ──────────────────────────────────
def experiment_c_quantization_bits(X_train, y_train, X_val, y_val, X_test, y_test, device):
    """表6：不同量化位数 codebook=4/16/256 (fixed hidden=256,comp=16)，每配置训练N_RUNS次取均值"""
    print(f"\n{'='*70}", flush=True)
    print(f"实验C：量化位数消融 (hidden=256, comp=16, codebook=4/16/256, 每配置{N_RUNS}次)", flush=True)
    print(f"{'='*70}", flush=True)

    results = {}
    for bits, codebook in [('int2', 4), ('int4', 16), ('int8', 256)]:
        run_res = []
        for i in range(N_RUNS):
            print(f"\n  {bits}(codebook={codebook}) 第{i+1}/{N_RUNS}次...", flush=True)
            enc, vq, clf = train_vqmlp(
                X_train, y_train, X_val, y_val, device,
                hidden_dim=256, compressed_dim=16, num_embeddings=codebook
            )
            res = eval_vqmlp(enc, vq, clf, X_test, y_test, device)
            run_res.append(res)
            print(f"    准确率={res['accuracy']:.2f}%", flush=True)
        avg = avg_results(run_res)
        results[bits] = avg
        print(f"  {bits} 均值: 准确率={avg['accuracy']:.2f}% ±{avg['accuracy_std']:.2f}%", flush=True)

    return results


# ── 实验D：对比实验 ──────────────────────────────────────
def experiment_d_baselines(X_train, y_train, X_val, y_val, X_test, y_test, device):
    """表7：1D-CNN / LSTM / 标准MLP vs VQ-MLP，每模型训练N_RUNS次取均值"""
    print(f"\n{'='*70}", flush=True)
    print(f"实验D：对比实验 (1D-CNN / LSTM / 标准MLP, 每模型{N_RUNS}次)", flush=True)
    print(f"{'='*70}", flush=True)

    results = {}

    for model_key, model_name, make_model in [
        ('cnn',  '1D-CNN',      lambda: CNN1D(input_dim=6, num_classes=6, dropout=BEST['dropout']).to(device)),
        ('lstm', 'LSTM',        lambda: LSTMModel(input_dim=6, hidden_dim=128, num_layers=2, num_classes=6, dropout=BEST['dropout']).to(device)),
        ('mlp',  '标准MLP',     lambda: StandardMLP(input_dim=6, hidden_dim=256, num_classes=6, dropout=BEST['dropout']).to(device)),
    ]:
        accs, f1s, infer_ms_list = [], [], []
        for i in range(N_RUNS):
            print(f"\n  {model_name} 第{i+1}/{N_RUNS}次...", flush=True)
            m = make_model()
            m = train_baseline(m, X_train, y_train, X_val, y_val, device, model_name,
                               num_epochs=100, batch_size=BEST['batch_size'],
                               learning_rate=BEST['lr'], patience=20)
            r = evaluate_baseline(m, X_test, y_test, device)
            accs.append(r['accuracy'] * 100)
            f1s.append(r['f1'] * 100)
            infer_ms_list.append(r['inference_time_ms'])
            print(f"    准确率={r['accuracy']*100:.2f}%", flush=True)
        results[model_key] = dict(
            accuracy=round(float(np.mean(accs)), 2),
            accuracy_std=round(float(np.std(accs)), 2),
            f1=round(float(np.mean(f1s)), 2),
            inference_ms=round(float(np.mean(infer_ms_list)), 4),
            model_size_mb=model_size_mb(m.state_dict()),
            all_run_accuracies=accs
        )
        print(f"  {model_name} 均值: 准确率={results[model_key]['accuracy']:.2f}% ±{results[model_key]['accuracy_std']:.2f}%", flush=True)

    return results


# ── 打印论文用表格 ────────────────────────────────────────
def print_tables(results):
    b = results['experiment_b']
    c = results['experiment_c']
    d = results['experiment_d']
    main_res = b['comp_16']  # 实验A从B的comp=16取

    print(f"\n{'='*70}")
    print("表3 模型整体性能指标")
    print(f"{'='*70}")
    print(f"测试准确率     : {main_res['accuracy']}%")
    print(f"宏平均精确率   : {main_res['macro_precision']}%")
    print(f"宏平均召回率   : {main_res['macro_recall']}%")
    print(f"宏平均F1       : {main_res['macro_f1']}%")
    print(f"推理时间       : {main_res['inference_ms']}ms")
    print(f"模型大小       : {main_res['model_size_mb']}MB")

    print(f"\n{'='*70}")
    print("表4 各类别性能指标")
    print(f"{'='*70}")
    print(f"{'故障类型':<12} {'精确率':>8} {'召回率':>8} {'F1':>8} {'样本数':>8}")
    for name in LABEL_NAMES:
        p = main_res['per_class'][name]
        print(f"{name:<12} {p['precision']:>7.2f}% {p['recall']:>7.2f}% {p['f1']:>7.2f}% {p['support']:>8}")

    print(f"\n{'='*70}")
    print("表5 不同压缩维度实验结果")
    print(f"{'='*70}")
    print(f"{'压缩维度':>8} {'准确率':>10} {'模型大小':>10} {'三相接地短路召回率':>18}")
    for comp in [8, 10, 12, 16]:
        r = b[f'comp_{comp}']
        r5 = r['per_class']['三相接地短路']['recall']
        print(f"{comp:>8} {r['accuracy']:>9.2f}% {r['model_size_mb']:>9.3f}MB {r5:>17.2f}%")

    print(f"\n{'='*70}")
    print("表6 不同量化位数实验结果")
    print(f"{'='*70}")
    print(f"{'量化位数':>8} {'Codebook':>10} {'准确率':>10} {'模型大小':>10}")
    for bits, codebook in [('int2', 4), ('int4', 16), ('int8', 256)]:
        r = c[bits]
        print(f"{bits:>8} {codebook:>10} {r['accuracy']:>9.2f}% {r['model_size_mb']:>9.3f}MB")

    vq = main_res
    print(f"\n{'='*70}")
    print("表7 对比实验结果")
    print(f"{'='*70}")
    print(f"{'模型':<12} {'准确率':>10} {'推理时间':>10} {'模型大小':>10}")
    print(f"{'1D-CNN':<12} {d['cnn']['accuracy']:>9.2f}% {d['cnn']['inference_ms']:>9.4f}ms {d['cnn']['model_size_mb']:>9.3f}MB")
    print(f"{'LSTM':<12} {d['lstm']['accuracy']:>9.2f}% {d['lstm']['inference_ms']:>9.4f}ms {d['lstm']['model_size_mb']:>9.3f}MB")
    print(f"{'标准MLP':<12} {d['mlp']['accuracy']:>9.2f}% {d['mlp']['inference_ms']:>9.4f}ms {d['mlp']['model_size_mb']:>9.3f}MB")
    print(f"{'VQ-MLP(本文)':<12} {vq['accuracy']:>9.2f}% {vq['inference_ms']:>9.4f}ms {vq['model_size_mb']:>9.3f}MB")


# ── 主流程 ────────────────────────────────────────────────
def load_existing_results():
    """加载已有的实验结果，不存在则返回空字典"""
    out = Path(OUTPUT_PATH)
    if out.exists():
        with open(out, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}


def save_results(results):
    out = Path(OUTPUT_PATH)
    out.parent.mkdir(parents=True, exist_ok=True)
    with open(out, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n结果已保存: {out}", flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--exp', type=str, default='all',
                        choices=['b', 'c', 'd', 'all'],
                        help='b=压缩维度消融  c=量化位数消融  d=对比实验  all=全部')
    args = parser.parse_args()

    torch.manual_seed(RANDOM_STATE)
    np.random.seed(RANDOM_STATE)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"设备: {device}", flush=True)
    print(f"运行实验: {args.exp}", flush=True)
    print(f"最优参数: hidden={BEST['hidden_dim']}, comp={BEST['compressed_dim']}, "
          f"dropout={BEST['dropout']:.3f}, lr={BEST['lr']:.5f}, bs={BEST['batch_size']}",
          flush=True)

    # 数据：所有实验共用同一套分割
    X_train, X_val, X_test, y_train, y_val, y_test, _ = load_and_preprocess_data(
        DATA_PATH, test_size=0.15, val_size=0.15, random_state=RANDOM_STATE
    )

    # 加载已有结果（支持分次运行）
    results = load_existing_results()

    if args.exp in ('b', 'all'):
        results['experiment_b'] = experiment_b_compressed_dim(
            X_train, y_train, X_val, y_val, X_test, y_test, device
        )
        save_results(results)

    if args.exp in ('c', 'all'):
        results['experiment_c'] = experiment_c_quantization_bits(
            X_train, y_train, X_val, y_val, X_test, y_test, device
        )
        save_results(results)

    if args.exp in ('d', 'all'):
        results['experiment_d'] = experiment_d_baselines(
            X_train, y_train, X_val, y_val, X_test, y_test, device
        )
        save_results(results)

    # 只有三组都完成才打印汇总表
    if all(k in results for k in ('experiment_b', 'experiment_c', 'experiment_d')):
        print_tables(results)

    print(f"\n{'='*70}", flush=True)
    print(f"实验 {args.exp} 完成", flush=True)
    print(f"{'='*70}", flush=True)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        import traceback
        print(f"\n出错: {e}", flush=True)
        traceback.print_exc()
        sys.exit(1)

