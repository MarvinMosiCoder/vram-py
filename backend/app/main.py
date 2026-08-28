from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.core.middleware import RequireAuthMiddleware
from app.api import routers

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Vram Admin API")

# Order matters: Starlette wraps middleware so the LAST one added ends up
# outermost. RequireAuthMiddleware must go first so CORSMiddleware wraps
# around it — otherwise a 401 it returns skips CORS headers entirely and
# the browser reports a CORS error instead of the real 401.
app.add_middleware(RequireAuthMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(routers.router)
