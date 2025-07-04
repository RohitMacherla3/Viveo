from app.database.session import Base, engine
from app.database.models import UserTable

Base.metadata.create_all(bind=engine)
print("Database tables created.")