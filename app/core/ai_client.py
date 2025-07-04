from fastapi import HTTPException
import logging
import anthropic
from app.settings import settings
from app.config import AI_GLOBAL_CACHE

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIClient")

class AIClient:
    """
    Abstract base class for AI clients.
    """
    def __init__(self, ai_client: str, ai_model: str, user:str, cache_key=None):
        """
        Initialize the AI client.
        """
        self.ai_client = ai_client
        self.ai_model = ai_model
        self.cache = ConversationManager(user, cache_key=cache_key)
        self.client = anthropic.Anthropic(api_key=settings.CLAUDE_API_KEY)
        if not self.ai_client or not self.ai_model:
            raise ValueError("AI client and model must be specified.")


    def get_ai_response(self, food_details: str):
        """get AI response for the given food details."""
        if not settings.CLAUDE_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="Claude API key is not set in the environment variables.",
            )
        

        content = [
            {
                "type": "text",
                "text": food_details
            }
        ]
        conversation_history = self.cache.get_conversation_history()
        conversation_history.extend([
            {
                "role": "user",
                "content": content
            }
        ])
        print("\n" + "=" * 50)
        logger.info(f"Conversation history: {conversation_history}")

        message = self.client.messages.create(
            model=self.ai_model,
            max_tokens=1000,
            temperature=1,
            system=self._get_system_prompt(),
            messages= conversation_history
        )
        ai_response = message.content
        self.cache.add_message(
            messages=[
                {"role": "user", "content": content},
                {"role": "assistant", "content": ai_response}
            ]
        )
        return ai_response[0].text if ai_response else "No response from AI."


    @staticmethod
    def _get_system_prompt():
        return """You are a world-class nutritionist. Your responses should be concise and focused
    on nutrition-related topics. You will answer questions about food, nutrition, and health.
    Suggest healthy food options, provide nutritional information, and give advice on maintaining a balanced diet.
    If the user asks about food they have eaten, you will provide the details in the following format:
    - Food Name: [Name of the food]
    - Calories: [Number of calories]
    - Protein: [Amount of protein in grams]
    - Carbohydrates: [Amount of carbohydrates in grams]
    - Fats: [Amount of fats in grams]
    - Fiber: [Amount of fiber in grams]
    - Food Review: [A brief review of the food, focusing on its nutritional value and health benefits]
    
    """


class ConversationManager:
    """
    Manages conversations with the AI client.
    """
    def __init__(self, user: str, cache_key=None):
        self.cache = AI_GLOBAL_CACHE
        self.cache_key = cache_key or self._generate_cache_key(user)

    def get_conversation_history(self) -> list:
        """
        Get the conversation history for the user.
        """
        return self.cache.get(self.cache_key, [])

    def add_message(self, messages: list):
        """
        Add a message to the conversation history.
        """
        if not messages:
            raise ValueError("Messages must be provided.")
        
        if self.cache_key not in self.cache:
            self.cache[self.cache_key] = []

        self.cache[self.cache_key].extend(messages)

    def clear_conversation(self):
        """
        Clear the conversation history for the user.
        """
        if self.cache_key in self.cache:
            del self.cache[self.cache_key]
            logger.info(f"Cleared conversation history for user: {self.user}")
        else:
            logger.warning(f"No conversation history found for user: {self.user}")

