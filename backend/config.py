from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    pixiv_phpsessid: str = ""
    pixiv_cookie_file: str = ""
    host: str = "0.0.0.0"
    port: int = 8000
    rate_limit_per_min: int = 30
    cache_dir: str = "/tmp/cosplan_cache"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


@lru_cache()
def get_settings() -> Settings:
    return Settings()
