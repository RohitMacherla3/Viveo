import json
import os
import numpy as np
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from pathlib import Path
from sentence_transformers import SentenceTransformer
import pickle
import logging

logger = logging.getLogger(__name__)

class LocalVectorStore:
    """Local vector store for food logs using sentence-transformers and local storage"""
    
    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Initialize sentence transformer for embeddings (free)
        self.model = SentenceTransformer('all-MiniLM-L6-v2')  # Small, fast, free model
        
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
        
        # Generate embedding
        embedding = self.model.encode(text_content)
        
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
        
        vectors.append(embedding.tolist())
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
        
        # Generate query embedding
        query_embedding = self.model.encode(query)
        
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
        import pickle, json
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