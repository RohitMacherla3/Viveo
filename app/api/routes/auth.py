from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.core.security import Authentication
from app.database.models import UserCreate, UserInDB, Token
from app.database.session import SessionLocal
from app.database.models import UserTable
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Router setup
router = APIRouter()

# Security setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

# Pydantic models for responses
class UserResponse(BaseModel):
    username: str
    email: str
    full_name: str
    disabled: bool

class ProfileData(BaseModel):
    calorieGoal: int = 2000
    proteinGoal: int = 150
    carbsGoal: int = 250
    fatsGoal: int = 65
    age: int = None
    weight: float = None
    height: int = None
    activityLevel: str = "moderately_active"

# Authentication endpoints
@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    """Login endpoint that returns JWT token"""
    try:
        access_token = authenticator.authenticate_user(form_data.username, form_data.password)
        if not access_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        logger.info(f"User {form_data.username} logged in successfully")
        return {"access_token": access_token, "token_type": "bearer"}
    
    except Exception as e:
        logger.error(f"Login error for user {form_data.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/signup")
async def signup(user_data: UserCreate):
    """User registration endpoint"""
    try:
        # Check if user already exists
        if authenticator._user_exists(user_data.username):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already registered"
            )
        
        # Check if email already exists
        db = SessionLocal()
        existing_email = db.query(UserTable).filter(UserTable.email == user_data.email).first()
        db.close()
        
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Create new user
        new_user = authenticator.user_signup(user_data)
        if not new_user:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )
        
        logger.info(f"New user registered: {user_data.username}")
        return {"message": "User created successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Signup error for user {user_data.username}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )