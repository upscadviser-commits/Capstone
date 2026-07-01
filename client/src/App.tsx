import { useState, useEffect } from 'react';
import './App.css';

interface ServerResponse {
  message: string;
}

function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [backendMessage, setBackendMessage] = useState<string>('');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'error' | 'connecting'>('connecting');
  const [fetchCount, setFetchCount] = useState<number>(0);

  const fetchBackendData = async () => {
    setLoading(true);
    setBackendStatus('connecting');
    try {
      const response = await fetch('http://localhost:5000/api/hello');
      if (!response.ok) {
        throw new Error('Server responded with an error status');
      }
      const data: ServerResponse = await response.json();
      setBackendMessage(data.message);
      setBackendStatus('connected');
    } catch (err) {
      console.error('Error fetching backend status:', err);
      setBackendMessage('Could not reach the Flask server at http://localhost:5000');
      setBackendStatus('error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, [fetchCount]);

  return (
    <div className="app-container">
      <header className="dashboard-header">
        <div className="logo-container">
          <div className="logo-spark"></div>
          <h1>Market Intelligence App</h1>
        </div>
        <p className="subtitle">Real-time market analytics, charting, and RAG-powered agent assistance.</p>
      </header>

      <main className="dashboard-content">
        {/* Status Panel */}
        <section className="status-grid">
          <div className="status-card">
            <h3>Frontend Client</h3>
            <div className="status-badge online">
              <span className="dot animate-pulse"></span>
              React + TypeScript (Vite)
            </div>
            <p className="card-desc">Running locally on port 5173</p>
          </div>

          <div className="status-card">
            <h3>Backend Server</h3>
            <div className={`status-badge ${backendStatus}`}>
              <span className="dot"></span>
              {backendStatus === 'connected' && 'Flask (Connected)'}
              {backendStatus === 'connecting' && 'Flask (Connecting...)'}
              {backendStatus === 'error' && 'Flask (Offline)'}
            </div>
            <p className="card-desc">Running locally on port 5000</p>
          </div>
        </section>

        {/* Hello World Connection Test */}
        <section className="connection-section">
          <h2>Step 1: Backend Connection Test</h2>
          <div className="connection-card">
            <div className="card-header">
              <span className="terminal-dot red"></span>
              <span className="terminal-dot yellow"></span>
              <span className="terminal-dot green"></span>
              <span className="terminal-title">API Response Terminal</span>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="loader-container">
                  <div className="spinner"></div>
                  <p>Fetching API data...</p>
                </div>
              ) : (
                <div className="terminal-content">
                  <div className="console-line">
                    <span className="prompt">$</span> fetch http://localhost:5000/api/hello
                  </div>
                  <div className={`response-output ${backendStatus}`}>
                    {backendMessage}
                  </div>
                </div>
              )}
            </div>
            <div className="card-footer">
              <button 
                className="btn-primary" 
                onClick={() => setFetchCount(prev => prev + 1)}
                disabled={loading}
              >
                {loading ? 'Fetching...' : 'Re-test Connection'}
              </button>
            </div>
          </div>
        </section>

        {/* Feature Roadmap Overview */}
        <section className="roadmap-section">
          <h2>Application Steps & Deliverables</h2>
          <div className="roadmap-timeline">
            <div className="timeline-item active">
              <div className="step-num">1</div>
              <div className="step-content">
                <h4>Initialization & Environment</h4>
                <p>Establishing structure, basic API server, and verified greeting connection.</p>
                <span className="tag-status done">In Progress (Review)</span>
              </div>
            </div>
            <div className="timeline-item locked">
              <div className="step-num">2</div>
              <div className="step-content">
                <h4>Authentication System</h4>
                <p>Implement secure user registration, session management, and login UI.</p>
                <span className="tag-status">Locked</span>
              </div>
            </div>
            <div className="timeline-item locked">
              <div className="step-num">3</div>
              <div className="step-content">
                <h4>Market Data Engine (Charts)</h4>
                <p>Fetch stock market statistics via financial API and display interactive chart.</p>
                <span className="tag-status">Locked</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="dashboard-footer">
        <p>Market Intelligence App &copy; {new Date().getFullYear()} &bull; Git Flow: setup/init</p>
      </footer>
    </div>
  );
}

export default App;
