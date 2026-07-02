import os
import sys
import pypdf
import chromadb
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

# Custom embedding function to bypass buggy CoreML / onnxruntime on macOS
class GeminiOrHashEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: Documents) -> Embeddings:
        import os
        import requests
        
        # Load dotenv to get API key if run directly from CLI
        from dotenv import load_dotenv
        load_dotenv()
        
        key = os.environ.get("GEMINI_API_KEY")
        if key and key != "YOUR_GEMINI_API_KEY_HERE":
            try:
                embeddings = []
                for text in input:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={key}"
                    payload = {
                        "model": "models/gemini-embedding-2",
                        "content": {"parts": [{"text": text}]}
                    }
                    res = requests.post(url, json=payload, timeout=8)
                    if res.status_code == 200:
                        val = res.json()["embedding"]["values"]
                        embeddings.append(val)
                    else:
                        raise Exception(f"Gemini API returned status {res.status_code}: {res.text}")
                return embeddings
            except Exception as e:
                print(f"Gemini embedding failed, falling back to hashing: {e}")
        
        # CPU Hashing Fallback (100% stable, 3072 dimensions)
        import hashlib
        embeddings = []
        for text in input:
            vector = []
            for i in range(3072):
                h = hashlib.sha256(f"{text}_{i}".encode('utf-8')).hexdigest()
                val = (int(h[:8], 16) / 4294967295.0) * 2.0 - 1.0
                vector.append(val)
            embeddings.append(vector)
        return embeddings

# Initialize local persistent client
CHROMA_PATH = os.path.join(os.path.dirname(__file__), "chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
embedding_fn = GeminiOrHashEmbeddingFunction()
collection = chroma_client.get_or_create_collection(name="market_documents", embedding_function=embedding_fn)

def guess_ticker_from_filename(filename):
    """
    Guess which ticker symbol this PDF belongs to by scanning its filename
    against popular stocks.
    """
    fn = filename.upper()
    if "RELIANCE" in fn:
        return "RELIANCE.NS"
    elif "TCS" in fn:
        return "TCS.NS"
    elif "INFY" in fn or "INFOSYS" in fn:
        return "INFY.NS"
    elif "HDFCBANK" in fn or "HDFC" in fn:
        return "HDFCBANK.NS"
    elif "ICICI" in fn:
        return "ICICIBANK.NS"
    elif "SBIN" in fn or "SBI" in fn:
        return "SBIN.NS"
    elif "TATASTEEL" in fn:
        return "TATASTEEL.NS"
    elif "TATAMOTORS" in fn:
        return "TATAMOTORS.NS"
    elif "TATAPOWER" in fn:
        return "TATAPOWER.NS"
    elif "AAPL" in fn or "APPLE" in fn:
        return "AAPL"
    elif "MSFT" in fn or "MICROSOFT" in fn:
        return "MSFT"
    elif "GOOG" in fn or "ALPHABET" in fn:
        return "GOOGL"
    elif "TSLA" in fn or "TESLA" in fn:
        return "TSLA"
    return "GLOBAL" # General fallback

def chunk_text(text, chunk_size=800, overlap=150):
    """
    Split text into character chunks with overlap.
    """
    chunks = []
    if not text:
        return chunks
        
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunks.append(text[start:end])
        start += (chunk_size - overlap)
        
    return chunks

def ingest_pdf_file(filepath):
    """
    Extract, chunk, and index a PDF file into ChromaDB collection.
    """
    if not os.path.exists(filepath):
        print(f"Error: File not found: {filepath}")
        return False
        
    filename = os.path.basename(filepath)
    ticker = guess_ticker_from_filename(filename)
    
    try:
        print(f"Ingesting {filename} (guessed ticker: {ticker})...")
        reader = pypdf.PdfReader(filepath)
        total_pages = len(reader.pages)
        
        documents = []
        metadatas = []
        ids = []
        
        chunk_counter = 0
        for page_idx in range(total_pages):
            page = reader.pages[page_idx]
            page_text = page.extract_text()
            if not page_text or not page_text.strip():
                continue
                
            page_chunks = chunk_text(page_text)
            for c_idx, chunk in enumerate(page_chunks):
                chunk_counter += 1
                doc_id = f"{filename}_p{page_idx+1}_c{c_idx+1}"
                
                documents.append(chunk)
                metadatas.append({
                    "source": filename,
                    "page": page_idx + 1,
                    "ticker": ticker
                })
                ids.append(doc_id)
        
        # Batch insert to ChromaDB
        if documents:
            collection.add(
                documents=documents,
                metadatas=metadatas,
                ids=ids
            )
            print(f"Successfully indexed {filename}: {chunk_counter} text chunks created across {total_pages} pages.")
            return True
        else:
            print(f"Warning: No readable text extracted from {filename}.")
            return False
            
    except Exception as e:
        print(f"Error indexing {filename}: {str(e)}")
        return False

def ingest_directory(directory):
    """
    Ingest all PDF files in a directory.
    """
    if not os.path.exists(directory):
        print(f"Directory not found: {directory}")
        return
        
    files = [f for f in os.listdir(directory) if f.endswith(".pdf")]
    if not files:
        print(f"No PDF files found in {directory}.")
        return
        
    success_count = 0
    for filename in files:
        filepath = os.path.join(directory, filename)
        if ingest_pdf_file(filepath):
            success_count += 1
            
    print(f"Ingestion complete: {success_count} / {len(files)} files successfully indexed.")

if __name__ == "__main__":
    # If run directly, ingest any PDFs in server/documents/
    DOCS_DIR = os.path.join(os.path.dirname(__file__), "documents")
    if not os.path.exists(DOCS_DIR):
        os.makedirs(DOCS_DIR)
        
    if len(sys.argv) > 1:
        # User specified a specific file path
        target_path = sys.argv[1]
        if os.path.isdir(target_path):
            ingest_directory(target_path)
        else:
            ingest_pdf_file(target_path)
    else:
        ingest_directory(DOCS_DIR)
