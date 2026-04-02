from pinecone import Pinecone, ServerlessSpec
from config import settings
from config import settings

print("API KEY:", settings.PINECONE_API_KEY)

pc = Pinecone(api_key=settings.PINECONE_API_KEY)

index_name = settings.PINECONE_INDEX_NAME

# Check if index exists
if index_name not in [i.name for i in pc.list_indexes()]:
    print("Creating Pinecone index...")

    pc.create_index(
        name=index_name,
        dimension=384,  # IMPORTANT: matches all-MiniLM-L6-v2
        metric="cosine",
        spec=ServerlessSpec(
            cloud="aws",
            region=settings.PINECONE_ENVIRONMENT
        )
    )

    print("Index created!")
else:
    print("Index already exists!")