"""멀티모달 PM2.5 회귀 네트워크 (백본 선택형).

이미지 특징(백본 출력)과 환경데이터(온도·습도·풍속[+태양고도])를 결합해
PM2.5 1개 값을 회귀한다. 백본은 다음 중 선택한다.

- resnet18 (기본, MVP 검증 완료)
- convnext_tiny / swin_t (CCTV 추론 모듈 요구 백본 — ConvNeXt/Swin-Transformer)

ImageNet 사전학습 가중치 사용 여부는 설정(pretrained)으로 제어한다.
"""

import torch
from torch import nn
from torchvision.models import (
    ConvNeXt_Tiny_Weights,
    ResNet18_Weights,
    Swin_T_Weights,
    convnext_tiny,
    resnet18,
    swin_t,
)

ENV_DIM = 3  # temperature, humidity, wind_speed

SUPPORTED_BACKBONES = ("resnet18", "convnext_tiny", "swin_t")


def _build_backbone(name: str, pretrained: bool) -> tuple[nn.Module, int]:
    """백본 이름 → (특징 추출기, 특징 차원). 분류 head는 Identity로 대체한다."""
    if name == "resnet18":
        model = resnet18(weights=ResNet18_Weights.IMAGENET1K_V1 if pretrained else None)
        feature_dim = model.fc.in_features  # 512
        model.fc = nn.Identity()
        return model, feature_dim
    if name == "convnext_tiny":
        model = convnext_tiny(
            weights=ConvNeXt_Tiny_Weights.IMAGENET1K_V1 if pretrained else None)
        feature_dim = model.classifier[2].in_features  # 768
        model.classifier[2] = nn.Identity()
        return model, feature_dim
    if name == "swin_t":
        model = swin_t(weights=Swin_T_Weights.IMAGENET1K_V1 if pretrained else None)
        feature_dim = model.head.in_features  # 768
        model.head = nn.Identity()
        return model, feature_dim
    raise ValueError(
        f"지원하지 않는 backbone: {name} (지원: {', '.join(SUPPORTED_BACKBONES)})")


class MultimodalPm25Net(nn.Module):

    def __init__(self, pretrained: bool = False, env_dim: int = ENV_DIM,
                 backbone: str = "resnet18"):
        super().__init__()
        self.backbone, feature_dim = _build_backbone(backbone, pretrained)
        self.backbone_name = backbone
        self.head = nn.Sequential(
            nn.Linear(feature_dim + env_dim, 128),
            nn.ReLU(inplace=True),
            nn.Dropout(0.2),
            nn.Linear(128, 64),
            nn.ReLU(inplace=True),
            nn.Linear(64, 1),
        )

    def forward(self, image: torch.Tensor, env: torch.Tensor) -> torch.Tensor:
        """image: (B,3,S,S), env: (B,env_dim) → (B,1) PM2.5 예측값."""
        features = self.backbone(image)
        combined = torch.cat([features, env], dim=1)
        return self.head(combined)
