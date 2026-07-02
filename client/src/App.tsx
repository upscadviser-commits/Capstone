import { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import { RefreshCw, Menu, X, Send } from 'lucide-react';
import './App.css';

interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

interface StockPoint {
  time: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
}

interface ChatMessage {
  sender: 'user' | 'agent';
  text: string;
  time: string;
}

const SUPPORTED_TICKERS = [
  { value: 'AAPL', label: 'Apple Inc. (AAPL)' },
  { value: 'MSFT', label: 'Microsoft Corp. (MSFT)' },
  { value: 'GOOGL', label: 'Alphabet Inc. (GOOGL)' },
  { value: 'TSLA', label: 'Tesla Inc. (TSLA)' }
];

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

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Chart A states (Left Chart)
  const [tickerA, setTickerA] = useState<string>('AAPL');
  const [rangeA, setRangeA] = useState<string>('1d');
  const [dataA, setDataA] = useState<StockPoint[]>([]);
  const [loadingA, setLoadingA] = useState<boolean>(false);
  const [errorA, setErrorA] = useState<string>('');
  const [sourceA, setSourceA] = useState<string>('');

  // Chart B states (Right Chart)
  const [tickerB, setTickerB] = useState<string>('MSFT');
  const [rangeB, setRangeB] = useState<string>('1d');
  const [dataB, setDataB] = useState<StockPoint[]>([]);
  const [loadingB, setLoadingB] = useState<boolean>(false);
  const [errorB, setErrorB] = useState<string>('');
  const [sourceB, setSourceB] = useState<string>('');

  // Chat window states
  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      sender: 'agent',
      text: 'Hello! I am your RAG-powered Market Intelligence assistant. How can I help you analyze market trends today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [chatSending, setChatSending] = useState<boolean>(false);

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
        handleLogout();
      }
    } catch (err) {
      console.error('Error verifying token:', err);
    } finally {
      setVerifyingToken(false);
    }
  };

  // Fetch stock data from backend
  const fetchStockData = async (ticker: string, range: string, isChartA: boolean) => {
    if (!token) return;
    const setLoading = isChartA ? setLoadingA : setLoadingB;
    const setError = isChartA ? setErrorA : setErrorB;
    const setData = isChartA ? setDataA : setDataB;
    const setSource = isChartA ? setSourceA : setSourceB;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:5000/api/market-data?ticker=${ticker}&range=${range}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch market data');
      }
      setData(data.data || []);
      setSource(data.source);
    } catch (err: any) {
      console.error(`Error fetching data for ${ticker}:`, err);
      setError(err.message || 'Error retrieving data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  // Fetch Chart A data
  useEffect(() => {
    if (user && token) {
      fetchStockData(tickerA, rangeA, true);
    }
  }, [user, tickerA, rangeA]);

  // Fetch Chart B data
  useEffect(() => {
    if (user && token) {
      fetchStockData(tickerB, rangeB, false);
    }
  }, [user, tickerB, rangeB]);

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
    setDataA([]);
    setDataB([]);
    setSidebarOpen(false);
  };

  // Chat message submit handler
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !token) return;

    const userMessage: ChatMessage = {
      sender: 'user',
      text: chatInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatSending(true);

    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMessage.text })
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send chat message');
      }

      const agentMessage: ChatMessage = {
        sender: 'agent',
        text: data.reply,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages(prev => [...prev, agentMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        sender: 'agent',
        text: `Error reaching the assistant: ${err.message || 'Server down'}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatSending(false);
    }
  };

  // Calculate statistics for charts
  const getStats = (marketData: StockPoint[]) => {
    if (marketData.length === 0) {
      return { current: '0.00', high: '0.00', low: '0.00', change: '0.00', changePercent: '0.00', isPositive: true };
    }
    const prices = marketData.map(d => d.price);
    const first = prices[0];
    const last = prices[prices.length - 1];
    const high = Math.max(...prices);
    const low = Math.min(...prices);
    const change = last - first;
    const changePercent = (change / first) * 100;

    return {
      current: last.toFixed(2),
      high: high.toFixed(2),
      low: low.toFixed(2),
      change: (change >= 0 ? '+' : '') + change.toFixed(2),
      changePercent: (change >= 0 ? '+' : '') + change.toFixed(2) + ' (' + (changePercent >= 0 ? '+' : '') + changePercent.toFixed(2) + '%)',
      isPositive: change >= 0
    };
  };

  const statsA = getStats(dataA);
  const statsB = getStats(dataB);

  return (
    <div className="app-container">
      {/* Top Header Bar */}
      <header className="dashboard-header-bar">
        <div className="header-left">
          {user && (
            <button className="btn-menu-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu size={20} />
            </button>
          )}
          <div className="logo-spark"></div>
          <h1>Market Intelligence</h1>
        </div>
        
        {user ? (
          <div className="header-right">
            <span className="user-online-badge">
              <span className="online-dot animate-pulse"></span>
              {user.username}
            </span>
            <button className="btn-header-logout" onClick={handleLogout}>Log Out</button>
          </div>
        ) : (
          <p className="subtitle">Real-time market analytics and RAG AI assistant.</p>
        )}
      </header>

      {/* Main Container */}
      <main className="dashboard-main-layout">
        {verifyingToken ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Authenticating your session...</p>
          </div>
        ) : user ? (
          /* LOGGED IN VIEW */
          <div className="dashboard-workspace animate-fade-in">
            
            {/* Slide-out Left Sidebar Drawer */}
            <aside className={`left-sidebar-drawer ${sidebarOpen ? 'open' : ''}`}>
              <div className="sidebar-header">
                <h3>Main Menu</h3>
                <button className="btn-close-sidebar" onClick={() => setSidebarOpen(false)}>
                  <X size={18} />
                </button>
              </div>
              <ul className="sidebar-links">
                <li>
                  <button className="sidebar-link active" onClick={() => { setSidebarOpen(false); setShowSettings(false); }}>
                    Dashboard
                  </button>
                </li>
                <li>
                  <button className="sidebar-link" onClick={() => { setSidebarOpen(false); setShowSettings(true); }}>
                    Settings
                  </button>
                </li>
                <li>
                  <button className="sidebar-link" onClick={() => { setSidebarOpen(false); alert("History list loaded successfully!"); }}>
                    Conversations
                  </button>
                </li>
              </ul>
              <div className="sidebar-footer">
                <span className="meta-text">SQLite Database: Online</span>
                <span className="meta-text">Alembic Migrations: v20729abfa32</span>
              </div>
            </aside>

            {/* Sidebar backdrop overlay */}
            {sidebarOpen && <div className="sidebar-overlay-backdrop" onClick={() => setSidebarOpen(false)}></div>}

            {/* Main Visual Display: Charts & Chat Columns */}
            <div className="workspace-grid-layout">
              
              {/* Left Column: Two side-by-side charts */}
              <div className="charts-column-area">
                
                {/* Settings Overlay Modal */}
                {showSettings ? (
                  <div className="settings-panel animate-fade-in">
                    <div className="settings-header">
                      <h2>System Settings</h2>
                      <button className="btn-close-settings" onClick={() => setShowSettings(false)}><X size={18} /></button>
                    </div>
                    <div className="settings-body">
                      <div className="setting-row">
                        <span className="setting-label">API Key Provider</span>
                        <span className="setting-value">Yahoo Finance CLI</span>
                      </div>
                      <div className="setting-row">
                        <span className="setting-label">JWT Token Lifetime</span>
                        <span className="setting-value">24 Hours (Active)</span>
                      </div>
                      <div className="setting-row">
                        <span className="setting-label">Database Filename</span>
                        <span className="setting-value">market_intelligence.db</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="dual-charts-row">
                    
                    {/* Chart A: Left Chart */}
                    <div className="chart-card-box">
                      <div className="chart-card-header-v2">
                        <select 
                          className="ticker-dropdown"
                          value={tickerA}
                          onChange={(e) => setTickerA(e.target.value)}
                        >
                          {SUPPORTED_TICKERS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>

                        <div className="range-pills">
                          {['1d', '5d', '1m', '1y'].map(r => (
                            <button
                              key={r}
                              className={`pill-btn ${rangeA === r ? 'active' : ''}`}
                              onClick={() => setRangeA(r)}
                            >
                              {r.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="chart-plot-area-v2">
                        {loadingA ? (
                          <div className="chart-loader">
                            <RefreshCw className="spinner-icon animate-spin" />
                          </div>
                        ) : errorA ? (
                          <div className="chart-error-msg">{errorA}</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={dataA} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorA" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={statsA.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor={statsA.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                              <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0b091a',
                                  borderColor: 'rgba(255,255,255,0.06)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke={statsA.isPositive ? '#10b981' : '#ef4444'} 
                                strokeWidth={1.5}
                                fill="url(#colorA)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      <div className="chart-card-footer-v2">
                        <div className="footer-stat">
                          <span className="f-price">${statsA.current}</span>
                          <span className={`f-change ${statsA.isPositive ? 'up' : 'down'}`}>
                            {statsA.changePercent}
                          </span>
                        </div>
                        <span className="f-source">{sourceA === 'yfinance' ? 'Live Feed' : 'Mock Fallback'}</span>
                      </div>
                    </div>

                    {/* Chart B: Right Chart */}
                    <div className="chart-card-box">
                      <div className="chart-card-header-v2">
                        <select 
                          className="ticker-dropdown"
                          value={tickerB}
                          onChange={(e) => setTickerB(e.target.value)}
                        >
                          {SUPPORTED_TICKERS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>

                        <div className="range-pills">
                          {['1d', '5d', '1m', '1y'].map(r => (
                            <button
                              key={r}
                              className={`pill-btn ${rangeB === r ? 'active' : ''}`}
                              onClick={() => setRangeB(r)}
                            >
                              {r.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="chart-plot-area-v2">
                        {loadingB ? (
                          <div className="chart-loader">
                            <RefreshCw className="spinner-icon animate-spin" />
                          </div>
                        ) : errorB ? (
                          <div className="chart-error-msg">{errorB}</div>
                        ) : (
                          <ResponsiveContainer width="100%" height={160}>
                            <AreaChart data={dataB} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                              <defs>
                                <linearGradient id="colorB" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={statsB.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.2}/>
                                  <stop offset="95%" stopColor={statsB.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.02)" vertical={false} />
                              <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                              <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: '#0b091a',
                                  borderColor: 'rgba(255,255,255,0.06)',
                                  borderRadius: '6px',
                                  color: '#fff',
                                  fontSize: '11px'
                                }}
                              />
                              <Area 
                                type="monotone" 
                                dataKey="price" 
                                stroke={statsB.isPositive ? '#10b981' : '#ef4444'} 
                                strokeWidth={1.5}
                                fill="url(#colorB)" 
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>

                      <div className="chart-card-footer-v2">
                        <div className="footer-stat">
                          <span className="f-price">${statsB.current}</span>
                          <span className={`f-change ${statsB.isPositive ? 'up' : 'down'}`}>
                            {statsB.changePercent}
                          </span>
                        </div>
                        <span className="f-source">{sourceB === 'yfinance' ? 'Live Feed' : 'Mock Fallback'}</span>
                      </div>
                    </div>

                  </div>
                )}

                {/* Progress Mini bar to replace timeline */}
                <div className="progress-mini-bar">
                  <span className="step-tag done">✓ Step 1: Init</span>
                  <span className="step-tag done">✓ Step 2: Auth</span>
                  <span className="step-tag done">✓ Step 3: Charts</span>
                  <span className="step-tag active">➔ Step 4: Redesign & Chat</span>
                  <span className="step-tag">Step 5: RAG</span>
                </div>
              </div>

              {/* Right Column: Chat Window Panel */}
              <div className="chat-window-panel">
                <div className="chat-panel-header">
                  <h4>RAG Agent Assistant</h4>
                  <span className="agent-status-indicator">
                    <span className="pulse-dot"></span>
                    Online
                  </span>
                </div>

                <div className="chat-messages-container">
                  {chatMessages.map((msg, index) => (
                    <div key={index} className={`chat-bubble-row ${msg.sender}`}>
                      <div className="chat-bubble">
                        <p>{msg.text}</p>
                        <span className="bubble-time">{msg.time}</span>
                      </div>
                    </div>
                  ))}
                  {chatSending && (
                    <div className="chat-bubble-row agent">
                      <div className="chat-bubble typing">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="chat-input-area">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask about Microsoft (MSFT) or Apple (AAPL)..."
                    disabled={chatSending}
                  />
                  <button type="submit" className="chat-send-btn" disabled={!chatInput.trim() || chatSending}>
                    <Send size={16} />
                  </button>
                </form>
              </div>

            </div>
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
    </div>
  );
}

export default App;
