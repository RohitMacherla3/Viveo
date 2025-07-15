# Add this health router to your app/main.py

from fastapi import APIRouter, HTTPException
from sqlalchemy import text  # Add this import
from app.database.session import SessionLocal
from app.settings import settings
import logging
import time
import os
import psutil
from datetime import datetime

# Create health router
router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/health")
async def health_check():
    """
    Health check endpoint for monitoring
    Returns system status and component health
    """
    start_time = time.time()
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "1.0.0",
        "components": {},
        "system": {}
    }
    
    # Check database connection
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))  # Fixed: Use text() function
        db.close()
        health_status["components"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}"
        }
    
    # Check Claude API key
    claude_api_key = settings.CLAUDE_API_KEY if hasattr(settings, 'CLAUDE_API_KEY') else None
    if claude_api_key and str(claude_api_key).startswith("sk-"):
        health_status["components"]["claude_api"] = {
            "status": "configured",
            "message": "Claude API key is configured"
        }
    else:
        health_status["components"]["claude_api"] = {
            "status": "warning",
            "message": "Claude API key not configured"
        }
    
    # Check data directory
    data_dir = "./data"
    if os.path.exists(data_dir) and os.access(data_dir, os.W_OK):
        health_status["components"]["storage"] = {
            "status": "healthy",
            "message": "Data directory accessible"
        }
    else:
        health_status["status"] = "degraded"
        health_status["components"]["storage"] = {
            "status": "unhealthy",
            "message": "Data directory not accessible"
        }
    
    # System metrics
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        cpu_percent = psutil.cpu_percent(interval=1)
        
        health_status["system"] = {
            "memory": {
                "total": memory.total,
                "available": memory.available,
                "percent": memory.percent
            },
            "disk": {
                "total": disk.total,
                "free": disk.free,
                "percent": disk.percent
            },
            "cpu_percent": cpu_percent
        }
        
        # Warning thresholds
        if memory.percent > 90 or disk.percent > 90 or cpu_percent > 90:
            health_status["status"] = "degraded"
    
    except Exception as e:
        health_status["system"]["error"] = f"Could not get system metrics: {str(e)}"
    
    # Response time
    health_status["response_time_ms"] = round((time.time() - start_time) * 1000, 2)
    
    # Return appropriate HTTP status
    if health_status["status"] == "unhealthy":
        raise HTTPException(status_code=503, detail=health_status)
    elif health_status["status"] == "degraded":
        # Return 200 but with warning status
        pass
    
    return health_status

@router.get("/health/simple")
async def simple_health_check():
    """Simple health check that just returns OK"""
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@router.get("/health/database")
async def database_health_check():
    """Specific database health check"""
    try:
        db = SessionLocal()
        result = db.execute(text("SELECT COUNT(*) as user_count FROM users")).fetchone()  # Fixed: Use text() function
        db.close()
        
        return {
            "status": "healthy",
            "database": "connected",
            "user_count": result[0] if result else 0,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503, 
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
        )
