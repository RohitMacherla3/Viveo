from typing import Optional
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi import HTTPException

from app.database.models import UserInDB, UserCreate, UserTable
from app.settings import settings
from app.database.session import SessionLocal

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES

class Authentication:
    """
    A class to handle authentication-related operations.
    """
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

    def authenticate_user(self, username: str, password: str) -> Optional[str]:
        """Authenticate a user by username and password."""
        user = self._get_user(username)
        if not user:
            return None
        if not self.__verify_password(password, user.hashed_password):
            return None
        
        access_token = self.__create_access_token(data={"sub": user.username})
        return access_token
    
    def user_signup(self, user_data: UserCreate) -> UserInDB:
        """Sign up a new user."""
        if self._user_exists(user_data.username):
            return None

        user = self._store_user_signup(user_data)

        return user
    
    def _get_user(self, username: str) -> Optional[UserInDB]:
        """Retrieve a user from the database by username."""
        db = SessionLocal()
        user_row = db.query(UserTable).filter(UserTable.username == username).first()
        db.close()
        if user_row:
            return UserInDB(
                username=user_row.username,
                full_name=user_row.full_name,
                email=user_row.email,
                hashed_password=getattr(user_row, 'password', None),
                disabled=user_row.disabled
            )
        return None
    
    
    def __verify_password(self, plain_password: str, hashed_password: str) -> bool:
        return self.pwd_context.verify(plain_password, hashed_password)


    def __create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None):
        to_encode = data.copy()
        expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
        to_encode.update({"exp": expire})
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    def _user_exists(self, username: str) -> bool:
        """Check if a user exists in the database."""
        db = SessionLocal()
        exists = db.query(UserTable).filter(UserTable.username == username).first() is not None
        db.close()
        return exists

    def _store_user_signup(self, user_data: UserCreate) -> UserInDB:
        """Store user signup information in the SQLite database."""
        hashed_password = self.pwd_context.hash(user_data.password)
        db = SessionLocal()
        user_row = UserTable(
            username=user_data.username,
            password=hashed_password,
            full_name=user_data.full_name,
            email=user_data.email,
            disabled=False
        )
        db.add(user_row)
        db.commit()
        db.refresh(user_row)
        db.close()
        return UserInDB(
            username=user_row.username,
            full_name=user_row.full_name,
            email=user_row.email,
            hashed_password=hashed_password,
            disabled=user_row.disabled
        )
    
    def decode_token(self, token: str):
        """Decode a JWT token and return the user if valid."""
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            username = payload.get("sub")
            if username is None:
                raise HTTPException(status_code=401, detail="Invalid token")
            user = self._get_user(username)
            if user is None:
                raise HTTPException(status_code=401, detail="User not found")
            return user
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid token")