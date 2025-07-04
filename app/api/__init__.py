from fastapi import APIRouter
from .routes import ask_ai, auth, profile, food_log

# Import your route modules here (if they have routers defined)
# from .routes import auth, users

api_router = APIRouter()

# If you have routers in auth.py or users.py, include them like this:
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(profile.router, tags=["profile"])
api_router.include_router(food_log.router, tags=["food_log"])
api_router.include_router(ask_ai.router, tags=["ai"])
