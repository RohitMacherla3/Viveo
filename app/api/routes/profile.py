from fastapi import APIRouter, Depends, HTTPException, Body, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.database.models import User, UserTable
from app.core.security import Authentication
from app.database.session import SessionLocal
import logging

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

logger = logging.getLogger(__name__)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.get("/getProfile")
def get_profile(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get user profile information, including preferences"""
    user_data = authenticator.decode_token(token)
    if not user_data:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(UserTable).filter(UserTable.username == user_data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    import json
    # Try to load preferences from full_name if stored as JSON, else fallback
    try:
        preferences = json.loads(user.full_name) if user.full_name else {}
    except Exception:
        preferences = {}
    profile = {
        "username": user.username,
        "email": user.email,
        "disabled": user.disabled,
        **preferences
    }
    return profile

@router.post("/updateProfile")
def update_profile(
    token: str = Depends(oauth2_scheme),
    profile_data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """Update user profile information and preferences"""
    user_data = authenticator.decode_token(token)
    if not user_data:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    user = db.query(UserTable).filter(UserTable.username == user_data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    import json
    # Update email if present
    if "email" in profile_data:
        user.email = profile_data["email"]
    # Store all preferences as JSON in full_name (replace with dedicated column in production)
    user.full_name = json.dumps(profile_data)
    db.commit()
    db.refresh(user)
    logger.info(f"Profile updated for user: {user.username}")
    return {"message": "Profile updated successfully"}


@router.delete("/deleteAccount")
async def delete_account(
    password_data: dict,
    token: str = Depends(oauth2_scheme)
):
    """Delete user account"""
    try:
        current_user = authenticator.decode_token(token)
        password = password_data.get("password")
        
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required for account deletion"
            )
        
        # Authenticate password before deletion
        if not authenticator.authenticate_user(current_user.username, password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect password"
            )
        
        # Delete user from database
        db = SessionLocal()
        user_record = db.query(UserTable).filter(UserTable.username == current_user.username).first()
        
        if user_record:
            db.delete(user_record)
            db.commit()
            db.close()
            
            logger.info(f"Account deleted for user: {current_user.username}")
            return {"message": "Account deleted successfully"}
        else:
            db.close()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting account: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )