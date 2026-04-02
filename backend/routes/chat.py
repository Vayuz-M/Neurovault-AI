"""
Chat routes: session management + streaming RAG-powered responses.
"""
import json
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger

from database import get_db
from models import ChatSession, ChatMessage, UsageLog, Document
from utils.auth import get_current_user
from models import User
from services.embeddings import get_query_embedding
from services.vector_store import query_similar
from services.rag import stream_answer, generate_answer
from middleware.rate_limit import limiter

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class NewSessionRequest(BaseModel):
    title: Optional[str] = "New Chat"


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    document_ids: Optional[List[str]] = None   # filter to specific docs
    stream: Optional[bool] = True


# ── Session Endpoints ──────────────────────────────────────────────────────────

@router.post("/sessions", status_code=201)
async def create_session(
    body: NewSessionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = ChatSession(user_id=current_user.id, title=body.title)
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return {"id": str(session.id), "title": session.title, "created_at": session.created_at.isoformat()}


@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
    )
    sessions = result.scalars().all()
    return [
        {"id": str(s.id), "title": s.title, "created_at": s.created_at.isoformat(), "updated_at": s.updated_at.isoformat()}
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify ownership
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    await db.delete(session)


@router.put("/sessions/{session_id}/title")
async def update_session_title(
    session_id: str,
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == current_user.id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "Session not found")
    session.title = body.get("title", session.title)
    await db.flush()
    return {"title": session.title}


# ── Chat Message Endpoint (Streaming) ─────────────────────────────────────────

@router.post("/message")
@limiter.limit("60/minute")
async def send_message(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Send a message and get a streaming RAG-powered response.
    Creates a new session if session_id is not provided.
    """
    user_id = str(current_user.id)

    # Get or create session
    if body.session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == body.session_id, ChatSession.user_id == current_user.id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "Session not found")
    else:
        # Auto-create session with truncated message as title
        title = body.message[:60] + ("..." if len(body.message) > 60 else "")
        session = ChatSession(user_id=current_user.id, title=title)
        db.add(session)
        await db.flush()
        await db.refresh(session)

    session_id = str(session.id)

    # Load chat history for context
    hist_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .limit(10)
    )
    history = [{"role": m.role, "content": m.content} for m in hist_result.scalars().all()]

    # Save user message
    user_msg = ChatMessage(
        session_id=session_id,
        user_id=current_user.id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)
    await db.flush()

    # Commit before streaming so the user message is persisted
    await db.commit()

    async def event_stream():
        try:
            # 1. Embed query
            query_embedding = await get_query_embedding(body.message)

            # 2. Retrieve relevant chunks
            chunks = await query_similar(
                query_embedding=query_embedding,
                user_id=user_id,
                top_k=5,
                document_ids=body.document_ids,
            )

            # Send sources first as a metadata event
            sources_data = json.dumps({"type": "sources", "data": chunks, "session_id": session_id})
            yield f"data: {sources_data}\n\n"

            # 3. Stream LLM response
            full_response = ""
            async for token in stream_answer(body.message, chunks, history):
                full_response += token
                token_data = json.dumps({"type": "token", "data": token})
                yield f"data: {token_data}\n\n"

            # 4. Persist assistant message
            async with db.begin_nested():
                assist_msg = ChatMessage(
                    session_id=session_id,
                    user_id=current_user.id,
                    role="assistant",
                    content=full_response,
                    sources=chunks,
                )
                db.add(assist_msg)
                db.add(UsageLog(
                    user_id=current_user.id,
                    event_type="query",
                    session_id=session_id,
                ))
                # Update session timestamp
                await db.execute(
                    update(ChatSession)
                    .where(ChatSession.id == session_id)
                    .values(updated_at=ChatSession.updated_at)
                )

            await db.commit()

            done_data = json.dumps({"type": "done", "session_id": session_id})
            yield f"data: {done_data}\n\n"

        except Exception as e:
            logger.error(f"Streaming error: {e}")
            error_data = json.dumps({"type": "error", "data": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/history")
async def get_recent_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get recent messages across all sessions."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(20)
    )
    messages = result.scalars().all()
    return [
        {
            "id": str(m.id),
            "session_id": str(m.session_id),
            "role": m.role,
            "content": m.content[:200],
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]
