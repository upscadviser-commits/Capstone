import { useState, useEffect } from 'react';
import './App.css';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

function App() {
  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('auth_token'));
  const [isLoginView, setIsLoginView] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [verifyingToken, setVerifyingToken] = useState<boolean>(!!localStorage.getItem('auth_token'));

  // Form states
  const [username, setUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');

  // Status feedback
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Verify token on load
  const verifyToken = async (authToken: string) => {
    setVerifyingToken(true);
    try {
      const response = await fetch('http://localhost:5000/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // Token invalid or expired
        handleLogout();
      }
    } catch (err) {
      console.error('Error verifying token:', err);
      // Don't log out if it's a network error, keep token
    } finally {
      setVerifyingToken(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  // Auth Handlers
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username || !email || !password) {
      setErrorMsg('All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setSuccessMsg('Registration successful! Please login.');
      setIsLoginView(true);
      // Clean inputs except username to ease login
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Server error, please try again later');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username || !password) {
      setErrorMsg('Please enter your credentials');
      return;
    }

    setAuthLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('auth_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setSuccessMsg('Logged in successfully!');
      // Reset form
      setUsername('');
      setPassword('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
    setUser(null);
    setSuccessMsg('Logged out successfully.');
    setErrorMsg('');
  };

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
        {/* Verification Loader */}
        {verifyingToken ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Authenticating your session...</p>
          </div>
        ) : user ? (
          /* LOGGED IN VIEW */
          <div className="dashboard-logged-in animate-fade-in">
            <section className="welcome-banner">
              <div className="welcome-text">
                <h2>Welcome back, <span className="highlight">{user.username}</span>!</h2>
                <p className="user-meta">Account Email: {user.email} &bull; Joined: {new Date(user.created_at).toLocaleDateString()}</p>
              </div>
              <button className="btn-secondary" onClick={handleLogout}>Log Out</button>
            </section>

            {/* Status Panel */}
            <section className="status-grid">
              <div className="status-card">
                <h3>Authentication Status</h3>
                <div className="status-badge online">
                  <span className="dot"></span>
                  Authenticated (JWT Active)
                </div>
                <p className="card-desc">Token stored securely in LocalStorage</p>
              </div>

              <div className="status-card">
                <h3>Backend Authorization</h3>
                <button 
                  className="btn-link"
                  onClick={() => token && verifyToken(token)}
                >
                  Verify Token with /api/auth/me
                </button>
                <p className="card-desc">Secure headers validation working</p>
              </div>
            </section>

            {/* Roadmap Overview */}
            <section className="roadmap-section">
              <h2>Application Progress Roadmap</h2>
              <div className="roadmap-timeline">
                <div className="timeline-item active done">
                  <div className="step-num">✓</div>
                  <div className="step-content">
                    <h4>Initialization & Environment</h4>
                    <p>Folder structure setup, basic API endpoints, and React-Flask link verified.</p>
                    <span className="tag-status done">Completed</span>
                  </div>
                </div>
                <div className="timeline-item active">
                  <div className="step-num">2</div>
                  <div className="step-content">
                    <h4>Authentication System</h4>
                    <p>SQLite schema migrated, secure bcrypt hashing, session/JWT verification working.</p>
                    <span className="tag-status done">In Progress (Review)</span>
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
          </div>
        ) : (
          /* LOGGED OUT VIEW - AUTH FORM */
          <div className="auth-portal-card animate-fade-in">
            <div className="auth-toggle">
              <button 
                className={`toggle-btn ${isLoginView ? 'active' : ''}`}
                onClick={() => { setIsLoginView(true); setErrorMsg(''); setSuccessMsg(''); }}
              >
                Sign In
              </button>
              <button 
                className={`toggle-btn ${!isLoginView ? 'active' : ''}`}
                onClick={() => { setIsLoginView(false); setErrorMsg(''); setSuccessMsg(''); }}
              >
                Sign Up
              </button>
            </div>

            <div className="auth-body">
              {/* Feedback messages */}
              {errorMsg && <div className="alert-message error">{errorMsg}</div>}
              {successMsg && <div className="alert-message success">{successMsg}</div>}

              {isLoginView ? (
                /* LOGIN FORM */
                <form onSubmit={handleLogin} className="auth-form">
                  <h2>Access your Dashboard</h2>
                  <p className="form-sub">Enter your username or email address and password.</p>

                  <div className="input-group">
                    <label htmlFor="username">Username or Email</label>
                    <input 
                      type="text" 
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. janesmith"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="password">Password</label>
                    <input 
                      type="password" 
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary auth-submit" disabled={authLoading}>
                    {authLoading ? 'Signing In...' : 'Sign In'}
                  </button>
                </form>
              ) : (
                /* REGISTRATION FORM */
                <form onSubmit={handleRegister} className="auth-form">
                  <h2>Create a new Account</h2>
                  <p className="form-sub">Join the platform to access market intelligence.</p>

                  <div className="input-group">
                    <label htmlFor="reg-username">Username</label>
                    <input 
                      type="text" 
                      id="reg-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. janesmith"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="reg-email">Email Address</label>
                    <input 
                      type="email" 
                      id="reg-email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. jane@example.com"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="reg-password">Password</label>
                    <input 
                      type="password" 
                      id="reg-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label htmlFor="reg-confirm-password">Confirm Password</label>
                    <input 
                      type="password" 
                      id="reg-confirm-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                    />
                  </div>

                  <button type="submit" className="btn-primary auth-submit" disabled={authLoading}>
                    {authLoading ? 'Registering...' : 'Register'}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="dashboard-footer">
        <p>Market Intelligence App &copy; {new Date().getFullYear()} &bull; Git Flow: feature/auth</p>
      </footer>
    </div>
  );
}

export default App;
