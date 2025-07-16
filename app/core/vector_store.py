import json
import os
import numpy as np
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from app.settings import settings
from pathlib import Path
import pickle
import logging
import asyncio
import aiohttp
from functools import lru_cache
import concurrent.futures
import threading

logger = logging.getLogger(__name__)

OPEN_AI_API_KEY = os.getenv("OPEN_AI_API_KEY", settings.OPEN_AI_API_KEY)

class LocalVectorStore:
    """Local vector store for food logs using OpenAI embeddings API and local storage"""
    
    def __init__(self, data_dir: str = "data", openai_api_key: str = None):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Get OpenAI API key from environment or parameter
        self.openai_api_key = openai_api_key or OPEN_AI_API_KEY
        if not self.openai_api_key:
            raise ValueError("OPEN_AI_API_KEY must be provided either as parameter or environment variable")
        
        # OpenAI embeddings API configuration
        self.embeddings_url = "https://api.openai.com/v1/embeddings"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.openai_api_key}"
        }
        
        # Use the latest and most cost-effective embedding model
        self.embedding_model = "text-embedding-3-small"  # 1536 dimensions, $0.02/1M tokens
        
        # Cache for embeddings to reduce API calls
        self._embedding_cache = {}
        
        # Thread pool for async operations
        self._thread_pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)
        
    async def _get_embedding_async(self, text: str) -> List[float]:
        """Get embedding from OpenAI API"""
        # Check cache first
        cache_key = hash(text)
        if cache_key in self._embedding_cache:
            return self._embedding_cache[cache_key]
        
        payload = {
            "model": self.embedding_model,
            "input": text,
            "encoding_format": "float"
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(self.embeddings_url, 
                                      headers=self.headers, 
                                      json=payload) as response:
                    if response.status == 200:
                        result = await response.json()
                        embedding = result["data"][0]["embedding"]
                        
                        # Cache the result
                        self._embedding_cache[cache_key] = embedding
                        return embedding
                    else:
                        error_text = await response.text()
                        logger.error(f"OpenAI API error: {response.status} - {error_text}")
                        return self._create_hash_embedding(text)
                        
        except Exception as e:
            logger.error(f"Error calling OpenAI API: {e}")
            return self._create_hash_embedding(text)
    
    def _create_hash_embedding(self, text: str) -> List[float]:
        """Create a consistent hash-based embedding as fallback"""
        import hashlib
        
        # Create embeddings with same dimensionality as text-embedding-3-small (1536)
        embeddings = []
        for i in range(32):  # Create 32 different hash seeds
            hash_input = f"{text}_{i}".encode('utf-8')
            hash_obj = hashlib.sha256(hash_input)
            hash_bytes = hash_obj.digest()
            
            # Convert bytes to floats
            for j in range(0, len(hash_bytes), 4):
                if len(embeddings) >= 1536:
                    break
                byte_chunk = hash_bytes[j:j+4].ljust(4, b'\x00')
                value = int.from_bytes(byte_chunk, byteorder='little', signed=True)
                normalized_value = value / (2**31)  # Normalize to [-1, 1]
                embeddings.append(normalized_value)
        
        # Pad to 1536 dimensions if needed
        while len(embeddings) < 1536:
            embeddings.append(0.0)
        
        # Normalize the embedding vector
        embedding_array = np.array(embeddings[:1536])
        norm = np.linalg.norm(embedding_array)
        if norm > 0:
            embedding_array = embedding_array / norm
        
        return embedding_array.tolist()
    
    def _run_async_in_thread(self, coro):
        """Run async function in a separate thread with its own event loop"""
        def run_in_thread():
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(coro)
            finally:
                loop.close()
        
        # Run in thread pool to avoid blocking
        future = self._thread_pool.submit(run_in_thread)
        return future.result()
    
    def _get_embedding_sync(self, text: str) -> List[float]:
        """Synchronous wrapper for getting embeddings"""
        try:
            # Check if we're already in an async context
            loop = asyncio.get_running_loop()
            # If we get here, there's already a running loop
            # Run the async function in a separate thread
            return self._run_async_in_thread(self._get_embedding_async(text))
        except RuntimeError:
            # No running event loop, safe to create one
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(self._get_embedding_async(text))
            finally:
                loop.close()
    
    def _get_user_date_dir(self, username: str, date_obj: date) -> Path:
        """Get directory path for user and date"""
        date_str = date_obj.strftime("%Y-%m-%d")
        user_dir = self.data_dir / "users" / username / date_str
        user_dir.mkdir(parents=True, exist_ok=True)
        return user_dir
    
    def _get_user_vector_dir(self, username: str) -> Path:
        """Get vector storage directory for user"""
        vector_dir = self.data_dir / "vectors" / username
        vector_dir.mkdir(parents=True, exist_ok=True)
        return vector_dir
    
    def store_food_entry(self, username: str, food_data: Dict[str, Any], entry_date: date = None) -> str:
        """Store food entry in both JSON and vector store"""
        if entry_date is None:
            entry_date = date.today()
            
        # Store in JSON file
        json_path = self._store_json_entry(username, food_data, entry_date)
        
        # Store in vector store
        vector_id = self._store_vector_entry(username, food_data, entry_date)
        
        logger.info(f"Stored food entry for {username} on {entry_date}: {food_data['food_name']}")
        return vector_id
    
    def _store_json_entry(self, username: str, food_data: Dict[str, Any], entry_date: date) -> Path:
        """Store food entry in JSON file"""
        user_date_dir = self._get_user_date_dir(username, entry_date)
        json_file = user_date_dir / "food_log.json"
        
        # Load existing entries or create new list
        entries = []
        if json_file.exists():
            with open(json_file, 'r') as f:
                entries = json.load(f)
        
        # Add timestamp and unique ID
        food_data['timestamp'] = datetime.now().isoformat()
        # Use entry_id from food_data if present, else generate
        if 'entry_id' not in food_data or not food_data['entry_id']:
            food_data['entry_id'] = f"{username}_{entry_date.strftime('%Y%m%d')}_{len(entries) + 1}"
        
        entries.append(food_data)
        
        # Save back to file
        with open(json_file, 'w') as f:
            json.dump(entries, f, indent=2)
        
        return json_file
    
    def _store_vector_entry(self, username: str, food_data: Dict[str, Any], entry_date: date) -> str:
        """Store food entry in vector store"""
        vector_dir = self._get_user_vector_dir(username)
        
        # Create text for embedding
        text_content = self._create_searchable_text(food_data, entry_date)
        
        # Generate embedding using OpenAI
        embedding = self._get_embedding_sync(text_content)
        
        # Load existing vectors or create new structure
        vectors_file = vector_dir / "vectors.pkl"
        metadata_file = vector_dir / "metadata.json"
        
        vectors = []
        metadata = []
        
        if vectors_file.exists():
            with open(vectors_file, 'rb') as f:
                vectors = pickle.load(f)
        
        if metadata_file.exists():
            with open(metadata_file, 'r') as f:
                metadata = json.load(f)
        
        # Add new entry
        # Use the entry_id provided in food_data if present, else generate
        entry_id = food_data.get('entry_id')
        if not entry_id:
            entry_id = f"{username}_{entry_date.strftime('%Y%m%d')}_{len(vectors) + 1}"
            food_data['entry_id'] = entry_id
        
        vectors.append(embedding)
        metadata.append({
            'entry_id': entry_id,
            'date': entry_date.isoformat(),
            'food_name': food_data.get('food_name', ''),
            'text_content': text_content,
            'calories': food_data.get('calories', 0),
            'protein': food_data.get('protein', 0),
            'carbs': food_data.get('carbs', 0),
            'fats': food_data.get('fats', 0)
        })
        
        # Save vectors and metadata
        with open(vectors_file, 'wb') as f:
            pickle.dump(vectors, f)
        
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return entry_id
    
    def _create_searchable_text(self, food_data: Dict[str, Any], entry_date: date) -> str:
        """Create searchable text from food data"""
        date_str = entry_date.strftime("%Y-%m-%d %A")  # Include day of week
        
        text_parts = [
            f"Date: {date_str}",
            f"Food: {food_data.get('food_name', '')}",
            f"Original text: {food_data.get('original_text', '')}",
            f"Calories: {food_data.get('calories', 0)}",
            f"Protein: {food_data.get('protein', 0)}g",
            f"Carbs: {food_data.get('carbs', 0)}g", 
            f"Fats: {food_data.get('fats', 0)}g"
        ]
        
        if food_data.get('food_review'):
            text_parts.append(f"Review: {food_data['food_review']}")
            
        return " | ".join(text_parts)
    
    def search_food_entries(self, username: str, query: str, date_range: Optional[tuple] = None, top_k: int = 10) -> List[Dict[str, Any]]:
        """Search food entries using vector similarity"""
        vector_dir = self._get_user_vector_dir(username)
        vectors_file = vector_dir / "vectors.pkl"
        metadata_file = vector_dir / "metadata.json"
        
        if not vectors_file.exists() or not metadata_file.exists():
            return []
        
        # Load vectors and metadata
        with open(vectors_file, 'rb') as f:
            vectors = pickle.load(f)
        
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        if not vectors:
            return []
        
        # Generate query embedding using OpenAI
        query_embedding = self._get_embedding_sync(query)
        
        # Calculate similarities
        similarities = []
        for i, vector in enumerate(vectors):
            similarity = np.dot(query_embedding, vector) / (
                np.linalg.norm(query_embedding) * np.linalg.norm(vector)
            )
            similarities.append((similarity, i))
        
        # Sort by similarity
        similarities.sort(reverse=True)
        
        # Filter by date range if provided
        results = []
        for similarity, idx in similarities[:top_k]:
            entry_metadata = metadata[idx].copy()
            entry_metadata['similarity'] = similarity
            
            # Filter by date range
            if date_range:
                entry_date = datetime.fromisoformat(entry_metadata['date']).date()
                if not (date_range[0] <= entry_date <= date_range[1]):
                    continue
            
            results.append(entry_metadata)
        
        return results
    
    def get_food_entries_by_date_range(self, username: str, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """Get all food entries in a date range"""
        all_entries = []
        current_date = start_date
        
        while current_date <= end_date:
            user_date_dir = self._get_user_date_dir(username, current_date)
            json_file = user_date_dir / "food_log.json"
            
            if json_file.exists():
                with open(json_file, 'r') as f:
                    entries = json.load(f)
                    for entry in entries:
                        entry['date'] = current_date.isoformat()
                        all_entries.append(entry)
            
            current_date += timedelta(days=1)
        
        return all_entries
    
    def delete_food_entry(self, username: str, entry_id: str):
        """Delete a food entry from the vector store and metadata by entry_id"""
        vector_dir = self._get_user_vector_dir(username)
        vectors_file = vector_dir / "vectors.pkl"
        metadata_file = vector_dir / "metadata.json"
        
        if not vectors_file.exists() or not metadata_file.exists():
            logger.warning(f"No vector or metadata file found for user {username}")
            return False
        
        with open(vectors_file, 'rb') as f:
            vectors = pickle.load(f)
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        # Find index of entry to delete
        idx_to_delete = next((i for i, m in enumerate(metadata) if m.get('entry_id') == entry_id), None)
        if idx_to_delete is None:
            logger.warning(f"Entry {entry_id} not found in vector store for user {username}")
            return False
        
        # Remove from both lists
        vectors.pop(idx_to_delete)
        metadata.pop(idx_to_delete)
        
        # Save back
        with open(vectors_file, 'wb') as f:
            pickle.dump(vectors, f)
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        # Also remove from food_log.json
        # Find the date from metadata or entry_id
        entry_date = None
        if metadata and len(metadata) > 0:
            # Try to find the date from the remaining metadata
            for m in metadata:
                if m.get('entry_id') == entry_id:
                    entry_date = m.get('date')
                    break
        
        if not entry_date:
            # Fallback: parse from entry_id (format: username_YYYYMMDD_...)
            try:
                parts = entry_id.split('_')
                if len(parts) >= 3:
                    entry_date = f"{parts[1][:4]}-{parts[1][4:6]}-{parts[1][6:]}"
            except Exception:
                entry_date = None
        
        if entry_date:
            user_date_dir = self._get_user_date_dir(username, datetime.strptime(entry_date, "%Y-%m-%d").date())
            json_file = user_date_dir / "food_log.json"
            if json_file.exists():
                with open(json_file, 'r') as f:
                    entries = json.load(f)
                new_entries = [e for e in entries if e.get('entry_id') != entry_id]
                with open(json_file, 'w') as f:
                    json.dump(new_entries, f, indent=2)
        
        logger.info(f"Deleted entry {entry_id} from vector store and food_log.json for user {username}")
        return True
    
    def __del__(self):
        """Cleanup thread pool"""
        if hasattr(self, '_thread_pool'):
            self._thread_pool.shutdown(wait=True)