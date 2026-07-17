"""AI 서비스 설정. 환경변수에서 값을 읽는다 (.env / docker-compose 참고)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "airvision-ai-service"
    # 데이터/모델 저장 루트 (Docker에서는 /app/data 로 마운트됨)
    data_dir: str = "./data"


@lru_cache
def get_settings() -> Settings:
    return Settings()
