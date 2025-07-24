from fastapi import HTTPException
import logging
from openai import OpenAI
from app.settings import settings
from app.config import AI_GLOBAL_CACHE
from app.services.rag_service import RAGService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AIClient")

class AIClient:
    """Enhanced AI client with RAG capabilities"""

    def __init__(self, ai_client: str, ai_model: str, user: str, cache_key=None):
        self.ai_client = ai_client
        self.ai_model = ai_model
        self.user = user
        self.cache = ConversationManager(user, cache_key=cache_key)
        self.client = OpenAI(api_key=settings.OPEN_AI_API_KEY)
        self.rag_service = RAGService()
        
        if not self.ai_client or not self.ai_model:
            raise ValueError("AI client and model must be specified.")

    def get_ai_response(self, query: str):
        """Get AI response with RAG capabilities"""
        if not settings.OPEN_AI_API_KEY:
            raise HTTPException(
                status_code=500,
                detail="OpenAI API key is not set in the environment variables.",
            )

        # Check if this is a food history query
        food_context = ""
        if self._is_food_history_query(query):
            food_context = self.rag_service.query_food_history(self.user, query)
            logger.info(f"Retrieved food context for user {self.user}: {len(food_context)} characters")

        # Get conversation history and convert to OpenAI format
        conversation_history = self.cache.get_conversation_history()
        
        # Convert messages to OpenAI format
        openai_messages = []
        
        # Add system message
        system_prompt = self._get_system_prompt_with_context(food_context)
        openai_messages.append({"role": "system", "content": system_prompt})
        
        # Add conversation history
        for message in conversation_history:
            role = message["role"]
            content = message["content"]
            
            # Handle content format - extract text from Anthropic format if needed
            if isinstance(content, list) and len(content) > 0 and "text" in content[0]:
                text_content = content[0]["text"]
            elif isinstance(content, str):
                text_content = content
            else:
                text_content = str(content)
            
            openai_messages.append({"role": role, "content": text_content})
        
        # Add current user message
        openai_messages.append({"role": "user", "content": query})
        
        logger.info(f"Conversation history length: {len(openai_messages)}")

        try:
            response = self.client.chat.completions.create(
                model=self.ai_model,
                messages=openai_messages,
                max_tokens=1000,
                temperature=0.7
            )
            
            ai_response = response.choices[0].message.content
            
            # Cache the conversation in Anthropic format for compatibility
            self.cache.add_message(
                messages=[
                    {"role": "user", "content": [{"type": "text", "text": query}]},
                    {"role": "assistant", "content": ai_response}
                ]
            )
            
            return ai_response if ai_response else "No response from AI."
            
        except Exception as e:
            logger.error(f"Error getting AI response: {e}")
            raise HTTPException(status_code=500, detail="Failed to get AI response")

    def _is_food_history_query(self, query: str) -> bool:
        """Check if query is asking about food history"""
        food_history_keywords = [
            'what did i eat', 'what have i eaten', 'my food', 'food log',
            'today', 'yesterday', 'this week', 'last week', 'this month',
            'calories consumed', 'protein intake', 'carbs', 'nutrition summary',
            'meal history', 'diet', 'food diary'
        ]
        
        query_lower = query.lower()
        return any(keyword in query_lower for keyword in food_history_keywords)

    def _get_system_prompt_with_context(self, food_context: str = "") -> str:
        """Get system prompt with optional food context"""
        base_prompt = """You are a world-class nutritionist and personal food assistant. Your responses should be concise and focused on nutrition-related topics. You help users track their food intake, provide nutritional advice, and answer questions about their eating habits.

Capabilities:
- Answer questions about food, nutrition, and health
- Suggest healthy food options and meal plans
- Provide nutritional information and calorie estimates
- Analyze eating patterns and provide personalized advice
- Help users understand their food logs and dietary habits

When users ask about their food intake or eating history, use the provided food log data to give accurate, personalized responses."""

        if food_context:
            enhanced_prompt = f"""{base_prompt}

IMPORTANT: The user is asking about their food history. Here is their relevant food log data:

{food_context}

Use this information to provide accurate, specific answers about their eating habits, nutritional intake, and dietary patterns. Be conversational and helpful."""
            return enhanced_prompt
        
        return base_prompt

    @staticmethod
    def _get_system_prompt():
        """Legacy method for compatibility"""
        return """You are a world-class nutritionist. Your responses should be concise and focused
on nutrition-related topics. You will answer questions about food, nutrition, and health.
Suggest healthy food options, provide nutritional information, and give advice on maintaining a balanced diet."""


class ConversationManager:
    """Manages conversations with the AI client"""
    
    def __init__(self, user: str, cache_key=None):
        self.cache = AI_GLOBAL_CACHE
        self.cache_key = cache_key or self._generate_cache_key(user)
        self.user = user

    def get_conversation_history(self) -> list:
        """Get the conversation history for the user"""
        return self.cache.get(self.cache_key, [])

    def add_message(self, messages: list):
        """Add messages to the conversation history"""
        if not messages:
            raise ValueError("Messages must be provided.")
        
        if self.cache_key not in self.cache:
            self.cache[self.cache_key] = []

        self.cache[self.cache_key].extend(messages)

    def clear_conversation(self):
        """Clear the conversation history for the user"""
        if self.cache_key in self.cache:
            del self.cache[self.cache_key]
            logger.info(f"Cleared conversation history for user: {self.user}")
        else:
            logger.warning(f"No conversation history found for user: {self.user}")

    def _generate_cache_key(self, user: str) -> str:
        """Generate cache key for user"""
        return f"conv_{user}"