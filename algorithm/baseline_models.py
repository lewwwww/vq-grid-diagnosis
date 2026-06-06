"""
基线模型：1D-CNN和LSTM用于对比实验
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class CNN1D(nn.Module):
    """1D-CNN模型用于故障诊断"""
    
    def __init__(self, input_dim=6, num_classes=6, dropout=0.1):
        super().__init__()
        
        # 1D卷积层
        self.conv1 = nn.Conv1d(1, 64, kernel_size=3, padding=1)
        self.bn1 = nn.BatchNorm1d(64)
        self.conv2 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.bn2 = nn.BatchNorm1d(128)
        self.conv3 = nn.Conv1d(128, 64, kernel_size=3, padding=1)
        self.bn3 = nn.BatchNorm1d(64)
        
        self.dropout = nn.Dropout(dropout)
        
        # 全连接层
        self.fc1 = nn.Linear(64 * input_dim, 128)
        self.fc2 = nn.Linear(128, num_classes)
    
    def forward(self, x):
        # x: (batch, 6) -> (batch, 1, 6)
        x = x.unsqueeze(1)
        
        # 卷积层
        x = F.relu(self.bn1(self.conv1(x)))
        x = self.dropout(x)
        x = F.relu(self.bn2(self.conv2(x)))
        x = self.dropout(x)
        x = F.relu(self.bn3(self.conv3(x)))
        x = self.dropout(x)
        
        # 展平
        x = x.view(x.size(0), -1)
        
        # 全连接层
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        
        return x


class LSTMModel(nn.Module):
    """LSTM模型用于故障诊断"""
    
    def __init__(self, input_dim=6, hidden_dim=128, num_layers=2, num_classes=6, dropout=0.1):
        super().__init__()
        
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        
        # LSTM层
        self.lstm = nn.LSTM(
            input_size=1,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0
        )
        
        self.dropout = nn.Dropout(dropout)
        
        # 全连接层
        self.fc1 = nn.Linear(hidden_dim * input_dim, 128)
        self.fc2 = nn.Linear(128, num_classes)
    
    def forward(self, x):
        # x: (batch, 6) -> (batch, 6, 1)
        x = x.unsqueeze(2)
        
        # LSTM
        lstm_out, _ = self.lstm(x)
        
        # 展平
        x = lstm_out.contiguous().view(x.size(0), -1)
        
        # 全连接层
        x = F.relu(self.fc1(x))
        x = self.dropout(x)
        x = self.fc2(x)
        
        return x


class StandardMLP(nn.Module):
    """标准MLP模型（无VQ）用于对比"""
    
    def __init__(self, input_dim=6, hidden_dim=128, num_classes=6, dropout=0.1):
        super().__init__()
        
        self.mlp = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes)
        )
    
    def forward(self, x):
        return self.mlp(x)

