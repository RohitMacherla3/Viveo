from typing import Optional
from pydantic import BaseModel

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
    
## AI Response Model
class AIResponse(BaseModel):
    response: str