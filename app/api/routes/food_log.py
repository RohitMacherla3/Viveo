from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from app.core.security import Authentication
from app.services.food_processor import FoodProcessor
from app.core.vector_store import LocalVectorStore
from app.database.schemas import FoodEntryResponse
from datetime import date, datetime
import logging
import asyncio

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
authenticator = Authentication()

# Initialize services
food_processor = None
vector_store = None

def get_food_processor():
    global food_processor
    if food_processor is None:
        food_processor = FoodProcessor()
    return food_processor

def get_vector_store():
    global vector_store
    if vector_store is None:
        vector_store = LocalVectorStore()
    return vector_store

logger = logging.getLogger(__name__)

def store_in_vector_background(username: str, structured_food_data: dict, entry_date: date):
    """Background task to store food entry in vector store"""
    try:
        store = get_vector_store()
        entry_id = store.store_food_entry(
            username=username,
            food_data=structured_food_data,
            entry_date=entry_date
        )
        logger.info(f"Background vector storage completed for user {username}: {entry_id}")
    except Exception as e:
        logger.error(f"Background vector storage failed for user {username}: {e}")

def delete_from_vector_background(username: str, entry_id: str):
    """Background task to delete food entry from vector store and JSON"""
    try:
        store = get_vector_store()
        # Only pass username and entry_id, not entry_date
        success = store.delete_food_entry(
            username=username,
            entry_id=entry_id
        )
        if success:
            logger.info(f"Background deletion completed for user {username}: {entry_id}")
        else:
            logger.warning(f"Entry not found for deletion: {username} - {entry_id}")
    except Exception as e:
        logger.error(f"Background deletion failed for user {username}: {e}")

@router.post("/logFoodText", response_model=FoodEntryResponse)
async def log_food_text(
    background_tasks: BackgroundTasks,
    food_details: str = Query(None, description="Natural language food description"),
    token: str = Depends(oauth2_scheme)
):
    """Log food entry with immediate response and background vector storage"""
    
    # Authenticate user
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Validate input
    if not food_details or not food_details.strip():
        raise HTTPException(
            status_code=400,
            detail="Food details are required. Please describe what you ate."
        )
    
    try:
        # Initialize services
        processor = get_food_processor()
        
        logger.info(f"Processing food entry for user {user.username}: {food_details}")
        
        # Process natural language food description into structured data
        structured_food_data = processor.process_food_description(food_details.strip())
        
        logger.info(f"Food processing result: {structured_food_data}")
        
        # Generate entry_id immediately
        entry_id = f"{user.username}_{date.today().strftime('%Y%m%d')}_{datetime.now().strftime('%H%M%S')}"
        structured_food_data['entry_id'] = entry_id
        structured_food_data['timestamp'] = datetime.now().isoformat()
        
        # Add vector storage as background task (non-blocking)
        background_tasks.add_task(
            store_in_vector_background,
            user.username,
            structured_food_data.copy(),
            date.today()
        )
        
        logger.info(f"Returning immediate response for user {user.username}: {structured_food_data.get('food_name', 'Unknown')}")
        
        # Return structured data immediately (before vector storage completes)
        return FoodEntryResponse(
            entry_id=entry_id,
            food_name=structured_food_data.get('food_name', 'Unknown Food'),
            quantity=structured_food_data.get('quantity', 'Unknown'),
            calories=float(structured_food_data.get('calories', 0)),
            protein=float(structured_food_data.get('protein', 0)),
            carbs=float(structured_food_data.get('carbs', 0)),
            fats=float(structured_food_data.get('fats', 0)),
            fiber=float(structured_food_data.get('fiber', 0)),
            food_review=structured_food_data.get('food_review', ''),
            meal_type=structured_food_data.get('meal_type', 'unknown'),
            timestamp=structured_food_data.get('timestamp', datetime.now().isoformat()),
            date=date.today()
        )
        
    except Exception as e:
        logger.error(f"Error logging food for user {user.username}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to log food entry: {str(e)}"
        )


@router.delete("/deleteFoodEntry/{entry_id}")
async def delete_food_entry(
    entry_id: str,
    background_tasks: BackgroundTasks,
    token: str = Depends(oauth2_scheme)
):
    """Delete a food entry from both JSON storage and vector store"""
    
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        # Extract date from entry_id (format: username_YYYYMMDD_HHMMSS)
        parts = entry_id.split('_')
        if len(parts) >= 3:
            date_str = parts[1]  # YYYYMMDD
            entry_date = datetime.strptime(date_str, '%Y%m%d').date()
        else:
            entry_date = date.today()  # Fallback to today
        
        # Add deletion as background task
        background_tasks.add_task(
            delete_from_vector_background,
            user.username,
            entry_id
        )
        
        logger.info(f"Deletion queued for user {user.username}: {entry_id}")
        
        return {"message": f"Food entry {entry_id} deletion queued successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting food entry for user {user.username}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete food entry"
        )


@router.get("/getFoodEntries")
async def get_food_entries(
    date_str: str = Query(None, description="Date in YYYY-MM-DD format"),
    token: str = Depends(oauth2_scheme)
):
    """Get all food entries for a specific date"""
    
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        if date_str:
            target_date = date.fromisoformat(date_str)
        else:
            target_date = date.today()
        
        store = get_vector_store()
        entries = store.get_food_entries_by_date_range(
            username=user.username,
            start_date=target_date,
            end_date=target_date
        )
        
        return {"entries": entries, "date": target_date.isoformat()}
        
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD"
        )
    except Exception as e:
        logger.error(f"Error getting food entries for user {user.username}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get food entries"
        )


@router.get("/getDailySummary")
async def get_daily_summary(
    date_str: str = Query(None, description="Date in YYYY-MM-DD format"),
    token: str = Depends(oauth2_scheme)
):
    """Get daily nutrition summary"""
    
    user = authenticator.decode_token(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        if date_str:
            target_date = date.fromisoformat(date_str)
        else:
            target_date = date.today()
        
        store = get_vector_store()
        entries = store.get_food_entries_by_date_range(
            username=user.username,
            start_date=target_date,
            end_date=target_date
        )
        
        # Calculate totals
        total_calories = sum(entry.get('calories', 0) for entry in entries)
        total_protein = sum(entry.get('protein', 0) for entry in entries)
        total_carbs = sum(entry.get('carbs', 0) for entry in entries)
        total_fats = sum(entry.get('fats', 0) for entry in entries)
        total_fiber = sum(entry.get('fiber', 0) for entry in entries)
        
        return {
            "date": target_date.isoformat(),
            "total_calories": total_calories,
            "total_protein": total_protein,
            "total_carbs": total_carbs,
            "total_fats": total_fats,
            "total_fiber": total_fiber,
            "entries_count": len(entries),
            "entries": entries
        }
        
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD"
        )
    except Exception as e:
        logger.error(f"Error getting daily summary for user {user.username}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to get daily summary"
        )