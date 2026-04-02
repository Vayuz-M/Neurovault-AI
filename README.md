<div align="center">

# 🧠 NeuroVault AI
### Intelligent Knowledge Retrieval Platform

![Python](https://img.shields.io/badge/Python-3.11-blue?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-green?style=flat-square&logo=fastapi)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Pinecone](https://img.shields.io/badge/Pinecone-Vector_DB-purple?style=flat-square)
![Groq](https://img.shields.io/badge/Groq-LLaMA3-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Upload any document. Ask any question. Get instant AI-powered answers with citations.**

[Features](#features) • [Tech Stack](#tech-stack) • [Quick Start](#quick-start) • [Screenshots](#screenshots) • [API Docs](#api-docs)

</div>

---

## 📌 What is NeuroVault AI?

NeuroVault AI is a production-ready, full-stack web application that transforms 
how users interact with their documents. Upload PDF, DOCX, or TXT files and 
instantly chat with them using natural language — powered by a full 
Retrieval-Augmented Generation (RAG) pipeline.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📂 Document Upload | PDF, DOCX, TXT — up to 50MB |
| 💬 AI Chat | ChatGPT-like streaming interface with citations |
| 🔍 Semantic Search | Natural language search across all documents |
| 🧠 RAG Pipeline | Chunk → Embed → Retrieve → Generate |
| 📊 Dashboard | Usage analytics, storage, query trends |
| ✨ AI Actions | One-click summarization and insight extraction |
| 🎙️ Voice Input | Speech-to-text via Web Speech API |
| 🌙 Dark Mode | Full dark/light theme support |
| 🔐 Auth | JWT authentication with bcrypt |
| 🚀 Streaming | Real-time streaming responses via SSE |

---

## 🏗️ How It Works (RAG Pipeline)
```
User uploads document
        ↓
Text extraction (PDF/DOCX/TXT)
        ↓
Smart chunking (recursive, overlapping)
        ↓
Vector embeddings (SentenceTransformers)
        ↓
Store in Pinecone vector database
        ↓
User asks a question
        ↓
Question → embedding → Pinecone similarity search
        ↓
Top-5 relevant chunks retrieved
        ↓
Chunks + question → Groq LLaMA3
        ↓
Streamed answer with source citations
```

---

## 🛠️ Tech Stack

### Frontend
- React 18 + Vite
- Tailwind CSS
- React Router
- Recharts (analytics)
- React Markdown

### Backend
- Python FastAPI (async)
- SQLAlchemy 2.0 (async)
- JWT + bcrypt authentication
- Server-Sent Events (streaming)
- Rate limiting (SlowAPI)

### AI & Data
- Groq LLaMA3 70B (LLM)
- SentenceTransformers all-MiniLM-L6-v2 (embeddings)
- Pinecone (vector database)
- LangChain text splitters (chunking)
- pdfplumber + python-docx (extraction)

### Infrastructure
- PostgreSQL
- Docker + Docker Compose
- GitHub Actions CI/CD

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL
- Groq API key (free at console.groq.com)
- Pinecone API key (free at pinecone.io)

### 1. Clone the repo
```bash
git clone https://github.com/your-username/neurovault-ai.git
cd neurovault-ai
```

### 2. Backend setup
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Fill in your API keys
uvicorn main:app --reload --port 8000
```

### 3. Frontend setup
```bash
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000 > .env
npm run dev
```

### 4. Open the app
```
http://localhost:5173
```

---

## ⚙️ Environment Variables

Create `backend/.env` with:
```env
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/neurovault
SECRET_KEY=your-secret-key
GROQ_API_KEY=gsk_your-groq-key
GROQ_MODEL=llama-3.3-70b-versatile
PINECONE_API_KEY=your-pinecone-key
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_NAME=neurovault
UPLOAD_DIR=./uploads
ALLOWED_ORIGINS=["http://localhost:5173"]
```

---

## 📁 Project Structure
```
neurovault-ai/
├── frontend/                  # React + Vite app
│   └── src/
│       ├── pages/             # Login, Register, Dashboard, Chat, Documents, Search
│       ├── components/        # Layout, UI components
│       ├── context/           # Auth, Theme context
│       └── services/          # Axios API clients
├── backend/                   # FastAPI app
│   ├── routes/                # auth, documents, chat, search, dashboard
│   ├── services/              # RAG, embeddings, vector store, extractor
│   ├── models/                # SQLAlchemy ORM models
│   └── utils/                 # JWT auth helpers
├── database/                  # PostgreSQL schema
├── docker-compose.yml
└── README.md
```

---

## 📖 API Documentation

Interactive Swagger UI available at:
```
http://localhost:8000/docs
```

Key endpoints:

| Method | Endpoint | Description |
|---|---|---|
| POST | /auth/register | Create account |
| POST | /auth/login | Get JWT token |
| POST | /documents/upload | Upload document |
| GET | /documents/ | List documents |
| POST | /chat/message | Send message (streaming) |
| GET | /chat/sessions | List chat sessions |
| GET | /search/ | Semantic search |
| GET | /dashboard/stats | Usage analytics |

---

## 🐳 Docker Deployment
```bash
cp .env.example .env   # Fill in your keys
docker compose up --build
```

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

<div align="center">
Built with ❤️ using FastAPI, React, Groq, and Pinecone
</div>