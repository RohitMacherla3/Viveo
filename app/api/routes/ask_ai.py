from fastapi import APIRouter, Depends, HTTPException, Body
from fastapi.security import OAuth2PasswordBearer
from app.database.models import AIResponse
import app.config as config
from app.core.ai_client import AIClient
from app.core.security import Authentication
import logging

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

AI_CLIENT = config.SELECTED_AI_CLIENT
AI_MODEL = config.SELECTED_AI_MODEL

logger = logging.getLogger(__name__)

@router.post("/askAI", response_model=AIResponse)
async def ask_ai(
    token: str = Depends(oauth2_scheme),
    body: dict = Body(...)
):
    """Ask AI assistant with RAG capabilities for food history queries"""
    food_details = body.get("food_details")
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not food_details:
        raise HTTPException(
            status_code=400,
            detail="Question is required"
        )
    try:
        ai_client = AIClient(
            ai_client=AI_CLIENT,
            ai_model=AI_MODEL,
            user=user.username,
            cache_key=config.USER_CACHE_KEY_MAP.get(user.username, user.username)
        )
        response = ai_client.get_ai_response(food_details)
        if not response:
            raise HTTPException(
                status_code=500,
                detail="Failed to get AI response",
            )
        logger.info(f"AI response generated for user {user.username}")
        return AIResponse(response=str(response))
    except Exception as e:
        logger.error(f"Error in ask_ai for user {user.username}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get AI response"
        )