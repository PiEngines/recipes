from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.categories.router import router as categories_router
from app.config import settings
from app.media.router import router as media_router
from app.recipes.router import router as recipes_router
from app.seed import seed_admin
from app.tags.router import router as tags_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_admin()
    yield


app = FastAPI(title="PiEngines Recipes API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(recipes_router)
app.include_router(categories_router)
app.include_router(tags_router)
app.include_router(media_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
