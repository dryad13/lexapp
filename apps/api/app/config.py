from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "dev"
    app_name: str = "UK Legal Onboarding MVP"

    database_url: str
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    jwt_secret: str
    jwt_access_ttl_min: int = 15
    jwt_refresh_ttl_days: int = 14

    firm_portal_origin: str = "http://localhost:3000"
    client_portal_origin: str = "http://localhost:3002"

    max_upload_mb: int = 10
    upload_dir: str = "/app/data/uploads"

    stripe_secret_key: str
    stripe_publishable_key: str
    stripe_webhook_secret: str

    public_base_url: str = "http://localhost:8000"


settings = Settings()
