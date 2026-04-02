"""
Pinecone vector store service.
Handles upsert, query, and delete of document chunk embeddings.
"""
from typing import List, Dict, Any
from loguru import logger
from config import settings

_pinecone_index = None


def _get_index():
    """Lazy-initialize Pinecone index."""
    global _pinecone_index
    if _pinecone_index is None:
        from pinecone import Pinecone, ServerlessSpec
        pc = Pinecone(api_key=settings.PINECONE_API_KEY)

        # Create index if it doesn't exist
        existing = [idx.name for idx in pc.list_indexes()]
        if settings.PINECONE_INDEX_NAME not in existing:
            logger.info(f"Creating Pinecone index: {settings.PINECONE_INDEX_NAME}")
            pc.create_index(
                name=settings.PINECONE_INDEX_NAME,
                dimension=384,   # OpenAI text-embedding-3-small
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region=settings.PINECONE_ENVIRONMENT),
            )
        _pinecone_index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _pinecone_index


async def upsert_chunks(
    document_id: str,
    user_id: str,
    chunks: List[str],
    embeddings: List[List[float]],
) -> int:
    """
    Store chunk embeddings in Pinecone with metadata.
    Returns number of vectors upserted.
    """
    index = _get_index()
    vectors = []
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        vector_id = f"{document_id}_{i}"
        vectors.append({
            "id": vector_id,
            "values": embedding,
            "metadata": {
                "document_id": document_id,
                "user_id": user_id,
                "chunk_index": i,
                "text": chunk[:1000],  # Pinecone metadata value limit
            },
        })

    # Batch upsert (Pinecone limit: 100 vectors per request)
    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        index.upsert(vectors=vectors[i: i + batch_size])

    logger.info(f"Upserted {len(vectors)} vectors for document {document_id}")
    return len(vectors)


async def query_similar(
    query_embedding: List[float],
    user_id: str,
    top_k: int = 5,
    document_ids: List[str] = None,
) -> List[Dict[str, Any]]:
    """
    Retrieve top-K similar chunks for a query.
    Optionally filter by document_ids.
    """
    index = _get_index()

    # Build metadata filter
    filter_dict: Dict[str, Any] = {"user_id": {"$eq": user_id}}
    if document_ids:
        filter_dict["document_id"] = {"$in": document_ids}

    result = index.query(
        vector=query_embedding,
        top_k=top_k,
        filter=filter_dict,
        include_metadata=True,
    )

    matches = []
    for match in result.matches:
        matches.append({
            "score": match.score,
            "document_id": match.metadata.get("document_id"),
            "chunk_index": match.metadata.get("chunk_index"),
            "text": match.metadata.get("text", ""),
        })
    return matches


async def delete_document_vectors(document_id: str):
    """Delete all vectors for a document."""
    index = _get_index()
    # Pinecone delete by metadata filter
    index.delete(filter={"document_id": {"$eq": document_id}})
    logger.info(f"Deleted vectors for document {document_id}")
