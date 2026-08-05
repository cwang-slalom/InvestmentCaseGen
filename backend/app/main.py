from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .ai import router as ai_router
from .api import audiences, config, generation, health, opportunities, projects, sources
from .config import get_settings


settings = get_settings()
ROOT_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
FRONTEND_ASSETS = FRONTEND_DIST / "assets"

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(config.router)
app.include_router(projects.router)
app.include_router(opportunities.router)
app.include_router(audiences.router)
app.include_router(sources.router)
app.include_router(generation.router)
app.include_router(ai_router)

if FRONTEND_ASSETS.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_ASSETS), name="assets")


@app.exception_handler(Exception)
async def sanitized_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(
        status_code=500,
        content={"detail": "Request could not be completed."},
    )


@app.get("/health")
def legacy_health() -> dict[str, str]:
    return {"status": "ok", "service": "investmentgen-api"}


@app.get("/ready")
async def ready() -> dict[str, object]:
    backend = await health.api_health()
    return {
        "status": "ready",
        "runtime": "fastapi-react-single-process",
        "backend": backend["backend"],
    }


@app.get("/{full_path:path}", include_in_schema=False, response_model=None)
def react_router_fallback(full_path: str):
    if full_path.startswith("api/"):
        return JSONResponse(status_code=404, content={"detail": "API route not found."})
    index_path = FRONTEND_DIST / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse(
        status_code=200,
        content={
            "status": "frontend_not_built",
            "message": "Run npm run build to compile the React application.",
        },
    )
