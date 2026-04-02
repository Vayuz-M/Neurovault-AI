"""
RAG pipeline using Groq LLM + streaming.
"""
from typing import List, Dict, AsyncIterator
from loguru import logger
from config import settings

SYSTEM_PROMPT = """You are NeuroVault AI, an intelligent document assistant.
Answer questions strictly based on the provided context from the user's documents.
If the answer cannot be found in the context, say so clearly.
Always cite which document/section your answer comes from.
Be concise, accurate, and helpful."""


def _build_context(chunks: List[Dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        doc_id = chunk.get("document_id", "unknown")
        text = chunk.get("text", "")
        parts.append(f"[Source {i} | Doc: {doc_id[:8]}...]\n{text}")
    return "\n\n---\n\n".join(parts)


def _build_messages(question: str, context: str, history: List[Dict]) -> List[Dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for msg in history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    user_message = f"""Context from documents:
{context}

---

Question: {question}"""
    messages.append({"role": "user", "content": user_message})
    return messages


def _get_client():
    from groq import Groq
    return Groq(api_key=settings.GROQ_API_KEY)


async def generate_answer(question: str, chunks: List[Dict], history: List[Dict] = None):
    context = _build_context(chunks)
    messages = _build_messages(question, context, history or [])
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=1500,
    )
    return response.choices[0].message.content, response.usage.total_tokens


async def stream_answer(question: str, chunks: List[Dict], history: List[Dict] = None) -> AsyncIterator[str]:
    context = _build_context(chunks)
    messages = _build_messages(question, context, history or [])
    client = _get_client()
    stream = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=messages,
        temperature=0.2,
        max_tokens=1500,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def summarize_document(text: str) -> str:
    truncated = text[:12000]
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": "You are a document summarization expert. Provide a structured, comprehensive summary."},
            {"role": "user", "content": f"Please summarize the following document:\n\n{truncated}"},
        ],
        temperature=0.3,
        max_tokens=800,
    )
    return response.choices[0].message.content


async def extract_key_insights(text: str) -> str:
    truncated = text[:12000]
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.GROQ_MODEL,
        messages=[
            {"role": "system", "content": "Extract the most important insights, facts, and conclusions. Format as bullet points."},
            {"role": "user", "content": truncated},
        ],
        temperature=0.2,
        max_tokens=600,
    )
    return response.choices[0].message.content