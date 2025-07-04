import hashlib
AI_MODELS = {
    "claude": {
        "haiku": "claude-3-5-haiku-20241022",
        "sonnet-3.5": "claude-3-5-sonnet-20240620",
        "sonnet-3.7": "claude-3-7-sonnet-20250219",
        "sonnet-4": "claude-sonnet-4-20250514",
    },
    'openai': {
        "gpt-4.5": "gpt-4.5-preview-2025-02-27",
        "gpt-4.1": "gpt-4.1-2025-04-14",
        "gpt-4o": "gpt-4o-2024-08-06",
        "gpt-4o-mini": "gpt-4o-mini-2024-07-18",
    },
    "ollama": {
        "llama-3.2": "llama3.2:latest",
    }
}

SELECTED_AI_CLIENT = "claude"
SELECTED_AI_MODEL = "haiku"
SELECTED_AI_MODEL = AI_MODELS[SELECTED_AI_CLIENT][SELECTED_AI_MODEL]
AI_GLOBAL_CACHE = {}
USER_CACHE_KEY_MAP = {}
FOOD_LOG = {}