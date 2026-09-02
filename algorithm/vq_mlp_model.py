"""
VQ-MLP 模型定义（公共模块）

包含编码器、向量量化层、分类器三个组件，供以下脚本复用：
  - train_6class_model.py       （训练）
  - run_all_experiments.py      （消融/对比实验，经由 train_6class_model 转发）
  - model_inference_service.py  （推理服务）

超参数均可通过构造函数配置：
  - 训练脚本默认：hidden_dim=128, compressed_dim=10（可用命令行参数调整）
  - 推理服务（Optuna 最优）：hidden_dim=256, compressed_dim=16
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class NodeIDsEncoder(nn.Module):
    """编码器：将原始 6 维特征编码为连续表征"""

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
    实现 Codebook、最近邻搜索、Straight-Through Estimator
    """

    def __init__(self, num_embeddings=16, embedding_dim=10, commitment_cost=0.25):
        super().__init__()
        self.num_embeddings = num_embeddings  # K=16 (int4: 0-15)
        self.embedding_dim = embedding_dim    # D=10
        self.commitment_cost = commitment_cost  # β=0.25

        # Codebook: 可学习的嵌入矩阵 E ∈ R^(K×D)
        self.embedding = nn.Embedding(num_embeddings, embedding_dim)
        self.embedding.weight.data.uniform_(-1 / num_embeddings, 1 / num_embeddings)

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
