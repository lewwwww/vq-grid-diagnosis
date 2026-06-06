import json

with open('data_new/models/experiment_results.json', 'r', encoding='utf-8') as f:
    r = json.load(f)

b = r['experiment_b']
c = r['experiment_c']
d = r['experiment_d']
main = b['comp_16']

print('=== 表3/4 主模型 (comp=16) ===')
print('准确率:', main['accuracy'], '% std:', main.get('accuracy_std','无'))
print('宏精确率:', main['macro_precision'], '%')
print('宏召回率:', main['macro_recall'], '%')
print('宏F1:', main['macro_f1'], '%')
print('推理时间:', main['inference_ms'], 'ms')
print('模型大小:', main['model_size_mb'], 'MB')
print('各次结果:', main.get('all_run_accuracies'))
print()
LABELS = ['正常','单相接地','相间短路','三相短路','两相接地','三相接地短路']
for name in LABELS:
    p = main['per_class'][name]
    print(name, '  P:', p['precision'], ' R:', p['recall'], ' F1:', p['f1'], ' N:', p['support'])

print()
print('=== 表5 压缩维度消融 ===')
for comp in [8, 10, 12, 16]:
    rv = b['comp_' + str(comp)]
    print('comp=' + str(comp), ' 准确率:', rv['accuracy'], '% std:', rv.get('accuracy_std','无'),
          ' F1:', rv['macro_f1'], '% 大小:', rv['model_size_mb'], 'MB')
    print('  各次:', rv.get('all_run_accuracies'))

print()
print('=== 表6 量化位数消融 ===')
for bits in ['int2', 'int4', 'int8']:
    rv = c[bits]
    print(bits, ' 准确率:', rv['accuracy'], '% std:', rv.get('accuracy_std','无'),
          ' F1:', rv['macro_f1'], '% 大小:', rv['model_size_mb'], 'MB')
    print('  各次:', rv.get('all_run_accuracies'))

print()
print('=== 表7 对比实验 ===')
for k, name in [('cnn','1D-CNN'), ('lstm','LSTM'), ('mlp','标准MLP')]:
    rv = d[k]
    print(name, ' 准确率:', rv['accuracy'], '% std:', rv.get('accuracy_std','无'),
          ' F1:', rv['f1'], '% 大小:', rv['model_size_mb'], 'MB')
    print('  各次:', rv.get('all_run_accuracies'))
print('VQ-MLP  准确率:', main['accuracy'], '% std:', main.get('accuracy_std','无'),
      ' 宏F1:', main['macro_f1'], '% 大小:', main['model_size_mb'], 'MB')

