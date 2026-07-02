# Market Intelligence & Corporate Analysis Dashboard

A modern, wowed-design web application for real-time market intelligence analytics and source-backed RAG AI chat analysis.

## Project Structure
- `/client`: React (Vite + TypeScript) frontend visual dashboard.
- `/server`: Flask (Python 3) JWT authentication, tickers database, and ChromaDB vector store.

---

## Presentation Startup Guide

To present the app, follow these two simple steps to launch the servers:

### 1. Start the Flask Backend Server
Open your terminal, navigate to the `server/` directory, and run the following commands:
```bash
# 1. Navigate to the server folder
cd server

# 2. Activate the python virtual environment
source .venv/bin/activate

# 3. Start the Flask server
python app.py
```
*Note: Make sure your `server/.env` file contains your `GEMINI_API_KEY` (which is already configured).*

### 2. Start the Vite React Frontend
Open a second terminal window, navigate to the `client/` directory, and run:
```bash
# 1. Navigate to the client folder
cd client

# 2. Run the Vite development server
npm run dev
```

### 3. Open the Application
Once both servers are running, open your web browser and go to:
👉 **[http://localhost:5173/](http://localhost:5173/)**

Log in using your account (or register a new one) to present the interactive charts and RAG assistant drawer!
