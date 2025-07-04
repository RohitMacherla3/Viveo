import uuid

def generate_cache_key() -> str:
    """
    Generate a unique cache key for the conversation.
    """
    return str(uuid.uuid4())