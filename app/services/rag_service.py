from datetime import date, timedelta
from typing import List, Dict, Any, Optional
import re
from app.core.vector_store import LocalVectorStore
import logging

logger = logging.getLogger(__name__)

class RAGService:
    """RAG service for querying food logs"""
    
    def __init__(self):
        self.vector_store = LocalVectorStore()
    
    def query_food_history(self, username: str, query: str) -> str:
        """Query user's food history using RAG"""
        
        # Parse temporal information from query
        date_range = self._parse_temporal_query(query)
        
        # Search vector store
        if date_range:
            # Use date range for specific time period queries
            search_results = self.vector_store.search_food_entries(
                username=username,
                query=query,
                date_range=date_range,
                top_k=20
            )
        else:
            # General search for recent entries
            search_results = self.vector_store.search_food_entries(
                username=username,
                query=query,
                top_k=10
            )
        
        if not search_results:
            return "I don't have any food log entries matching your query."
        
        # Format results for AI context
        context = self._format_search_results(search_results, query)
        return context
    
    def _parse_temporal_query(self, query: str) -> Optional[tuple]:
        """Parse temporal expressions from query"""
        query_lower = query.lower()
        today = date.today()
        
        # Today
        if 'today' in query_lower:
            return (today, today)
        
        # Yesterday
        if 'yesterday' in query_lower:
            yesterday = today - timedelta(days=1)
            return (yesterday, yesterday)
        
        # This week
        if 'this week' in query_lower or 'week' in query_lower:
            week_start = today - timedelta(days=today.weekday())
            return (week_start, today)
        
        # Last week
        if 'last week' in query_lower:
            last_week_end = today - timedelta(days=today.weekday() + 1)
            last_week_start = last_week_end - timedelta(days=6)
            return (last_week_start, last_week_end)
        
        # This month
        if 'this month' in query_lower or 'month' in query_lower:
            month_start = today.replace(day=1)
            return (month_start, today)
        
        # Last 7 days
        if 'last 7 days' in query_lower or 'past week' in query_lower:
            week_ago = today - timedelta(days=7)
            return (week_ago, today)
        
        # Last 30 days
        if 'last 30 days' in query_lower or 'past month' in query_lower:
            month_ago = today - timedelta(days=30)
            return (month_ago, today)
        
        return None
    
    def _format_search_results(self, results: List[Dict[str, Any]], original_query: str) -> str:
        """Format search results for AI context"""
        if not results:
            return "No food entries found."
        
        formatted_entries = []
        total_calories = 0
        total_protein = 0
        total_carbs = 0
        total_fats = 0
        
        for result in results:
            entry = f"""
Date: {result['date']}
Food: {result['food_name']}
Calories: {result['calories']}
Protein: {result['protein']}g, Carbs: {result['carbs']}g, Fats: {result['fats']}g
Original: {result.get('text_content', '')}
"""
            formatted_entries.append(entry.strip())
            
            # Calculate totals
            total_calories += result.get('calories', 0)
            total_protein += result.get('protein', 0)
            total_carbs += result.get('carbs', 0)
            total_fats += result.get('fats', 0)
        
        context = f"""
Based on your food log entries, here's what I found:

FOOD ENTRIES:
{chr(10).join(formatted_entries)}

SUMMARY:
Total entries found: {len(results)}
Total calories: {total_calories}
Total protein: {total_protein}g
Total carbs: {total_carbs}g
Total fats: {total_fats}g

Original query: {original_query}
"""
        return context.strip()