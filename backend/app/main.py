from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.middleware import RequireAuthMiddleware
from app.api import routers

app = FastAPI(title="Vram Admin API")

import json
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
from app.helpers.common_helpers import DumpAndDie


@app.exception_handler(DumpAndDie)
async def _dump_and_die(request, exc: DumpAndDie):
    # default=repr so SQLAlchemy Rows, models, datetimes, Decimals etc.
    # never blow up the dump itself
    dumped = json.loads(json.dumps(jsonable_encoder(exc.payload), default=repr))
    return JSONResponse(status_code=500, content={"__dd__": dumped})

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
