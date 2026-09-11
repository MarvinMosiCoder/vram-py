from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str                      # no default -> boot fails if absent
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    # Optional. Unset, the chat rate limiter and response cache stay in
    # process memory, which is correct for a single worker. Set it before
    # running more than one worker, or each worker counts and caches alone.
    REDIS_URL: str | None = None
    # Development only. Set CHAT_FAKE=1 to answer chat from a canned stub
    # instead of calling Gemini - the free tier allows 20 requests a day, which
    # one agent task can spend in a single run. See
    # docs/vram/ai-chat.md#stub-mode.
    CHAT_FAKE: bool = False

settings = Settings()
