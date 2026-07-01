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
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
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

  // Chart states
  const [selectedTicker, setSelectedTicker] = useState<string>('AAPL');
  const [selectedRange, setSelectedRange] = useState<string>('1d');
  const [marketData, setMarketData] = useState<StockPoint[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);
  const [chartError, setChartError] = useState<string>('');
  const [dataSource, setDataSource] = useState<string>('');

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
  const fetchMarketData = async () => {
    if (!token) return;
    setChartLoading(true);
    setChartError('');
    try {
      const response = await fetch(`http://localhost:5000/api/market-data?ticker=${selectedTicker}&range=${selectedRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch market data');
      }
      setMarketData(data.data || []);
      setDataSource(data.source);
    } catch (err: any) {
      console.error('Error fetching market data:', err);
      setChartError(err.message || 'Error retrieving data');
    } finally {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      verifyToken(token);
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      fetchMarketData();
    }
  }, [user, selectedTicker, selectedRange]);

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
    setMarketData([]);
  };

  // Calculate live statistics
  const getStats = () => {
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

  const stats = getStats();

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
        {verifyingToken ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Authenticating your session...</p>
          </div>
        ) : user ? (
          /* LOGGED IN VIEW */
          <div className="dashboard-logged-in animate-fade-in">
            
            {/* Top Bar: Progress Tracker & User Info */}
            <div className="dashboard-top-bar">
              <div className="user-indicator">
                <span className="user-dot"></span>
                <span className="username-text">{user.username} ({user.email})</span>
                <button className="btn-logout" onClick={handleLogout}>Log Out</button>
              </div>

              {/* Collapsed Step Progress Tracker */}
              <div className="progress-tracker">
                <div className="step done" title="Step 1: Init">Init</div>
                <div className="step done" title="Step 2: Auth">Auth</div>
                <div className="step active" title="Step 3: Charts">Charts</div>
                <div className="step" title="Step 4: Chatbot">Brain</div>
                <div className="step" title="Step 5: RAG">RAG</div>
                <div className="step" title="Step 6: History">History</div>
              </div>
            </div>

            {/* Main Interactive Chart Section */}
            <section className="chart-container-card">
              <div className="chart-card-header">
                {/* Ticker Selector */}
                <div className="selector-group tickers">
                  {['AAPL', 'MSFT', 'GOOGL', 'TSLA'].map(ticker => (
                    <button
                      key={ticker}
                      className={`select-btn ${selectedTicker === ticker ? 'active' : ''}`}
                      onClick={() => setSelectedTicker(ticker)}
                    >
                      {ticker}
                    </button>
                  ))}
                </div>

                {/* Range Selector */}
                <div className="selector-group ranges">
                  {['1d', '5d', '1m', '1y'].map(range => (
                    <button
                      key={range}
                      className={`select-btn ${selectedRange === range ? 'active' : ''}`}
                      onClick={() => setSelectedRange(range)}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Plot Area */}
              <div className="chart-plot-area">
                {chartLoading ? (
                  <div className="chart-loader">
                    <RefreshCw className="spinner-icon animate-spin" />
                    <p>Loading live feed...</p>
                  </div>
                ) : chartError ? (
                  <div className="chart-error-msg">
                    <p>{chartError}</p>
                    <button className="btn-secondary" onClick={fetchMarketData}>Retry Connection</button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={marketData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={stats.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.25}/>
                          <stop offset="95%" stopColor={stats.isPositive ? '#10b981' : '#ef4444'} stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis 
                        dataKey="time" 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        dy={6}
                      />
                      <YAxis 
                        stroke="#64748b" 
                        fontSize={10} 
                        tickLine={false}
                        axisLine={false}
                        domain={['auto', 'auto']}
                        dx={-6}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f0c29',
                          borderColor: 'rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          color: '#fff',
                          fontSize: '12px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}
                        itemStyle={{ color: '#fff' }}
                        labelStyle={{ color: '#94a3b8', fontWeight: 600 }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="price" 
                        stroke={stats.isPositive ? '#10b981' : '#ef4444'} 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorPrice)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Chart Stats Footer */}
              <div className="chart-stats-footer">
                <div className="stat-box main-price">
                  <span className="stat-label">{selectedTicker} Price</span>
                  <div className="stat-value-container">
                    <span className="price-val">${stats.current}</span>
                    <span className={`change-val ${stats.isPositive ? 'up' : 'down'}`}>
                      {stats.isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      {stats.changePercent}
                    </span>
                  </div>
                </div>

                <div className="stat-box">
                  <span className="stat-label">Range High</span>
                  <span className="stat-value">${stats.high}</span>
                </div>

                <div className="stat-box">
                  <span className="stat-label">Range Low</span>
                  <span className="stat-value">${stats.low}</span>
                </div>

                <div className="stat-box source-indicator">
                  <span className="stat-label">Feed Source</span>
                  <span className="source-tag">{dataSource === 'yfinance' ? 'Yahoo Live' : 'Mock Fallback'}</span>
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
        <p>Market Intelligence App &copy; {new Date().getFullYear()} &bull; Git Flow: feature/charts</p>
      </footer>
    </div>
  );
}

export default App;
