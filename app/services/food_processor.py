from openai import OpenAI
from typing import Dict, Any
import json
import logging
from app.settings import settings
from app import config

logger = logging.getLogger(__name__)

AI_MODEL = config.SELECTED_AI_MODEL

class FoodProcessor:
    """Service to process natural language food descriptions into structured data"""
    
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPEN_AI_API_KEY)

    def process_food_description(self, food_text: str) -> Dict[str, Any]:
        """Convert natural language food description to structured data"""
        
        from datetime import date
        today_str = date.today().isoformat()
        
        # Use string concatenation instead of f-strings to avoid conflicts
        system_prompt = ("Today is " + today_str + ". "
                        "You are a nutrition expert. Convert natural language food descriptions into structured JSON data.\n\n"
                        "IMPORTANT: Return ONLY valid JSON, no additional text, markdown, or formatting.\n\n"
                        "Expected JSON format:\n"
                        "{\n"
                        '    "food_name": "string - descriptive name of the food item",\n'
                        '    "quantity": "string - amount consumed with units (e.g., 200g, 1 cup, 2 pieces)",\n'
                        '    "calories": number - estimated calories (integer),\n'
                        '    "protein": number - protein in grams (can be decimal),\n'
                        '    "carbs": number - carbohydrates in grams (can be decimal),\n'
                        '    "fats": number - fats in grams (can be decimal),\n'
                        '    "fiber": number - fiber in grams (can be decimal),\n'
                        '    "food_review": "string - brief nutritional assessment and health benefits",\n'
                        '    "meal_type": "string - breakfast/lunch/dinner/snack/unknown",\n'
                        '    "original_text": "string - the original input text"\n'
                        "}\n\n"
                        "Guidelines:\n"
                        "- Provide realistic nutritional estimates based on standard food databases\n"
                        "- Be specific with food names (e.g., Fresh Strawberries not just Strawberries)\n"
                        "- Include cooking method when relevant\n"
                        "- For portion sizes, be as accurate as possible based on the description\n"
                        "- If quantity is not specified, estimate a reasonable serving size\n"
                        "- Food review should be 1-2 sentences about nutritional value\n"
                        "- Use integers for calories, decimals okay for macros")

        try:
            # Create user message without f-string
            user_message = "Convert this food description to structured JSON: " + food_text
            
            response = self.client.chat.completions.create(
                model=AI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.2
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"AI response for food processing: {response_text}")
            
            # Clean up response if it has markdown formatting
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            # Try to parse JSON response
            try:
                food_data = json.loads(response_text)
                food_data['original_text'] = food_text
                
                # Ensure all required fields exist with defaults
                food_data = self._ensure_required_fields(food_data, food_text)
                
                return food_data
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from AI response: {response_text}")
                logger.error(f"JSON error: {e}")
                return self._create_fallback_entry(food_text)
                
        except Exception as e:
            logger.error(f"Error processing food description: {e}")
            return self._create_fallback_entry(food_text)
    
    def _ensure_required_fields(self, food_data: Dict[str, Any], original_text: str) -> Dict[str, Any]:
        """Ensure all required fields exist with reasonable defaults"""
        defaults = {
            "food_name": "Unknown Food Item",
            "quantity": "1 serving",
            "calories": 200,
            "protein": 10,
            "carbs": 20,
            "fats": 8,
            "fiber": 3,
            "food_review": "Nutritional information estimated",
            "meal_type": "unknown",
            "original_text": original_text
        }
        
        for key, default_value in defaults.items():
            if key not in food_data or food_data[key] is None:
                food_data[key] = default_value
        
        # Ensure numeric fields are actually numeric
        numeric_fields = ["calories", "protein", "carbs", "fats", "fiber"]
        for field in numeric_fields:
            try:
                # Convert to appropriate numeric type
                if field == "calories":
                    food_data[field] = int(float(food_data[field]))
                else:
                    food_data[field] = round(float(food_data[field]), 1)
            except (ValueError, TypeError):
                food_data[field] = defaults[field]
        
        return food_data
    
    def _create_fallback_entry(self, food_text: str) -> Dict[str, Any]:
        """Create fallback entry when AI processing fails"""
        return {
            "food_name": f"Food Entry: {food_text[:50]}{'...' if len(food_text) > 50 else ''}",
            "quantity": "1 serving",
            "calories": 200,
            "protein": 10,
            "carbs": 20,
            "fats": 8,
            "fiber": 3,
            "food_review": "Unable to process this food entry automatically. Nutritional values are estimates.",
            "meal_type": "unknown",
            "original_text": food_text
        }