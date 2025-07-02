### 1. User Authentication & Profile

* **Purpose**: Secure user registration, login, and profile management.
* **Elements**: JWT/OAuth2, profile CRUD, email verification
* **Endpoints**: /auth/*, /users/*

```bash
caloric_app/
├── backend/
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── database/
│   │   ├── __init__.py
│   │   ├── session.py
│   │   ├── models.py           # User model here
│   │   └── schemas.py          # UserCreate, UserUpdate, UserOut schemas
│   ├── core/
│   │   ├── security.py         # JWT/OAuth2 utils, password hashing, email verification helpers
│   │   └── utils.py            # General utilities
│   ├── api/
│   │   ├── routes/
│   │   │   ├── auth.py         # /auth/* endpoints: registration, login, email verification
│   │   │   └── users.py        # /users/* endpoints: profile CRUD
│   ├── services/
│   │   └── auth_service.py     # Auth logic, JWT tokens, email verification flow
│   ├── tasks/
│   │   └── background.py       # Background jobs like sending verification emails
│   ├── tests/
│   │   ├── test_auth.py
│   │   └── test_users.py
│   ├── .env
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── requirements.txt
│   └── README.md
```