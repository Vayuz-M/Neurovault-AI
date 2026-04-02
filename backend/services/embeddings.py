"""
Embedding service using SentenceTransformers (local, free).
"""
import os
os.environ["HF_HOME"] = "C:\\Users\\lenovo\\Downloads\\neurovault-ai\\hf_cache"
from typing import List
from loguru import logger

_model = None

def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading SentenceTransformer model (first time may take a minute)...")
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model

async def get_embeddings(texts: List[str]) -> List[List[float]]:
    model = _get_model()
    embeddings = model.encode(texts, convert_to_numpy=True)
    return embeddings.tolist()

async def get_query_embedding(query: str) -> List[float]:
    embeddings = await get_embeddings([query])
    return embeddings[0]