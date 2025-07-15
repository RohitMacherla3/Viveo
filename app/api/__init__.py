from fastapi import APIRouter
from app.api.routes import auth, food_log, ask_ai, profile, health


api_router = APIRouter()

# Include all route modules
api_router.include_router(auth.router, tags=["authentication"])
api_router.include_router(food_log.router, tags=["food-log"])
api_router.include_router(ask_ai.router, tags=["ai-assistant"])
api_router.include_router(profile.router, tags=["profile"])
api_router.include_router(health.router, tags=["health"])