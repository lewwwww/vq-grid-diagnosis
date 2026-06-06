"""
离线超参数优化脚本 (algorithm/optimize_hyperparameters.py)

正确流程：
  1. 数据三分割：训练集70% / 验证集15% / 测试集15%
  2. Optuna在 训练集+验证集 上搜索，目标=验证集准确率
     ★ 测试集在整个搜索过程中严格隔离，绝不参与任何 trial
  3. 搜索完成后，用最优参数重新训练一次最终模型
  4. 只在最后对测试集做一次最终评估，记录测试准确率
  5. 所有结果保存到 optimization_result.json

运行示例（conda bishe 环境，在项目根目录执行）：
  python algorithm/optimize_hyperparameters.py --n_trials 100
"""

import argparse
import json
import sys
import os
from pathlib import Path
import numpy as np
import torch
import optuna
from optuna.trial import Trial
from datetime import datetime
from sklearn.metrics import classification_report, accuracy_score

# Windows UTF-8
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

sys.path.append(str(Path(__file__).parent))
from train_6class_model import load_and_preprocess_data, train_model, evaluate_model


# ──────────────────────────────────────────────
# Optuna 目标函数：只用验证集，绝不碰测试集
# ──────────────────────────────────────────────
def objective(trial: Trial, X_train, y_train, X_val, y_val, device):
    """目标函数：返回验证集准确率（最大化）"""

    hidden_dim      = trial.suggest_categorical('hidden_dim',      [64, 128, 256])
    compressed_dim  = trial.suggest_categorical('compressed_dim',  [8, 10, 12, 16])
    dropout         = trial.suggest_float('dropout',        0.0, 0.3)
    learning_rate   = trial.suggest_float('learning_rate',  1e-4, 1e-2, log=True)
    weight_decay    = trial.suggest_float('weight_decay',   1e-5, 1e-3, log=True)
    batch_size      = trial.suggest_categorical('batch_size', [32, 64, 128])

    print(f"\n[Trial {trial.number+1}] "
          f"hid={hidden_dim} comp={compressed_dim} "
          f"do={dropout:.3f} lr={learning_rate:.5f} "
          f"wd={weight_decay:.6f} bs={batch_size}", flush=True)

    try:
        encoder, vq_layer, classifier = train_model(
            X_train, y_train, X_val, y_val, device,
            hidden_dim=hidden_dim,
            compressed_dim=compressed_dim,
            dropout=dropout,
            learning_rate=learning_rate,
            weight_decay=weight_decay,
            batch_size=batch_size,
            num_epochs=80,
            patience=15,
            verbose=False
        )

        # ── 在验证集上评估 ──
        encoder.eval(); vq_layer.eval(); classifier.eval()
        with torch.no_grad():
            Xv = torch.FloatTensor(X_val).to(device)
            yv = torch.LongTensor(y_val).to(device)
            z  = encoder(Xv)
            z_q, _, _, _ = vq_layer(z)   # 返回4个值: z_q, vq_loss, perplexity, encoding_indices
            logits = classifier(z_q)
            preds  = logits.argmax(dim=1).cpu().numpy()

        val_acc = accuracy_score(y_val, preds)
        print(f"  → 验证准确率: {val_acc:.4f}", flush=True)
        return float(val_acc)          # Optuna maximize 这个值

    except Exception as e:
        print(f"  ✗ trial 失败: {e}", flush=True)
        return 0.0



# ──────────────────────────────────────────────
# 主流程
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='VQ-MLP 离线超参数优化（严格三分割，无测试集泄露）')
    parser.add_argument('--data_path',    type=str, default='data_new/kaggle/classData.csv')
    parser.add_argument('--n_trials',     type=int, default=100, help='Optuna 试验次数，建议100')
    parser.add_argument('--output_dir',   type=str, default='data_new/models/fault_6class')
    parser.add_argument('--random_state', type=int, default=42)
    args = parser.parse_args()

    torch.manual_seed(args.random_state)
    np.random.seed(args.random_state)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')

    print(f"\n{'='*70}")
    print("VQ-MLP 离线超参数优化")
    print(f"{'='*70}")
    print(f"  数据路径: {args.data_path}")
    print(f"  试验次数: {args.n_trials}")
    print(f"  设备: {device}")
    print(f"  ★ 测试集在搜索阶段严格隔离，仅最终评估时使用一次")

    # ── 数据三分割 ──
    X_train, X_val, X_test, y_train, y_val, y_test, scaler = load_and_preprocess_data(
        args.data_path, test_size=0.15, val_size=0.15, random_state=args.random_state
    )
    print(f"\n数据划分: 训练集{len(X_train)} / 验证集{len(X_val)} / 测试集{len(X_test)}")
    print("Optuna 只能看到训练集和验证集，测试集已封存。\n")

    # ── 创建 study：最大化验证集准确率 ──
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(
        direction='maximize',
        sampler=optuna.samplers.TPESampler(seed=args.random_state),
        pruner=optuna.pruners.MedianPruner(n_startup_trials=5, n_warmup_steps=5)
    )

    study.optimize(
        lambda trial: objective(trial, X_train, y_train, X_val, y_val, device),
        n_trials=args.n_trials,
    )

    # ── 打印最优结果 ──
    print(f"\n{'='*70}")
    print("Optuna 搜索完成（仅使用验证集）")
    print(f"{'='*70}")
    print(f"  最优验证集准确率: {study.best_value:.4f}  ({study.best_value*100:.2f}%)")
    print(f"  最优超参数:")
    for k, v in study.best_params.items():
        print(f"    {k}: {v}")

    # ── 统计各 trial 验证准确率 ──
    vals = [t.value for t in study.trials if t.value is not None]
    print(f"\n  全部 {len(vals)} 次 trial 验证准确率统计:")
    print(f"    最低: {min(vals)*100:.2f}%")
    print(f"    最高: {max(vals)*100:.2f}%  ← 即最优验证准确率")
    print(f"    平均: {np.mean(vals)*100:.2f}%")
    print(f"    标准差: {np.std(vals)*100:.2f}%")

    # ── 用最优参数训练最终模型 ──
    print(f"\n{'='*70}")
    print("用最优参数重新训练最终模型...")
    print(f"{'='*70}")
    bp = study.best_params
    encoder, vq_layer, classifier = train_model(
        X_train, y_train, X_val, y_val, device,
        hidden_dim=bp['hidden_dim'],
        compressed_dim=bp['compressed_dim'],
        dropout=bp['dropout'],
        learning_rate=bp['learning_rate'],
        weight_decay=bp['weight_decay'],
        batch_size=bp['batch_size'],
        num_epochs=100,
        patience=20,
        verbose=True
    )

    # ── 最终测试集评估（只此一次，不反馈给 Optuna）──
    print(f"\n{'='*70}")
    print("★ 最终测试集评估（测试集首次被使用）")
    print(f"{'='*70}")
    test_accuracy = evaluate_model(encoder, vq_layer, classifier, X_test, y_test, device, verbose=True)

    # 详细分类报告
    encoder.eval(); vq_layer.eval(); classifier.eval()
    with torch.no_grad():
        Xt = torch.FloatTensor(X_test).to(device)
        z  = encoder(Xt)
        z_q, _, _, _ = vq_layer(z)   # 返回4个值: z_q, vq_loss, perplexity, encoding_indices
        preds = classifier(z_q).argmax(dim=1).cpu().numpy()
    fault_names = ['正常','单相接地','相间短路','三相短路','两相接地','三相接地短路']
    print("\n分类报告:")
    print(classification_report(y_test, preds, target_names=fault_names, digits=4))

    # ── 保存结果 JSON ──
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = {
        'optimization_date':       datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'n_trials':                args.n_trials,
        'best_params':             bp,
        'best_val_accuracy':       round(study.best_value, 6),
        'best_val_accuracy_pct':   round(study.best_value * 100, 2),
        'final_test_accuracy':     round(test_accuracy, 6),
        'final_test_accuracy_pct': round(test_accuracy * 100, 2),
        'all_val_accuracies': {
            'min':  round(min(vals) * 100, 2),
            'max':  round(max(vals) * 100, 2),
            'mean': round(float(np.mean(vals)) * 100, 2),
            'std':  round(float(np.std(vals))  * 100, 2),
        },
        'all_trials': [
            {
                'number':       t.number,
                'params':       t.params,
                'val_accuracy': round(t.value, 6) if t.value is not None else None,
                'state':        t.state.name
            }
            for t in study.trials
        ]
    }

    result_path = output_dir / 'optimization_result.json'
    with open(result_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    print(f"\n结果已保存: {result_path}")

    # ── 保存模型 ──
    torch.save(encoder.state_dict(),    output_dir / 'encoder_optimized.pth')
    torch.save(vq_layer.state_dict(),   output_dir / 'vq_layer_optimized.pth')
    torch.save(classifier.state_dict(), output_dir / 'classifier_optimized.pth')
    print(f"模型已保存到: {output_dir}")

    print(f"\n{'='*70}")
    print(f"✅ 全部完成！")
    print(f"   最优验证集准确率: {study.best_value*100:.2f}%  （Optuna搜索结果，仅用验证集）")
    print(f"   最终测试集准确率: {test_accuracy*100:.2f}%  （最终一次性评估，无泄露）")
    print(f"{'='*70}")
    sys.stdout.flush()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n❌ 出错: {e}", flush=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)
