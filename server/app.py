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

        # Analyze simple keywords to formulate context-aware answers
        msg_upper = message.upper()
        if "AAPL" in msg_upper or "APPLE" in msg_upper:
            reply = "I see you're interested in Apple Inc. (AAPL). Its pricing chart shows current trends on your dashboard. In Step 5, I'll connect ChromaDB to pull financial PDF filings and answer specific operational questions!"
        elif "MSFT" in msg_upper or "MICROSOFT" in msg_upper:
            reply = "Microsoft (MSFT) is a core ticker on our board. In the upcoming RAG integration step, I will be able to query its latest quarterly reports directly from ChromaDB vector stores."
        elif "TSLA" in msg_upper or "TESLA" in msg_upper:
            reply = "Tesla (TSLA) stock price is highly dynamic. Once ChromaDB is set up in Step 5, I will retrieve and analyze Tesla's investor letters to answer your questions with source citations."
        elif "GOOG" in msg_upper or "ALPHABET" in msg_upper:
            reply = "Google / Alphabet (GOOGL) has strong market presence. Step 5 will enable me to search Google's 10-K and 10-Q reports to provide grounded answers here."
        else:
            reply = f"Hello {current_user.username}! I am your Market Intelligence assistant. I can see your message: '{message}'. In Step 5, we will set up ChromaDB to retrieve source-backed financial documents to answer in-depth queries."

        return jsonify({
            "reply": reply,
            "user_message": message,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }), 200

    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
