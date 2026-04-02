"""
Dashboard analytics routes.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timedelta, timezone

from database import get_db
from models import Document, ChatSession, ChatMessage, UsageLog
from utils.auth import get_current_user
from models import User

router = APIRouter()


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return dashboard statistics for the current user."""
    user_id = current_user.id

    # Document counts
    doc_result = await db.execute(
        select(
            func.count(Document.id).label("total"),
            func.sum(Document.file_size).label("total_size"),
            func.count(Document.id).filter(Document.status == "ready").label("ready"),
        ).where(Document.user_id == user_id)
    )
    doc_stats = doc_result.one()

    # Chat stats
    session_result = await db.execute(
        select(func.count(ChatSession.id)).where(ChatSession.user_id == user_id)
    )
    total_sessions = session_result.scalar() or 0

    msg_result = await db.execute(
        select(func.count(ChatMessage.id)).where(ChatMessage.user_id == user_id)
    )
    total_messages = msg_result.scalar() or 0

    # Token usage
    token_result = await db.execute(
        select(func.sum(UsageLog.tokens_used)).where(UsageLog.user_id == user_id)
    )
    total_tokens = token_result.scalar() or 0

    # Queries in last 7 days
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_queries = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == user_id,
            UsageLog.event_type == "query",
            UsageLog.created_at >= week_ago,
        )
    )
    queries_this_week = recent_queries.scalar() or 0

    # Daily query trend (last 7 days)
    trend = []
    for i in range(6, -1, -1):
        day_start = datetime.now(timezone.utc) - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        count_result = await db.execute(
            select(func.count(UsageLog.id)).where(
                UsageLog.user_id == user_id,
                UsageLog.event_type == "query",
                UsageLog.created_at >= day_start,
                UsageLog.created_at < day_end,
            )
        )
        trend.append({
            "date": day_start.strftime("%b %d"),
            "queries": count_result.scalar() or 0,
        })

    # Recent documents
    recent_docs_result = await db.execute(
        select(Document)
        .where(Document.user_id == user_id)
        .order_by(desc(Document.created_at))
        .limit(5)
    )
    recent_docs = [
        {
            "id": str(d.id),
            "name": d.original_name,
            "type": d.file_type,
            "status": d.status,
            "created_at": d.created_at.isoformat(),
        }
        for d in recent_docs_result.scalars().all()
    ]

    # Recent chats
    recent_chats_result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user_id)
        .order_by(desc(ChatSession.updated_at))
        .limit(5)
    )
    recent_chats = [
        {
            "id": str(s.id),
            "title": s.title,
            "updated_at": s.updated_at.isoformat(),
        }
        for s in recent_chats_result.scalars().all()
    ]

    return {
        "documents": {
            "total": doc_stats.total or 0,
            "ready": doc_stats.ready or 0,
            "total_size_bytes": doc_stats.total_size or 0,
        },
        "chats": {
            "total_sessions": total_sessions,
            "total_messages": total_messages,
        },
        "usage": {
            "total_tokens": total_tokens,
            "queries_this_week": queries_this_week,
        },
        "trend": trend,
        "recent_documents": recent_docs,
        "recent_chats": recent_chats,
    }
