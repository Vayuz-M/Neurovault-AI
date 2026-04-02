"""
Smart text chunking: recursive character-based + overlap.
Uses langchain_text_splitters for reliable chunking.
"""
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List


CHUNK_SIZE = 512        # tokens approx
CHUNK_OVERLAP = 64


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into overlapping chunks using recursive character splitter.
    Returns list of chunk strings.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=overlap,
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_text(text)
    # Filter out empty or very short chunks
    return [c.strip() for c in chunks if len(c.strip()) > 50]
