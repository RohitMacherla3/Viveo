import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import api_router

app = FastAPI(
    title="Viveo API",
    description="API for the Viveo application",
    version="1.0.0",
    root_path="/viveo/api"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

@app.get("/")
def root():
    return {"message": "Welcome to the Viveo API"}


if __name__ == "__main__":
    print("Starting the Viveo API...")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
    