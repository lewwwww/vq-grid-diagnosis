"""
使用 classData.csv 训练 6 分类故障诊断模型
故障类型：
  0: 正常 (0000)
  1: 单相接地故障 (1001)
  2: 相间短路故障 (0110)
  3: 三相短路故障 (0111)
  4: 两相接地故障 (1011)
  5: 三相接地短路 (1111)
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import torch
import torch.nn as nn
import torch.nn.functional as F
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


class NodeIDsEncoder(nn.Module):
    """ 编码器"""
    def __init__(self, input_dim=6, hidden_dim=128, compressed_dim=10, dropout=0.1):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, compressed_dim)
        )

    def forward(self, x):
        return self.encoder(x)


class VectorQuantizer(nn.Module):
    """
    向量量化层
    实现Codebook、最近邻搜索、Straight-Through Estimator
    """
    def __init__(self, num_embeddings=16, embedding_dim=10, commitment_cost=0.25):
        super().__init__()
        self.num_embeddings = num_embeddings  # K=16 (int4: 0-15)
        self.embedding_dim = embedding_dim    # D=10
        self.commitment_cost = commitment_cost  # β=0.25

        # Codebook: 可学习的嵌入矩阵 E ∈ R^(K×D)
        self.embedding = nn.Embedding(num_embeddings, embedding_dim)
        self.embedding.weight.data.uniform_(-1/num_embeddings, 1/num_embeddings)

    def forward(self, z):
        """
        前向传播
        Args:
            z: 编码器输出 [batch_size, embedding_dim]
        Returns:
            z_q: 量化后的向量 [batch_size, embedding_dim]
            loss: VQ损失（承诺损失 + 码本损失）
            perplexity: 码本利用率
            encodings: 离散编码索引 [batch_size]
        """
        # 计算距离: ||z - e_k||^2
        # z: [B, D], embedding.weight: [K, D]
        distances = torch.cdist(z, self.embedding.weight)  # [B, K]

        # 最近邻搜索: q = argmin_k ||z - e_k||^2
        encoding_indices = torch.argmin(distances, dim=1)  # [B]

        # 查表获取量化向量: z_q = e_q
        z_q = self.embedding(encoding_indices)  # [B, D]

        # 计算损失
        # 承诺损失: ||sg[z_q] - z||^2 (鼓励编码器输出接近码本)
        commitment_loss = F.mse_loss(z, z_q.detach())

        # 码本损失: ||z_q - sg[z]||^2 (更新码本接近编码器输出)
        codebook_loss = F.mse_loss(z_q, z.detach())

        # 总VQ损失
        vq_loss = codebook_loss + self.commitment_cost * commitment_loss

        # Straight-Through Estimator: 前向用z_q，反向用z的梯度
        z_q = z + (z_q - z).detach()

        # 计算码本利用率（perplexity）
        avg_probs = torch.bincount(encoding_indices, minlength=self.num_embeddings).float()
        avg_probs = avg_probs / avg_probs.sum()
        perplexity = torch.exp(-torch.sum(avg_probs * torch.log(avg_probs + 1e-10)))

        return z_q, vq_loss, perplexity, encoding_indices


class FaultClassifier(nn.Module):
    """6 分类故障分类器"""
    def __init__(self, input_dim=10, hidden_dim=64, num_classes=6, dropout=0.1):
        super().__init__()
        self.classifier = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, num_classes)
        )
    
    def forward(self, x):
        return self.classifier(x)


def load_and_preprocess_data(data_path, test_size=0.15, val_size=0.15, random_state=42):
    """加载并预处理数据"""
    print(f"\n{'='*70}")
    print("加载数据...")
    print(f"{'='*70}")
    
    # 读取数据
    df = pd.read_csv(data_path)
    print(f"总样本数: {len(df)}")
    
    # 创建标签
    df['label_str'] = (df['G'].astype(str) + 
                       df['C'].astype(str) + 
                       df['B'].astype(str) + 
                       df['A'].astype(str))
    
    # 映射到 0-5
    label_map = {
        '0000': 0,  # 正常
        '1001': 1,  # 单相接地
        '0110': 2,  # 相间短路
        '0111': 3,  # 三相短路
        '1011': 4,  # 两相接地
        '1111': 5   # 三相接地短路
    }
    
    df['fault_type'] = df['label_str'].map(label_map)
    
    # 统计标签分布
    print("\n标签分布:")
    label_names = ['正常', '单相接地', '相间短路', '三相短路', '两相接地', '三相接地短路']
    for i, name in enumerate(label_names):
        count = (df['fault_type'] == i).sum()
        print(f"  {i} - {name}: {count} ({count/len(df)*100:.2f}%)")
    
    # 提取特征和标签
    X = df[['Ia', 'Ib', 'Ic', 'Va', 'Vb', 'Vc']].values
    y = df['fault_type'].values
    
    # 数据归一化
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    print(f"\n归一化参数:")
    print(f"  均值: {scaler.mean_}")
    print(f"  标准差: {scaler.scale_}")
    
    # 划分数据集
    X_temp, X_test, y_temp, y_test = train_test_split(
        X_scaled, y, test_size=test_size, random_state=random_state, stratify=y
    )
    
    val_size_adjusted = val_size / (1 - test_size)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp, test_size=val_size_adjusted, random_state=random_state, stratify=y_temp
    )
    
    print(f"\n数据集划分:")
    print(f"  训练集: {len(X_train)} ({len(X_train)/len(X)*100:.1f}%)")
    print(f"  验证集: {len(X_val)} ({len(X_val)/len(X)*100:.1f}%)")
    print(f"  测试集: {len(X_test)} ({len(X_test)/len(X)*100:.1f}%)")
    
    return X_train, X_val, X_test, y_train, y_val, y_test, scaler


def train_model(X_train, y_train, X_val, y_val, device,
                hidden_dim=128, compressed_dim=10, num_embeddings=16, dropout=0.1,
                num_epochs=100, batch_size=64, learning_rate=0.001,
                weight_decay=0.0005, patience=20, verbose=True):
    """训练模型

    Args:
        X_train: 训练集特征
        y_train: 训练集标签
        X_val: 验证集特征
        y_val: 验证集标签
        device: 训练设备
        hidden_dim: 隐藏层维度
        compressed_dim: 压缩维度
        dropout: Dropout比率
        num_epochs: 最大训练轮数
        batch_size: 批次大小
        learning_rate: 学习率
        weight_decay: 权重衰减
        patience: 早停耐心值
        verbose: 是否打印详细信息

    Returns:
        encoder: 训练好的编码器
        classifier: 训练好的分类器
    """
    if verbose:
        print(f"\n{'='*70}")
        print("开始训练...")
        print(f"{'='*70}")

    # 创建数据加载器
    train_dataset = TensorDataset(
        torch.FloatTensor(X_train),
        torch.LongTensor(y_train)
    )
    val_dataset = TensorDataset(
        torch.FloatTensor(X_val),
        torch.LongTensor(y_val)
    )

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size)

    # 创建模型（使用配置参数）
    encoder = NodeIDsEncoder(
        input_dim=6,
        hidden_dim=hidden_dim,
        compressed_dim=compressed_dim,
        dropout=dropout
    ).to(device)

    # 添加向量量化层
    vq_layer = VectorQuantizer(
        num_embeddings=num_embeddings,  # 可配置：4(int2), 16(int4), 256(int8)
        embedding_dim=compressed_dim,  # D=10
        commitment_cost=0.25  # β=0.25
    ).to(device)

    classifier = FaultClassifier(
        input_dim=compressed_dim,
        hidden_dim=hidden_dim // 2,
        num_classes=6,
        dropout=dropout
    ).to(device)

    if verbose:
        print(f"\n模型结构:")
        print(f"  Encoder: 6 -> {hidden_dim} -> {hidden_dim} -> {compressed_dim}")
        print(f"  VQ Layer: Codebook size={num_embeddings}, embedding_dim={compressed_dim}")
        print(f"  Classifier: {compressed_dim} -> {hidden_dim // 2} -> 6")
        print(f"  Dropout: {dropout}")

    # 优化器和损失函数
    params = list(encoder.parameters()) + list(vq_layer.parameters()) + list(classifier.parameters())
    optimizer = optim.Adam(params, lr=learning_rate, weight_decay=weight_decay)
    criterion = nn.CrossEntropyLoss()

    # 训练循环
    best_val_acc = 0
    patience_counter = 0

    for epoch in range(num_epochs):
        # 训练阶段
        encoder.train()
        vq_layer.train()
        classifier.train()
        train_loss = 0
        train_vq_loss = 0
        train_correct = 0
        train_total = 0

        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)

            optimizer.zero_grad()

            # 前向传播: Encoder -> VQ -> Classifier
            z = encoder(batch_x)
            z_q, vq_loss, perplexity, encodings = vq_layer(z)
            logits = classifier(z_q)

            # 总损失 = 分类损失 + VQ损失
            ce_loss = criterion(logits, batch_y)
            loss = ce_loss + vq_loss

            loss.backward()
            optimizer.step()

            train_loss += ce_loss.item()
            train_vq_loss += vq_loss.item()
            _, predicted = torch.max(logits, 1)
            train_total += batch_y.size(0)
            train_correct += (predicted == batch_y).sum().item()

        train_acc = train_correct / train_total
        train_loss = train_loss / len(train_loader)
        train_vq_loss = train_vq_loss / len(train_loader)

        # 验证阶段
        encoder.eval()
        vq_layer.eval()
        classifier.eval()
        val_loss = 0
        val_correct = 0
        val_total = 0

        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)

                z = encoder(batch_x)
                z_q, _, _, _ = vq_layer(z)
                logits = classifier(z_q)
                loss = criterion(logits, batch_y)

                val_loss += loss.item()
                _, predicted = torch.max(logits, 1)
                val_total += batch_y.size(0)
                val_correct += (predicted == batch_y).sum().item()

        val_acc = val_correct / val_total
        val_loss = val_loss / len(val_loader)

        # 打印进度
        if verbose and ((epoch + 1) % 10 == 0 or epoch == 0):
            print(f"Epoch [{epoch+1}/{num_epochs}] "
                  f"Train Loss: {train_loss:.4f}, VQ Loss: {train_vq_loss:.4f}, Train Acc: {train_acc:.4f} | "
                  f"Val Loss: {val_loss:.4f}, Val Acc: {val_acc:.4f}")

        # Early stopping
        if val_acc > best_val_acc:
            best_val_acc = val_acc
            patience_counter = 0
            # 保存最佳模型
            best_encoder_state = encoder.state_dict()
            best_vq_state = vq_layer.state_dict()
            best_classifier_state = classifier.state_dict()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                if verbose:
                    print(f"\nEarly stopping at epoch {epoch+1}")
                break

    # 加载最佳模型
    encoder.load_state_dict(best_encoder_state)
    vq_layer.load_state_dict(best_vq_state)
    classifier.load_state_dict(best_classifier_state)

    if verbose:
        print(f"\n训练完成！最佳验证准确率: {best_val_acc:.4f}")

    return encoder, vq_layer, classifier


def evaluate_model(encoder, vq_layer, classifier, X_test, y_test, device, verbose=True):
    """评估模型

    Args:
        encoder: 编码器
        vq_layer: 向量量化层
        classifier: 分类器
        X_test: 测试集特征
        y_test: 测试集标签
        device: 设备
        verbose: 是否打印详细信息

    Returns:
        accuracy: 测试准确率
    """
    encoder.eval()
    vq_layer.eval()
    classifier.eval()

    X_test_tensor = torch.FloatTensor(X_test).to(device)
    y_test_tensor = torch.LongTensor(y_test).to(device)

    with torch.no_grad():
        z = encoder(X_test_tensor)
        z_q, _, _, _ = vq_layer(z)
        logits = classifier(z_q)
        _, predicted = torch.max(logits, 1)
        accuracy = (predicted == y_test_tensor).sum().item() / len(y_test)

    if verbose:
        print(f"\n{'='*70}")
        print("测试集评估")
        print(f"{'='*70}")
        print(f"  准确率: {accuracy:.4f}")

    return accuracy


def evaluate_model_detailed(encoder, vq_layer, classifier, X_test, y_test, device):
    """详细评估模型（用于保存评估报告）"""
    print(f"\n{'='*70}")
    print("测试集评估...")
    print(f"{'='*70}")

    encoder.eval()
    vq_layer.eval()
    classifier.eval()

    X_test_tensor = torch.FloatTensor(X_test).to(device)
    y_test_tensor = torch.LongTensor(y_test).to(device)

    # 测量推理时间
    start_time = time.time()
    with torch.no_grad():
        z = encoder(X_test_tensor)
        z_q, _, _, _ = vq_layer(z)
        logits = classifier(z_q)
        _, predicted = torch.max(logits, 1)
    inference_time = (time.time() - start_time) / len(X_test) * 1000  # 单样本推理时间(ms)

    predicted = predicted.cpu().numpy()

    # 计算准确率
    accuracy = (predicted == y_test).mean()
    print(f"\n测试准确率: {accuracy:.4f} ({accuracy*100:.2f}%)")

    # 计算精确率、召回率、F1分数
    precision, recall, f1, support = precision_recall_fscore_support(
        y_test, predicted, average='weighted', zero_division=0
    )

    print(f"精确率 (Precision): {precision:.4f}")
    print(f"召回率 (Recall): {recall:.4f}")
    print(f"F1分数: {f1:.4f}")
    print(f"平均推理时间: {inference_time:.2f} ms/样本")

    # 分类报告
    label_names = ['正常', '单相接地', '相间短路', '三相短路', '两相接地', '三相接地短路']
    print("\n分类报告:")
    report = classification_report(y_test, predicted, target_names=label_names, digits=4, output_dict=True)
    print(classification_report(y_test, predicted, target_names=label_names, digits=4))

    # 混淆矩阵
    print("\n混淆矩阵:")
    cm = confusion_matrix(y_test, predicted)
    print(cm)

    # 返回详细评估结果
    evaluation_results = {
        'accuracy': float(accuracy),
        'precision': float(precision),
        'recall': float(recall),
        'f1_score': float(f1),
        'inference_time_ms': float(inference_time),
        'classification_report': report,
        'confusion_matrix': cm.tolist()
    }

    return evaluation_results


def save_models(encoder, vq_layer, classifier, scaler, save_dir, evaluation_results, args):
    """保存模型和评估结果"""
    save_dir = Path(save_dir)
    save_dir.mkdir(parents=True, exist_ok=True)

    # 保存模型
    torch.save(encoder.state_dict(), save_dir / 'encoder.pth')
    torch.save(vq_layer.state_dict(), save_dir / 'vq_layer.pth')
    torch.save(classifier.state_dict(), save_dir / 'classifier.pth')

    # 计算模型大小
    encoder_size = os.path.getsize(save_dir / 'encoder.pth') / (1024 * 1024)  # MB
    vq_size = os.path.getsize(save_dir / 'vq_layer.pth') / (1024 * 1024)  # MB
    classifier_size = os.path.getsize(save_dir / 'classifier.pth') / (1024 * 1024)  # MB
    total_size = encoder_size + vq_size + classifier_size

    # 保存归一化参数
    scaler_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist()
    }
    with open(save_dir / 'scaler_params.json', 'w') as f:
        json.dump(scaler_params, f, indent=2)

    # 保存完整的评估结果
    evaluation_report = {
        'model_info': {
            'model_type': '6-class fault classification (Node IDs)',
            'input_dim': 6,
            'hidden_dim': args.hidden_dim,
            'compressed_dim': args.compressed_dim,
            'dropout': args.dropout,
            'num_classes': 6,
            'training_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'random_seed': args.random_state
        },
        'training_config': {
            'learning_rate': args.learning_rate,
            'batch_size': args.batch_size,
            'num_epochs': args.num_epochs,
            'patience': args.patience,
            'data_split': {
                'train': '70%',
                'validation': '15%',
                'test': '15%'
            }
        },
        'performance_metrics': {
            'accuracy': evaluation_results['accuracy'],
            'precision': evaluation_results['precision'],
            'recall': evaluation_results['recall'],
            'f1_score': evaluation_results['f1_score']
        },
        'practical_metrics': {
            'inference_time_ms': evaluation_results['inference_time_ms'],
            'model_size_mb': round(total_size, 2),
            'encoder_size_mb': round(encoder_size, 2),
            'vq_layer_size_mb': round(vq_size, 2),
            'classifier_size_mb': round(classifier_size, 2)
        },
        'detailed_results': {
            'classification_report': evaluation_results['classification_report'],
            'confusion_matrix': evaluation_results['confusion_matrix']
        },
        'fault_types': {
            '0': '正常',
            '1': '单相接地故障',
            '2': '相间短路故障',
            '3': '三相短路故障',
            '4': '两相接地故障',
            '5': '三相接地短路'
        }
    }

    with open(save_dir / 'evaluation_report.json', 'w', encoding='utf-8') as f:
        json.dump(evaluation_report, f, indent=2, ensure_ascii=False)

    print(f"\n模型已保存到: {save_dir}")
    print(f"模型大小: {total_size:.2f} MB")
    print(f"评估报告已保存: {save_dir / 'evaluation_report.json'}")


def main():
    import argparse

    # 命令行参数
    parser = argparse.ArgumentParser(description='训练 6 分类故障诊断模型')
    parser.add_argument('--data_path', type=str, default='data_new/kaggle/classData.csv', help='数据文件路径')
    parser.add_argument('--save_dir', type=str, default='data_new/models/fault_6class', help='模型保存目录')
    parser.add_argument('--hidden_dim', type=int, default=128, help='隐藏层维度')
    parser.add_argument('--compressed_dim', type=int, default=10, help='压缩维度')
    parser.add_argument('--num_embeddings', type=int, default=16, help='Codebook大小（量化位数：4=int2, 16=int4, 256=int8）')
    parser.add_argument('--dropout', type=float, default=0.1, help='Dropout比率')
    parser.add_argument('--learning_rate', type=float, default=0.001, help='学习率')
    parser.add_argument('--weight_decay', type=float, default=0.0005, help='权重衰减')
    parser.add_argument('--batch_size', type=int, default=64, help='批次大小')
    parser.add_argument('--num_epochs', type=int, default=100, help='最大训练轮数')
    parser.add_argument('--patience', type=int, default=20, help='早停耐心值')
    parser.add_argument('--random_state', type=int, default=42, help='随机种子')

    args = parser.parse_args()

    # 设置随机种子
    torch.manual_seed(args.random_state)
    np.random.seed(args.random_state)

    # 设备
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"使用设备: {device}")
    print(f"\n训练参数:")
    print(f"  数据路径: {args.data_path}")
    print(f"  隐藏层维度: {args.hidden_dim}")
    print(f"  压缩维度: {args.compressed_dim}")
    print(f"  Dropout: {args.dropout}")
    print(f"  学习率: {args.learning_rate}")
    print(f"  批次大小: {args.batch_size}")
    print(f"  最大轮数: {args.num_epochs}")
    print(f"  早停耐心值: {args.patience}")

    # 加载数据
    X_train, X_val, X_test, y_train, y_val, y_test, scaler = load_and_preprocess_data(
        args.data_path, test_size=0.15, val_size=0.15, random_state=args.random_state
    )

    # 训练模型（使用配置参数）
    encoder, vq_layer, classifier = train_model(
        X_train, y_train, X_val, y_val, device,
        hidden_dim=args.hidden_dim,
        compressed_dim=args.compressed_dim,
        num_embeddings=args.num_embeddings,
        dropout=args.dropout,
        num_epochs=args.num_epochs,
        batch_size=args.batch_size,
        learning_rate=args.learning_rate,
        weight_decay=args.weight_decay,
        patience=args.patience,
        verbose=True
    )

    # 评估模型
    evaluation_results = evaluate_model_detailed(encoder, vq_layer, classifier, X_test, y_test, device)

    # 保存模型和评估结果
    save_models(encoder, vq_layer, classifier, scaler, args.save_dir, evaluation_results, args)

    print(f"\n{'='*70}")
    print("训练完成！")
    print(f"{'='*70}")


if __name__ == '__main__':
    main()

