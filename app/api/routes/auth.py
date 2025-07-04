### code for auth2
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm

from app.database.models import User, UserCreate
from app.core.security import Authentication
from app.core.utils import generate_cache_key
import app.config as config


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
router = APIRouter()
authenticator = Authentication()

# Endpoint to login and get a token
@router.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    access_token = authenticator.authenticate_user(form_data.username, form_data.password)
    if not access_token:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/signup", response_model=str)
async def signup(user_data: UserCreate):

    user = authenticator.user_signup(user_data)
    if not user:
        raise HTTPException(status_code=400, detail="Username already registered")

    config.USER_CACHE_KEY_MAP[user.username] = generate_cache_key()

    return f"Signup successful for user: {user.username}"
