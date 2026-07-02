import os
import jwt
import datetime
import random
from functools import wraps
import yfinance as yf
from flask import Flask, jsonify, request
from flask_cors import CORS
from extensions import db, migrate, bcrypt
from models import User
from tickers import search_tickers_db, TICKERS_DB
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Basic configurations
# Define SQLite database path inside the server directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(BASE_DIR, 'market_intelligence.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-12345')

# Enable CORS for frontend requests
CORS(app)

# Initialize extensions
db.init_app(app)
migrate.init_app(app, db)
bcrypt.init_app(app)

# Custom embedding function to bypass buggy CoreML / onnxruntime on macOS
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings
class GeminiOrHashEmbeddingFunction(EmbeddingFunction):
    def __call__(self, input: Documents) -> Embeddings:
        import os
        import requests
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
                        raise Exception(f"Gemini API returned status {res.status_code}")
                return embeddings
            except Exception as e:
                print(f"Gemini embedding failed, falling back to hashing: {e}")

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

# Initialize ChromaDB Persistent Client
import chromadb
CHROMA_PATH = os.path.join(BASE_DIR, "chroma_db")
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
embedding_fn = GeminiOrHashEmbeddingFunction()
chroma_collection = chroma_client.get_or_create_collection(name="market_documents", embedding_function=embedding_fn)

# Decorator to verify JWT token and inject current user
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        # Check Authorization header (format: Bearer <token>)
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]

        if not token:
            return jsonify({'error': 'Token is missing'}), 401

        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            current_user = db.session.get(User, payload['user_id'])
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(current_user, *args, **kwargs)

    return decorated

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "success",
        "message": "Flask server is healthy and running"
    }), 200

@app.route('/api/hello', methods=['GET'])
def hello():
    return jsonify({
        "message": "Hello from the Flask backend!"
    }), 200

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided"}), 400

        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        # Basic validations
        if not username or not email or not password:
            return jsonify({"error": "Missing required fields: username, email, and password"}), 400

        # Check if user already exists
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already exists"}), 400

        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already exists"}), 400

        # Create new user
        new_user = User(username=username, email=email)
        new_user.set_password(password)

        db.session.add(new_user)
        db.session.commit()

        return jsonify({
            "message": "User registered successfully",
            "user": new_user.to_dict()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No credentials provided"}), 400

        identity = data.get('username')  # can be username or email
        password = data.get('password')

        if not identity or not password:
            return jsonify({"error": "Missing username/email or password"}), 400

        # Find user by username or email
        user = User.query.filter((User.username == identity) | (User.email == identity)).first()

        if not user or not user.check_password(password):
            return jsonify({"error": "Invalid username/email or password"}), 401

        # Generate JWT Token (valid for 24 hours)
        payload = {
            'user_id': user.id,
            'exp': datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=24),
            'iat': datetime.datetime.now(datetime.timezone.utc)
        }
        token = jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

        return jsonify({
            "message": "Login successful",
            "token": token,
            "user": user.to_dict()
        }), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify({
        "user": current_user.to_dict()
    }), 200

def get_mock_data(ticker, range_param):
    points = 24
    base_price = 150.0
    if ticker == 'MSFT': base_price = 420.0
    elif ticker == 'AAPL': base_price = 210.0
    elif ticker == 'GOOGL': base_price = 180.0
    elif ticker == 'TSLA': base_price = 190.0
    
    data_points = []
    current_price = base_price
    
    for i in range(points):
        # random walk with slightly positive drift
        change = random.uniform(-0.015, 0.02) * current_price
        current_price += change
        
        if range_param == '1d':
            # 15-minute increments starting from 9:30 AM
            hour = 9 + (i * 15 // 60)
            minute = (i * 15) % 60
            time_str = f"{hour:02d}:{minute:02d}"
        elif range_param == '5d':
            day = (i // 5) + 1
            hour = 9 + (i % 5) * 2
            time_str = f"Day {day} {hour:02d}:00"
        elif range_param == '1m':
            time_str = f"2026-06-{i+1:02d}"
        else:  # 1y
            month_names = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"]
            time_str = f"{month_names[i % 12]} 2025/26"
            
        data_points.append({
            "time": time_str,
            "price": round(current_price, 2),
            "open": round(current_price - change, 2),
            "high": round(max(current_price, current_price - change) + random.uniform(0.1, 1.5), 2),
            "low": round(min(current_price, current_price - change) - random.uniform(0.1, 1.5), 2),
            "volume": random.randint(150000, 950000)
        })
    return data_points

@app.route('/api/market-data', methods=['GET'])
@token_required
def get_market_data(current_user):
    ticker = request.args.get('ticker', 'AAPL').upper()
    range_param = request.args.get('range', '1d').lower()


    # Map frontend range parameters to yfinance periods and intervals
    # ranges: '1d', '5d', '1m', '1y'
    range_mappings = {
        '1d': {'period': '1d', 'interval': '5m'},
        '5d': {'period': '5d', 'interval': '30m'},
        '1m': {'period': '1mo', 'interval': '1d'},
        '1y': {'period': '1y', 'interval': '1d'}
    }

    if range_param not in range_mappings:
        return jsonify({"error": f"Range {range_param} is not supported. Use one of {list(range_mappings.keys())}"}), 400

    mapping = range_mappings[range_param]

    try:
        # Fetch ticker info from yfinance
        stock = yf.Ticker(ticker)
        hist = stock.history(period=mapping['period'], interval=mapping['interval'])

        if hist.empty:
            # Fallback to mock data if yfinance returns empty response (e.g. rate limit / market closed details)
            print(f"yfinance returned empty data for {ticker} ({range_param}). Falling back to mock data.")
            mock_data = get_mock_data(ticker, range_param)
            return jsonify({
                "source": "mock_fallback",
                "ticker": ticker,
                "range": range_param,
                "data": mock_data
            }), 200

        data_points = []
        for timestamp, row in hist.iterrows():
            if range_param in ['1d', '5d']:
                time_str = timestamp.strftime('%H:%M') if range_param == '1d' else timestamp.strftime('%a %H:%M')
            else:
                time_str = timestamp.strftime('%Y-%m-%d')

            data_points.append({
                "time": time_str,
                "price": round(row['Close'], 2),
                "open": round(row['Open'], 2),
                "high": round(row['High'], 2),
                "low": round(row['Low'], 2),
                "volume": int(row['Volume'])
            })

        return jsonify({
            "source": "yfinance",
            "ticker": ticker,
            "range": range_param,
            "data": data_points
        }), 200

    except Exception as e:
        print(f"yfinance error for {ticker}: {str(e)}. Falling back to mock data.")
        # Fail-safe mock fallback to keep dashboard visual layout intact
        mock_data = get_mock_data(ticker, range_param)
        return jsonify({
            "source": "mock_fallback_error",
            "ticker": ticker,
            "range": range_param,
            "data": mock_data
        }), 200

@app.route('/api/upload-pdf', methods=['POST'])
@token_required
def upload_pdf(current_user):
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part in the request"}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        if not file.filename.lower().endswith('.pdf'):
            return jsonify({"error": "Only PDF files are allowed"}), 400

        from werkzeug.utils import secure_filename
        filename = secure_filename(file.filename)

        DOCS_DIR = os.path.join(BASE_DIR, "documents")
        if not os.path.exists(DOCS_DIR):
            os.makedirs(DOCS_DIR)

        filepath = os.path.join(DOCS_DIR, filename)
        file.save(filepath)

        # Index the PDF immediately
        from ingest import ingest_pdf_file, guess_ticker_from_filename
        success = ingest_pdf_file(filepath)

        if success:
            ticker = guess_ticker_from_filename(filename)
            return jsonify({
                "message": f"Successfully uploaded and indexed {filename}",
                "filename": filename,
                "ticker": ticker
            }), 200
        else:
            return jsonify({"error": "Failed to extract text or index the document"}), 500

    except Exception as e:
        print(f"Error in upload_pdf: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route('/api/tickers/search', methods=['GET'])
@token_required
def search_tickers(current_user):
    import requests
    query = request.args.get('q', '').strip()
    
    if not query:
        # Return default popular selections
        from tickers import TICKERS_DB
        return jsonify({
            "query": query,
            "results": TICKERS_DB,
            "source": "local_defaults"
        }), 200

    try:
        # Query Yahoo Finance search lookup API
        url = "https://query2.finance.yahoo.com/v1/finance/search"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        params = {
            "q": query,
            "quotesCount": 15,
            "newsCount": 0
        }
        response = requests.get(url, params=params, headers=headers, timeout=5)
        
        if response.status_code != 200:
            # Fallback to local filtering
            from tickers import search_tickers_db
            local_results = search_tickers_db(query)
            return jsonify({
                "query": query,
                "results": local_results,
                "source": "local_fallback_http_error"
            }), 200

        data = response.json()
        quotes = data.get("quotes", [])
        
        results = []
        for q in quotes:
            quote_type = q.get("quoteType", "")
            # Only include stock assets and market indices
            if quote_type not in ["EQUITY", "INDEX"]:
                continue
                
            symbol = q.get("symbol", "")
            name = q.get("shortname") or q.get("longname") or symbol
            exchange = q.get("exchange", "")
            sector = q.get("sector") or q.get("industry") or ("Indices" if quote_type == "INDEX" else "Stock")
            
            results.append({
                "symbol": symbol,
                "name": name,
                "category": sector,
                "exchange": exchange
            })
            
        return jsonify({
            "query": query,
            "results": results,
            "source": "yfinance_api"
        }), 200

    except Exception as e:
        print(f"Error in tickers search API: {str(e)}")
        # Fallback to local search
        from tickers import search_tickers_db
        local_results = search_tickers_db(query)
        return jsonify({
            "query": query,
            "results": local_results,
            "source": "local_fallback_exception"
        }), 200

@app.route('/api/chat', methods=['POST'])
@token_required
def chat(current_user):
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        message = data.get('message', '').strip()
        if not message:
            return jsonify({"error": "Message content cannot be empty"}), 400

        # Try to find a matching ticker or company name in TICKERS_DB
        msg_upper = message.upper()
        matched_ticker = None
        for item in TICKERS_DB:
            name_parts = item["name"].upper().replace("LTD.", "").replace("CORP.", "").replace("INC.", "").split()
            symbol_clean = item["symbol"].split('.')[0].upper()

            if symbol_clean in msg_upper or item["symbol"].upper() in msg_upper:
                matched_ticker = item
                break

            matched_by_name = False
            for part in name_parts:
                if len(part) > 3 and part in msg_upper:
                    matched_by_name = True
                    break
            if matched_by_name:
                matched_ticker = item
                break

        # Query ChromaDB for context
        # We retrieve top 3 relevant chunks
        try:
            query_filter = {"ticker": matched_ticker["symbol"]} if matched_ticker else None
            db_results = chroma_collection.query(
                query_texts=[message],
                n_results=3,
                where=query_filter
            )
        except Exception as db_err:
            print(f"ChromaDB query error: {str(db_err)}")
            db_results = {}

        # Format context chunks
        context_parts = []
        sources = []

        if db_results and db_results.get('documents') and len(db_results['documents']) > 0:
            documents = db_results['documents'][0]
            metadatas = db_results['metadatas'][0]

            for idx, doc in enumerate(documents):
                meta = metadatas[idx]
                context_parts.append(f"[Source: {meta['source']}, Page {meta['page']}]:\n{doc}")
                source_item = {"filename": meta['source'], "page": meta['page']}
                if source_item not in sources:
                    sources.append(source_item)

        context_text = "\n\n".join(context_parts)

        # Check for Gemini API key
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

        if not GEMINI_API_KEY or GEMINI_API_KEY == "YOUR_GEMINI_API_KEY_HERE":
            # API Key not configured yet - return mock RAG answer listing retrieved contexts
            if sources:
                reply = f"Hello {current_user.username}! I retrieved matching text chunks from the vector database, but the **`GEMINI_API_KEY`** is not configured in `/server/.env` yet!\n\n" \
                        f"**Here is the relevant data I retrieved from the annual reports:**\n"
                for idx, src in enumerate(sources):
                    reply += f"\n* **{src['filename']} (Page {src['page']})**:\n> \"{documents[idx][:250]}...\"\n"
                reply += "\n*Please set your `GEMINI_API_KEY` in `/server/.env` to enable full AI answers!*"
            else:
                reply = f"Hello {current_user.username}! I checked the vector database but found no matching reports or documents. " \
                        f"Please upload a PDF annual report using the sidebar upload widget, or add your `GEMINI_API_KEY` in `/server/.env` to start chatting!"
        else:
            # Query Gemini API via REST
            import requests

            if sources:
                system_prompt = f"You are an expert financial assistant. Use the following retrieved financial annual report context to answer the user's question.\n" \
                                f"Always cite the document name and page number when referring to the context.\n" \
                                f"If the context does not contain the answer, say 'Based on the uploaded documents, I couldn't find the exact answer, but...' and then give a helpful answer using your general knowledge.\n\n" \
                                f"Retrieved Context:\n{context_text}\n\n" \
                                f"User Question: {message}\n"
            else:
                system_prompt = f"You are a helpful Market Intelligence AI assistant.\n" \
                                f"No specific document context was found in the database. Answer the user's question using your general knowledge. " \
                                f"If the user is asking about a specific stock price, you can mention they can check the dashboard charts.\n\n" \
                                f"User Question: {message}\n"

            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
                payload = {
                    "contents": [{
                        "parts": [{"text": system_prompt}]
                    }],
                    "generationConfig": {
                        "temperature": 0.2
                    }
                }
                headers = {"Content-Type": "application/json"}
                response = requests.post(url, json=payload, headers=headers, timeout=10)

                if response.status_code == 200:
                    res_data = response.json()
                    reply = res_data["candidates"][0]["content"]["parts"][0]["text"]
                else:
                    reply = f"I retrieved relevant context, but error calling Gemini API: HTTP {response.status_code}. Response: {response.text}"
            except Exception as api_err:
                reply = f"I retrieved relevant context, but failed to connect to Gemini API: {str(api_err)}"

        return jsonify({
            "reply": reply,
            "user_message": message,
            "sources": sources,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }), 200

    except Exception as e:
        print(f"Error in chat endpoint: {str(e)}")
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
