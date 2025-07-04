from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from app.database.models import AIResponse
import app.config as config
from app.core.ai_client import AIClient
from app.core.security import Authentication

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

AI_CLIENT = config.SELECTED_AI_CLIENT
AI_MODEL = config.SELECTED_AI_MODEL
AI_GLOBAL_CACHE = config.AI_GLOBAL_CACHE

@router.post("/askAI", response_model=AIResponse)
async def ask_ai(token: str = Depends(oauth2_scheme), food_details: str = None):
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
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
    return AIResponse(response=str(response))
