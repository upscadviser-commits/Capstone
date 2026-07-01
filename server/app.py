import os
import jwt
import datetime
from functools import wraps
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

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, host='0.0.0.0', port=5000)
