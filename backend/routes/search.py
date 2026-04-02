"""
Semantic search routes across user's document corpus.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List

from database import get_db
from models import Document
from utils.auth import get_current_user
from models import User
from services.embeddings import get_query_embedding
from services.vector_store import query_similar

router = APIRouter()


@router.get("/")
async def semantic_search(
    q: str = Query(..., min_length=2, description="Search query"),
    top_k: int = Query(10, ge=1, le=20),
    file_type: Optional[str] = Query(None, description="Filter by file type: pdf, docx, txt"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Perform semantic search across all user documents.
    Optionally filter by file type.
    """
    user_id = str(current_user.id)

    # Get all ready document IDs (optionally filtered)
    query = select(Document).where(
        Document.user_id == current_user.id,
        Document.status == "ready",
    )
    if file_type:
        query = query.where(Document.file_type == file_type)

    result = await db.execute(query)
    docs = result.scalars().all()
    doc_map = {str(d.id): d for d in docs}

    if not doc_map:
        return {"results": [], "query": q}

    # Embed query
    embedding = await get_query_embedding(q)

    # Query Pinecone
    matches = await query_similar(
        query_embedding=embedding,
        user_id=user_id,
        top_k=top_k,
        document_ids=list(doc_map.keys()),
    )

    # Enrich results with document metadata
    results = []
    for match in matches:
        doc_id = match.get("document_id")
        doc = doc_map.get(doc_id)
        results.append({
            "score": round(match["score"], 4),
            "text": match["text"],
            "document_id": doc_id,
            "document_name": doc.original_name if doc else "Unknown",
            "file_type": doc.file_type if doc else None,
            "chunk_index": match.get("chunk_index"),
        })

    return {"results": results, "query": q, "total": len(results)}
