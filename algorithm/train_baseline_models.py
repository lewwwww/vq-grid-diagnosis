"""
训练基线模型：1D-CNN、LSTM、标准MLP
用于与VQ模型对比
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, TensorDataset
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support
import json
import time
import argparse

from baseline_models import CNN1D, LSTMModel, StandardMLP


def load_data(data_path):
    """加载数据"""
    df = pd.read_csv(data_path)
    
    X = df[['Ia', 'Ib', 'Ic', 'Va', 'Vb', 'Vc']].values
    y = df['G'].values
    
    print(f"总样本数: {len(X)}")
    print(f"\n标签分布:")
    for label in range(6):
        count = np.sum(y == label)
        print(f"  {label}: {count} ({count/len(y)*100:.2f}%)")
    
    return X, y


def train_model(model, X_train, y_train, X_val, y_val, device, model_name,
                num_epochs=50, batch_size=64, learning_rate=0.001, patience=20):
    """训练模型"""
    
    # 数据加载器
    train_dataset = TensorDataset(
        torch.FloatTensor(X_train),
        torch.LongTensor(y_train)
    )
    val_dataset = TensorDataset(
        torch.FloatTensor(X_val),
        torch.LongTensor(y_val)
    )
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # 优化器和损失函数
    optimizer = optim.Adam(model.parameters(), lr=learning_rate, weight_decay=0.0005)
    criterion = nn.CrossEntropyLoss()
    
    print(f"\n开始训练 {model_name}...")
    
    best_val_acc = 0
    patience_counter = 0
    best_model_state = None
    
    for epoch in range(num_epochs):
        # 训练
        model.train()
        train_loss = 0
        train_correct = 0
        train_total = 0
        
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            
            optimizer.zero_grad()
            outputs = model(batch_x)
            loss = criterion(outputs, batch_y)
            loss.backward()
            optimizer.step()
            
            train_loss += loss.item()
            _, predicted = outputs.max(1)
            train_total += batch_y.size(0)
            train_correct += predicted.eq(batch_y).sum().item()
        
        train_acc = train_correct / train_total
        
        # 验证
        model.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0
        
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                outputs = model(batch_x)
                loss = criterion(outputs, batch_y)
                
                val_loss += loss.item()
                _, predicted = outputs.max(1)
                val_total += batch_y.size(0)
                val_correct += predicted.eq(batch_y).sum().item()
        
        val_acc = val_correct / val_total
        
        if (epoch + 1) % 10 == 0 or epoch == 0:
            print(f"Epoch [{epoch+1}/{num_epochs}] Train Loss: {train_loss/len(train_loader):.4f}, "
                  f"Train Acc: {train_acc:.4f} | Val Loss: {val_loss/len(val_loader):.4f}, Val Acc: {val_acc:.4f}")
        
        # 早停
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            best_model_state = model.state_dict()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"\nEarly stopping at epoch {epoch+1}")
                break
    
    # 加载最佳模型
    model.load_state_dict(best_model_state)
    print(f"\n训练完成！最佳验证准确率: {best_val_acc:.4f}")
    
    return model


def evaluate_model(model, X_test, y_test, device):
    """评估模型"""
    model.eval()
    
    test_dataset = TensorDataset(torch.FloatTensor(X_test), torch.LongTensor(y_test))
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False)
    
    all_preds = []
    all_labels = []
    inference_times = []
    
    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            batch_x = batch_x.to(device)
            
            start_time = time.time()
            outputs = model(batch_x)
            inference_time = (time.time() - start_time) * 1000 / batch_x.size(0)
            inference_times.append(inference_time)
            
            _, predicted = outputs.max(1)
            all_preds.extend(predicted.cpu().numpy())
            all_labels.extend(batch_y.numpy())
    
    accuracy = np.mean(np.array(all_preds) == np.array(all_labels))
    precision, recall, f1, _ = precision_recall_fscore_support(all_labels, all_preds, average='weighted', zero_division=0)
    avg_inference_time = np.mean(inference_times)
    
    return {
        'accuracy': accuracy,
        'precision': precision,
        'recall': recall,
        'f1': f1,
        'inference_time_ms': avg_inference_time,
        'predictions': all_preds,
        'labels': all_labels
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=str, required=True, choices=['cnn', 'lstm', 'mlp'])
    parser.add_argument('--data_path', type=str, default='data_new/kaggle/classData.csv')
    parser.add_argument('--save_dir', type=str, required=True)
    parser.add_argument('--num_epochs', type=int, default=50)
    parser.add_argument('--batch_size', type=int, default=64)
    args = parser.parse_args()
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"使用设备: {device}\n")
    
    # 加载数据
    X, y = load_data(args.data_path)
    
    # 划分数据集
    X_train, X_temp, y_train, y_temp = train_test_split(X, y, test_size=0.3, random_state=42, stratify=y)
    X_val, X_test, y_val, y_test = train_test_split(X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp)
    
    # 归一化
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_val = scaler.transform(X_val)
    X_test = scaler.transform(X_test)
    
    print(f"\n数据集划分:")
    print(f"  训练集: {len(X_train)}")
    print(f"  验证集: {len(X_val)}")
    print(f"  测试集: {len(X_test)}")
    
    # 创建模型
    if args.model == 'cnn':
        model = CNN1D(input_dim=6, num_classes=6).to(device)
        model_name = "1D-CNN"
    elif args.model == 'lstm':
        model = LSTMModel(input_dim=6, hidden_dim=128, num_layers=2, num_classes=6).to(device)
        model_name = "LSTM"
    else:
        model = StandardMLP(input_dim=6, hidden_dim=128, num_classes=6).to(device)
        model_name = "Standard MLP"
    
    # 训练
    model = train_model(model, X_train, y_train, X_val, y_val, device, model_name,
                       num_epochs=args.num_epochs, batch_size=args.batch_size)
    
    # 评估
    print(f"\n{'='*70}")
    print("测试集评估...")
    print('='*70)
    
    results = evaluate_model(model, X_test, y_test, device)
    
    print(f"\n测试准确率: {results['accuracy']:.4f} ({results['accuracy']*100:.2f}%)")
    print(f"精确率: {results['precision']:.4f}")
    print(f"召回率: {results['recall']:.4f}")
    print(f"F1分数: {results['f1']:.4f}")
    print(f"平均推理时间: {results['inference_time_ms']:.2f} ms/样本")

    # 保存结果
    save_dir = Path(args.save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    # 保存模型
    torch.save(model.state_dict(), save_dir / 'model.pth')

    # 计算模型大小
    model_size = os.path.getsize(save_dir / 'model.pth') / (1024 * 1024)

    # 保存评估报告
    report = {
        'model_name': model_name,
        'model_type': args.model,
        'accuracy': float(results['accuracy']),
        'precision': float(results['precision']),
        'recall': float(results['recall']),
        'f1': float(results['f1']),
        'inference_time_ms': float(results['inference_time_ms']),
        'model_size_mb': round(model_size, 2),
        'confusion_matrix': confusion_matrix(results['labels'], results['predictions']).tolist()
    }

    with open(save_dir / 'evaluation_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"\n模型已保存到: {save_dir}")
    print(f"模型大小: {model_size:.2f} MB")
    print(f"评估报告已保存: {save_dir / 'evaluation_report.json'}")


if __name__ == '__main__':
    main()

