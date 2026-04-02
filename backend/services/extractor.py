"""
Document text extraction: PDF, DOCX, TXT
"""
import io
from pathlib import Path
from loguru import logger


def extract_text(file_path: str, file_type: str) -> tuple[str, int]:
    """
    Extract text from a document file.
    Returns (text, page_count).
    """
    path = Path(file_path)
    if file_type == "pdf":
        return _extract_pdf(path)
    elif file_type == "docx":
        return _extract_docx(path)
    elif file_type == "txt":
        return _extract_txt(path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


def _extract_pdf(path: Path) -> tuple[str, int]:
    try:
        import pdfplumber
        pages = []
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
        return "\n\n".join(pages), page_count
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        raise


def _extract_docx(path: Path) -> tuple[str, int]:
    try:
        from docx import Document
        doc = Document(path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        text = "\n\n".join(paragraphs)
        # Approximate page count
        page_count = max(1, len(text) // 3000)
        return text, page_count
    except Exception as e:
        logger.error(f"DOCX extraction error: {e}")
        raise


def _extract_txt(path: Path) -> tuple[str, int]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
        page_count = max(1, len(text) // 3000)
        return text, page_count
    except Exception as e:
        logger.error(f"TXT extraction error: {e}")
        raise
