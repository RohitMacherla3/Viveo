from fastapi import APIRouter
from .routes import auth, users

# Import your route modules here (if they have routers defined)
# from .routes import auth, users

api_router = APIRouter()

# If you have routers in auth.py or users.py, include them like this:
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(users.router, tags=["users"])