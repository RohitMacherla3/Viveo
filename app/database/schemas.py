from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime

class FoodEntryCreate(BaseModel):
    """Schema for creating food entries"""
    original_text: str
    meal_type: Optional[str] = None

class FoodEntryResponse(BaseModel):
    """Schema for food entry responses"""
    entry_id: str
    food_name: str
    quantity: str
    calories: float
    protein: float
    carbs: float
    fats: float
    fiber: float
    food_review: str
    meal_type: str
    timestamp: str
    date: date

    class Config:
        from_attributes = True

class FoodLogSummary(BaseModel):
    """Schema for food log summaries"""
    date: date
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float
    entries_count: int
    entries: List[FoodEntryResponse]

class NutritionQuery(BaseModel):
    """Schema for nutrition queries"""
    query: str
    include_history: bool = True

class SearchResult(BaseModel):
    """Schema for search results"""
    entry_id: str
    food_name: str
    date: str
    similarity_score: float
    calories: float
    protein: float
    carbs: float
    fats: float

class DailyNutritionSummary(BaseModel):
    """Schema for daily nutrition summary"""
    date: date
    total_calories: float
    total_protein: float
    total_carbs: float
    total_fats: float
    total_fiber: float
    entries_count: int
    calorie_goal: Optional[float] = 2000
    protein_goal: Optional[float] = 150
    carbs_goal: Optional[float] = 250
    fats_goal: Optional[float] = 65