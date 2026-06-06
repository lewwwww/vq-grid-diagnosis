import json
import matplotlib.pyplot as plt
import numpy as np

# 读取优化结果
with open('data_new/models/fault_6class/optimization_result.json', 'r') as f:
    data = json.load(f)

# 提取试验数据（跳过被剪枝的None值）
trials = data['all_trials']
trial_numbers = [t['number'] + 1 for t in trials if t['val_accuracy'] is not None]
values = [t['val_accuracy'] for t in trials if t['val_accuracy'] is not None]

# 计算最优值曲线
best_values = []
current_best = 0
for v in values:
    current_best = max(current_best, v)
    best_values.append(current_best)

# 设置中文字体
plt.rcParams['font.sans-serif'] = ['SimHei', 'Arial Unicode MS']
plt.rcParams['axes.unicode_minus'] = False

# 创建图表
fig, ax = plt.subplots(figsize=(10, 6))

# 绘制所有试验点
ax.scatter(trial_numbers, values, alpha=0.6, s=50, label='试验准确率', color='#3498db')

# 绘制最优值曲线
ax.plot(trial_numbers, best_values, 'r-', linewidth=2, label='最优准确率', color='#e74c3c')

# 标注最优点
best_trial = max(trials, key=lambda x: x['val_accuracy'] if x['val_accuracy'] is not None else 0)
best_trial_num = best_trial['number'] + 1
best_value = best_trial['val_accuracy']
ax.scatter([best_trial_num], [best_value], s=200, marker='*', 
           color='#f39c12', edgecolors='black', linewidths=1.5, 
           label=f'最优试验 (Trial {best_trial_num})', zorder=5)

# 设置标签和标题
ax.set_xlabel('试验次数', fontsize=12)
ax.set_ylabel('验证准确率', fontsize=12)
ax.set_title('Optuna超参数优化收敛曲线 (100次试验)', fontsize=14, fontweight='bold')
ax.grid(True, alpha=0.3, linestyle='--')
ax.legend(fontsize=10)

# 设置y轴范围
ax.set_ylim([0.65, 0.90])

# 添加注释
ax.annotate(f'{best_value:.4f}', 
            xy=(best_trial_num, best_value),
            xytext=(best_trial_num + 2, best_value - 0.01),
            fontsize=10,
            bbox=dict(boxstyle='round,pad=0.5', facecolor='yellow', alpha=0.7),
            arrowprops=dict(arrowstyle='->', connectionstyle='arc3,rad=0'))

plt.tight_layout()
plt.savefig('docs/图8_超参数优化收敛曲线.png', dpi=300, bbox_inches='tight')
print("✅ 收敛曲线已保存到: docs/图8_超参数优化收敛曲线.png")

# 打印统计信息
print(f"\n优化统计:")
print(f"  总试验次数: {len(values)}")
print(f"  最优准确率: {best_value:.4f} (Trial {best_trial_num})")
print(f"  初始准确率: {values[0]:.4f}")
print(f"  提升幅度: {(best_value - values[0]):.4f} ({(best_value - values[0])/values[0]*100:.2f}%)")
print(f"  平均准确率: {np.mean(values):.4f}")
print(f"  标准差: {np.std(values):.4f}")

