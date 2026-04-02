"""
Document management routes: upload, list, delete, summarize.
"""
import os
import uuid
import asyncio
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from loguru import logger

from database import get_db
from models import Document, UsageLog
from utils.auth import get_current_user
from models import User
from config import settings
from services.extractor import extract_text
from services.chunker import chunk_text
from services.embeddings import get_embeddings
from services.vector_store import upsert_chunks, delete_document_vectors
from services.rag import summarize_document, extract_key_insights
from middleware.rate_limit import limiter

router = APIRouter()

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
}


# ── Background processing ─────────────────────────────────────────────────────

async def process_document(document_id: str, file_path: str, file_type: str, user_id: str):
    """
    Background task: extract text → chunk → embed → store in Pinecone.
    Updates document status in DB.
    """
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            # Fetch document
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if not doc:
                return

            logger.info(f"Processing document {document_id} ({file_type})")

            # 1. Extract text
            text, page_count = extract_text(file_path, file_type)
            if not text.strip():
                raise ValueError("No text could be extracted from document")

            # 2. Chunk
            chunks = chunk_text(text)
            logger.info(f"Created {len(chunks)} chunks")

            # 3. Embed
            embeddings = await get_embeddings(chunks)

            # 4. Store in Pinecone
            await upsert_chunks(document_id, user_id, chunks, embeddings)

            # 5. Update document record
            doc.status = "ready"
            doc.page_count = page_count
            doc.chunk_count = len(chunks)
            await db.commit()

            # 6. Log usage
            db.add(UsageLog(user_id=user_id, event_type="upload", document_id=document_id))
            await db.commit()

            logger.info(f"Document {document_id} processed successfully")

        except Exception as e:
            logger.error(f"Error processing document {document_id}: {e}")
            result = await db.execute(select(Document).where(Document.id == document_id))
            doc = result.scalar_one_or_none()
            if doc:
                doc.status = "error"
                doc.error_msg = str(e)
                await db.commit()


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=202)
@limiter.limit("20/hour")
async def upload_document(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a PDF, DOCX, or TXT document for processing."""
    # Validate file type
    content_type = file.content_type or ""
    file_type = ALLOWED_TYPES.get(content_type)
    if not file_type:
        # Try by extension
        ext = Path(file.filename).suffix.lower().lstrip(".")
        if ext in ["pdf", "docx", "txt"]:
            file_type = ext
        else:
            raise HTTPException(400, f"Unsupported file type: {content_type}")

    # Validate file size
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(400, f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    # Save file
    stored_name = f"{uuid.uuid4()}.{file_type}"
    upload_path = Path(settings.UPLOAD_DIR) / stored_name
    upload_path.write_bytes(content)

    # Create DB record
    doc = Document(
        user_id=current_user.id,
        filename=stored_name,
        original_name=file.filename,
        file_type=file_type,
        file_size=len(content),
        status="processing",
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    doc_id = str(doc.id)

    # Process in background
    background_tasks.add_task(
        process_document, doc_id, str(upload_path), file_type, str(current_user.id)
    )

    return {
        "id": doc_id,
        "filename": file.filename,
        "status": "processing",
        "message": "Document uploaded and being processed",
    }


@router.get("/")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all documents for the current user."""
    result = await db.execute(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "original_name": d.original_name,
            "file_type": d.file_type,
            "file_size": d.file_size,
            "page_count": d.page_count,
            "chunk_count": d.chunk_count,
            "status": d.status,
            "error_msg": d.error_msg,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single document's details."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    return {
        "id": str(doc.id),
        "original_name": doc.original_name,
        "file_type": doc.file_type,
        "file_size": doc.file_size,
        "page_count": doc.page_count,
        "chunk_count": doc.chunk_count,
        "status": doc.status,
        "created_at": doc.created_at.isoformat(),
        "preview_url": f"/uploads/{doc.filename}",
    }


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a document and its vectors."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")

    # Delete from Pinecone
    try:
        await delete_document_vectors(doc_id)
    except Exception as e:
        logger.warning(f"Could not delete Pinecone vectors: {e}")

    # Delete file from disk
    file_path = Path(settings.UPLOAD_DIR) / doc.filename
    if file_path.exists():
        file_path.unlink()

    await db.delete(doc)


@router.post("/{doc_id}/summarize")
async def summarize(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an AI summary of the document."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "ready":
        raise HTTPException(400, "Document is not ready yet")

    file_path = Path(settings.UPLOAD_DIR) / doc.filename
    from services.extractor import extract_text
    text, _ = extract_text(str(file_path), doc.file_type)
    summary = await summarize_document(text)
    return {"summary": summary}


@router.post("/{doc_id}/insights")
async def insights(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Extract key insights from the document."""
    result = await db.execute(
        select(Document).where(Document.id == doc_id, Document.user_id == current_user.id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(404, "Document not found")
    if doc.status != "ready":
        raise HTTPException(400, "Document is not ready yet")

    file_path = Path(settings.UPLOAD_DIR) / doc.filename
    from services.extractor import extract_text
    text, _ = extract_text(str(file_path), doc.file_type)
    key_insights = await extract_key_insights(text)
    return {"insights": key_insights}
