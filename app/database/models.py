from typing import Optional
from pydantic import BaseModel
from sqlalchemy import Column, Integer, String, Boolean
from .session import Base

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    
# User model
class User(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    disabled: Optional[bool] = None
    
# User in database model
class UserInDB(User):
    hashed_password: str
    
# SQLAlchemy User table based on UserCreate fields
class UserTable(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    email = Column(String, unique=True, index=True, nullable=True)
    disabled = Column(Boolean, default=False)

## AI Response Model
class AIResponse(BaseModel):
    response: str

