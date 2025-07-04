from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from app.core.security import Authentication
from app.config import AI_GLOBAL_CACHE, USER_CACHE_KEY_MAP, FOOD_LOG

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

@router.post("/logFoodText", response_model=str)
async def log_food_text(token: str = Depends(oauth2_scheme), food_details: str = None):
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if food_details:
        user_cache_key = USER_CACHE_KEY_MAP.get(user.username)
        FOOD_LOG[user_cache_key] = FOOD_LOG.get(user_cache_key, []) + [food_details]
        AI_GLOBAL_CACHE[user_cache_key] = AI_GLOBAL_CACHE.get(user_cache_key, [])
        AI_GLOBAL_CACHE[user_cache_key].extend([{
            "role": "user",
            "content": [{"type": "text", "text": food_details}]
        }])
    return "Food logged successfully for user: {}".format(user.username)