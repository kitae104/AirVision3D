"""AI 서비스 설정. 환경변수에서 값을 읽는다 (.env / docker-compose 참고)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    service_name: str = "airvision-ai-service"
    # 데이터/모델 저장 루트 (ai-service 디렉터리 기준 상대경로 = 저장소 루트의 data/)
    data_dir: str = "../data"
    # 미세먼지 등급 설정 파일
    grades_config_path: str = "config/grades.json"

    @property
    def models_dir(self) -> str:
        return f"{self.data_dir}/models"

    @property
    def default_dataset_dir(self) -> str:
        return f"{self.data_dir}/sample/dataset"


@lru_cache
def get_settings() -> Settings:
    return Settings()
