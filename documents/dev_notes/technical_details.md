### Project Structure

```bash
caloric_app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── dependencies.py
│   │   ├── database/
│   │   │   ├── __init__.py
│   │   │   ├── session.py
│   │   │   ├── models.py
│   │   │   └── schemas.py
│   │   ├── core/
│   │   │   ├── security.py
│   │   │   ├── nutrition.py
│   │   │   └── utils.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── users.py
│   │   │   │   ├── food.py
│   │   │   │   ├── nutrition.py
│   │   │   │   ├── activity.py
│   │   │   │   ├── reports.py
│   │   │   │   ├── progress.py
│   │   │   │   └── security.py
│   │   ├── services/
│   │   │   ├── food_log_service.py
│   │   │   ├── activity_service.py
│   │   │   └── report_service.py
│   │   ├── tasks/
│   │   │   └── background.py
│   │   └── integrations/
│   │       └── nutrition_api.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_food_log.py
│   │   └── ...
│   ├── alembic/
│   │   └── versions/
│   ├── .env
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── backend_progress_tracker.ipynb

├── frontend/  # Expo + React Native + Web (Expo Router)
│   ├── app/  # File-based routing
│   │   ├── index.tsx         # Home
│   │   ├── login.tsx         # Login screen
│   │   ├── register.tsx      # Register screen
│   │   ├── dashboard.tsx     # Dashboard
│   │   └── (auth)/           # Auth layout wrappers
│   ├── components/           # Shared UI
│   │   ├── UI/
│   │   ├── FoodLog/
│   │   └── ActivityTracker/
│   ├── constants/            # Static constants
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # API + utility functions
│   ├── providers/            # Context providers
│   ├── assets/               # Images, fonts, etc.
│   ├── styles/               # Global styles
│   ├── app.config.ts         # Expo config
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md

├── Makefile
├── .gitignore
├── README.md
└── .env.template
```

### Recommended Tools
# Backend:
1. FastAPI
2. PostgreSQL
3. Alembic (migrations)
4. Docker + Compose
5. Pytest (unit testing)

# Frontend (pick one):
React Native + Expo + Expo Router
    Expo + Expo Router allows to build for:

    - iOS (App Store)

    - Android (Play Store)

    - Web (via React Native for Web)

### Example makefile
```makefile
run-backend:
	docker-compose up --build backend

migrate:
	cd backend && alembic upgrade head

lint:
	black backend/app && isort backend/app

test:
	pytest backend/tests

run-frontend:
	cd frontend && npm run dev
```

### 🌐 API Base URLs
1. Backend API: http://localhost:8000/api/v1/

2. Frontend: http://localhost:3000

### Frontend testing
```bash
# Start dev server (iOS, Android, Web)
npx expo start

# Start web only
npx expo start --web

# Build for web
npx expo export:web

# Build native apps
npx expo build:android
npx expo build:ios

```