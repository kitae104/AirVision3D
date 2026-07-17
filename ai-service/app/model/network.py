"""ResNet18 기반 멀티모달 PM2.5 회귀 네트워크.

이미지 특징(ResNet18, 512차원)과 환경데이터(온도·습도·풍속, 3차원)를
결합해 PM2.5 1개 값을 회귀한다. ImageNet 사전학습 가중치 사용 여부는
설정(pretrained)으로 제어한다.
"""

import torch
from torch import nn
from torchvision.models import ResNet18_Weights, resnet18

ENV_DIM = 3  # temperature, humidity, wind_speed


class MultimodalPm25Net(nn.Module):

    def __init__(self, pretrained: bool = False, env_dim: int = ENV_DIM):
        super().__init__()
        weights = ResNet18_Weights.IMAGENET1K_V1 if pretrained else None
        backbone = resnet18(weights=weights)
        feature_dim = backbone.fc.in_features  # 512
        backbone.fc = nn.Identity()
        self.backbone = backbone
        self.head = nn.Sequential(
            nn.Linear(feature_dim + env_dim, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )

    def forward(self, image: torch.Tensor, env: torch.Tensor) -> torch.Tensor:
        """image: (B,3,S,S), env: (B,3) → (B,1) PM2.5 예측값."""
        features = self.backbone(image)
        combined = torch.cat([features, env], dim=1)
        return self.head(combined)
