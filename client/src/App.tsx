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

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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
  sources?: { filename: string; page: number }[];
}

interface TickerItem {
  symbol: string;
  name: string;
  category: string;
  exchange: string;
}

const ALL_TICKERS: TickerItem[] = [
  // Indices
  { symbol: "^NSEI", name: "NIFTY 50 Index", category: "Indices", exchange: "NSE" },
  { symbol: "^BSESN", name: "SENSEX Index", category: "Indices", exchange: "BSE" },
  { symbol: "^DJI", name: "Dow Jones Industrial Average", category: "Indices", exchange: "DJI" },
  { symbol: "^GSPC", name: "S&P 500 Index", category: "Indices", exchange: "S&P" },
  { symbol: "^IXIC", name: "NASDAQ Composite", category: "Indices", exchange: "NASDAQ" },
  
  // Technology (India)
  { symbol: "TCS.NS", name: "Tata Consultancy Services Ltd.", category: "Technology", exchange: "NSE" },
  { symbol: "INFY.NS", name: "Infosys Ltd.", category: "Technology", exchange: "NSE" },
  { symbol: "WIPRO.NS", name: "Wipro Ltd.", category: "Technology", exchange: "NSE" },
  { symbol: "HCLTECH.NS", name: "HCL Technologies Ltd.", category: "Technology", exchange: "NSE" },
  { symbol: "TECHM.NS", name: "Tech Mahindra Ltd.", category: "Technology", exchange: "NSE" },
  
  // Banking & Finance (India)
  { symbol: "HDFCBANK.NS", name: "HDFC Bank Ltd.", category: "Banking", exchange: "NSE" },
  { symbol: "ICICIBANK.NS", name: "ICICI Bank Ltd.", category: "Banking", exchange: "NSE" },
  { symbol: "SBIN.NS", name: "State Bank of India", category: "Banking", exchange: "NSE" },
  { symbol: "KOTAKBANK.NS", name: "Kotak Mahindra Bank Ltd.", category: "Banking", exchange: "NSE" },
  { symbol: "AXISBANK.NS", name: "Axis Bank Ltd.", category: "Banking", exchange: "NSE" },
  
  // Energy & Utilities (India)
  { symbol: "RELIANCE.NS", name: "Reliance Industries Ltd.", category: "Energy", exchange: "NSE" },
  { symbol: "TATAPOWER.NS", name: "Tata Power Company Ltd.", category: "Energy", exchange: "NSE" },
  { symbol: "ADANIGREEN.NS", name: "Adani Green Energy Ltd.", category: "Energy", exchange: "NSE" },
  { symbol: "NTPC.NS", name: "NTPC Ltd.", category: "Energy", exchange: "NSE" },
  
  // Automotive & Industrials (India)
  { symbol: "TATASTEEL.NS", name: "Tata Steel Ltd.", category: "Industrials", exchange: "NSE" },
  { symbol: "TATAMOTORS.NS", name: "Tata Motors Ltd.", category: "Automotive", exchange: "NSE" },
  { symbol: "LT.NS", name: "Larsen & Toubro Ltd.", category: "Industrials", exchange: "NSE" },
  
  // US Stocks
  { symbol: "AAPL", name: "Apple Inc.", category: "US Stocks", exchange: "NASDAQ" },
  { symbol: "MSFT", name: "Microsoft Corp.", category: "US Stocks", exchange: "NASDAQ" },
  { symbol: "GOOGL", name: "Alphabet Inc.", category: "US Stocks", exchange: "NASDAQ" },
  { symbol: "TSLA", name: "Tesla Inc.", category: "US Stocks", exchange: "NASDAQ" }
];

interface TickerDropdownSelectProps {
  selectedSymbol: string;
  onChange: (symbol: string) => void;
  defaultCategoryFilter?: string;
  authToken: string | null;
}

function TickerDropdownSelect({ selectedSymbol, onChange, defaultCategoryFilter, authToken }: TickerDropdownSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(defaultCategoryFilter || 'Indices');
  const [tickersList, setTickersList] = useState<TickerItem[]>(ALL_TICKERS);
  const [loadingResults, setLoadingResults] = useState(false);

  const selectedItem = ALL_TICKERS.find(t => t.symbol === selectedSymbol) || { symbol: selectedSymbol, name: selectedSymbol };

  // Filtered search results when typing
  const isSearching = searchVal.trim().length > 0;

  // Debounced API fetch for tickers search
  useEffect(() => {
    if (!isOpen) return;

    if (searchVal.trim() === '') {
      setTickersList(ALL_TICKERS);
      return;
    }

    const delayDebounce = setTimeout(async () => {
      setLoadingResults(true);
      try {
        const response = await fetch(`${API_BASE}/api/tickers/search?q=${encodeURIComponent(searchVal)}`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setTickersList(data.results || []);
        } else {
          throw new Error('API error response');
        }
      } catch (err) {
        console.error('Error fetching live search results:', err);
        // Fallback to local filter of popular defaults
        const filtered = ALL_TICKERS.filter(t => 
          t.symbol.toLowerCase().includes(searchVal.toLowerCase()) || 
          t.name.toLowerCase().includes(searchVal.toLowerCase())
        );
        setTickersList(filtered);
      } finally {
        setLoadingResults(false);
      }
    }, 200); // 200ms debounce

    return () => clearTimeout(delayDebounce);
  }, [searchVal, isOpen, authToken]);

  const categories = Array.from(new Set(ALL_TICKERS.map(t => t.category)));

  const handleSelectItem = (symbol: string) => {
    onChange(symbol);
    setSearchVal('');
    setIsOpen(false);
  };

  return (
    <div className="custom-ticker-select-container">
      {/* Searchable input as default */}
      <input
        type="text"
        className="custom-ticker-input"
        placeholder="Search company or ticker (e.g. TCS.NS)..."
        value={isOpen ? searchVal : `${selectedItem.name} (${selectedItem.symbol})`}
        onFocus={() => {
          setIsOpen(true);
          setSearchVal('');
        }}
        onChange={(e) => setSearchVal(e.target.value)}
        onBlur={() => {
          // Wait slightly before closing so click event on list triggers
          setTimeout(() => setIsOpen(false), 250);
        }}
      />

      {isOpen && (
        <div className="custom-dropdown-panel" onMouseDown={(e) => e.preventDefault()}>
          {isSearching ? (
            /* Search results list */
            <div className="search-results-list">
              {loadingResults ? (
                <div className="dropdown-no-results">Searching...</div>
              ) : tickersList.length > 0 ? (
                tickersList.map(t => (
                  <button
                    key={t.symbol}
                    className="dropdown-item"
                    type="button"
                    onClick={() => handleSelectItem(t.symbol)}
                  >
                    <span className="item-symbol">{t.symbol}</span>
                    <span className="item-name">{t.name}</span>
                  </button>
                ))
              ) : (
                <div className="dropdown-no-results">No companies found</div>
              )}
            </div>
          ) : (
            /* Category browse view */
            <div className="category-browse-view">
              <div className="category-tabs-bar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`category-tab-btn ${activeCategory === cat ? 'active' : ''}`}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="category-items-list">
                {ALL_TICKERS.filter(t => t.category === activeCategory).map(t => (
                  <button
                    key={t.symbol}
                    className="dropdown-item"
                    type="button"
                    onClick={() => handleSelectItem(t.symbol)}
                  >
                    <span className="item-symbol">{t.symbol}</span>
                    <span className="item-name">{t.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);

  // Chart A states (Top Chart)
  const [tickerA, setTickerA] = useState<string>('^NSEI');
  const [rangeA, setRangeA] = useState<string>('1d');
  const [dataA, setDataA] = useState<StockPoint[]>([]);
  const [loadingA, setLoadingA] = useState<boolean>(false);
  const [errorA, setErrorA] = useState<string>('');
  const [sourceA, setSourceA] = useState<string>('');

  // Chart B states (Bottom Chart)
  const [tickerB, setTickerB] = useState<string>('RELIANCE.NS');
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

  // File Upload states for RAG
  const [uploadingFile, setUploadingFile] = useState<boolean>(false);
  const [uploadStatus, setUploadStatus] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Custom States
  const [documents, setDocuments] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);

  // Fetch Documents
  const fetchDocuments = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  // Delete Document
  const handleDeleteDocument = async (docId: number) => {
    if (!token) return;
    if (!window.confirm("Are you sure you want to delete this document? This will remove all its text index embeddings from the AI vector store.")) return;
    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setDocuments(prev => prev.filter(d => d.id !== docId));
        // Add a notification in chat
        const notificationMsg: ChatMessage = {
          sender: 'agent',
          text: `Successfully deleted document.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, notificationMsg]);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
    }
  };

  // Update Document Ticker (CRUD Update)
  const handleUpdateDocumentTicker = async (docId: number, currentTicker: string) => {
    const newTicker = prompt("Enter new stock ticker symbol for this document (e.g. SBIN.NS):", currentTicker);
    if (newTicker === null) return;
    const cleanTicker = newTicker.trim().toUpperCase();
    if (!cleanTicker) {
      alert("Ticker symbol cannot be empty");
      return;
    }
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticker: cleanTicker })
      });
      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => prev.map(d => d.id === docId ? data.document : d));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update document ticker');
      }
    } catch (err) {
      console.error('Error updating document ticker:', err);
    }
  };

  // Fetch Watchlist
  const fetchWatchlist = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/watchlist`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setWatchlist(data);
      }
    } catch (err) {
      console.error('Error fetching watchlist:', err);
    }
  };

  // Add to Watchlist
  const handleAddToWatchlist = async (tickerSymbol: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/watchlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticker: tickerSymbol })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.ticker) {
          setWatchlist(prev => {
            if (prev.some(item => item.ticker === data.ticker)) return prev;
            return [...prev, data];
          });
        }
      }
    } catch (err) {
      console.error('Error adding to watchlist:', err);
    }
  };

  // Remove from Watchlist
  const handleRemoveFromWatchlist = async (tickerSymbol: string) => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/watchlist/${tickerSymbol}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setWatchlist(prev => prev.filter(item => item.ticker !== tickerSymbol));
      }
    } catch (err) {
      console.error('Error removing from watchlist:', err);
    }
  };

  // Fetch Chat History
  const fetchChatHistory = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/chat/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const messages = data.map((msg: any) => ({
            sender: msg.sender,
            text: msg.text,
            sources: msg.sources || [],
            time: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }));
          setChatMessages(messages);
        } else {
          setChatMessages([
            {
              sender: 'agent',
              text: 'Hello! I am your RAG-powered Market Intelligence assistant. How can I help you analyze market trends today?',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      }
    } catch (err) {
      console.error('Error fetching chat history:', err);
    }
  };

  // Clear Chat History
  const handleClearChatHistory = async () => {
    if (!token) return;
    if (!window.confirm("Are you sure you want to clear your conversation history?")) return;
    try {
      const response = await fetch(`${API_BASE}/api/chat/history`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setChatMessages([
          {
            sender: 'agent',
            text: 'Hello! I am your RAG-powered Market Intelligence assistant. How can I help you analyze market trends today?',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      console.error('Error clearing chat history:', err);
    }
  };

  // Trigger loading resources
  useEffect(() => {
    if (user && token) {
      fetchDocuments();
      fetchWatchlist();
      fetchChatHistory();
    } else {
      setDocuments([]);
      setWatchlist([]);
    }
  }, [user, token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !token) return;

    const file = files[0];
    if (file.type !== 'application/pdf') {
      setUploadStatus({ text: 'Only PDF documents are allowed', type: 'error' });
      return;
    }

    setUploadingFile(true);
    setUploadStatus(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/api/upload-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (response.ok) {
        setUploadStatus({ text: `Indexed: ${file.name}`, type: 'success' });
        fetchDocuments(); // Reload document list
        // Add a notification in chat
        const notificationMsg: ChatMessage = {
          sender: 'agent',
          text: `Successfully uploaded and indexed "${file.name}"! You can now ask questions about this report in the chat.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setChatMessages(prev => [...prev, notificationMsg]);
      } else {
        throw new Error(data.error || 'Failed to upload and index document');
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadStatus({ text: err.message || 'File upload failed', type: 'error' });
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };


  // Verify token on load
  const verifyToken = async (authToken: string) => {
    setVerifyingToken(true);
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
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
      const response = await fetch(`${API_BASE}/api/market-data?ticker=${ticker}&range=${range}`, {
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
      const response = await fetch(`${API_BASE}/api/register`, {
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
      const response = await fetch(`${API_BASE}/api/login`, {
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
      const response = await fetch(`${API_BASE}/api/chat`, {
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
        sources: data.sources || [],
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
                  <button className="sidebar-link" onClick={() => { setSidebarOpen(false); handleClearChatHistory(); }}>
                    Clear Chat
                  </button>
                </li>
              </ul>

              {/* Watchlist Section */}
              <div className="sidebar-watchlist-section">
                <h4>My Watchlist ({watchlist.length})</h4>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const input = form.elements.namedItem('watchlist-symbol') as HTMLInputElement;
                  if (input && input.value.trim()) {
                    handleAddToWatchlist(input.value.trim().toUpperCase());
                    input.value = '';
                  }
                }} className="watchlist-form">
                  <input 
                    type="text" 
                    name="watchlist-symbol" 
                    placeholder="Add symbol (e.g. INFY.NS)" 
                    className="watchlist-input" 
                  />
                  <button type="submit" className="btn-watchlist-add">+</button>
                </form>
                {watchlist.length > 0 ? (
                  <div className="sidebar-watchlist-list">
                    {watchlist.map(item => (
                      <div key={item.id} className="watchlist-item">
                        <span className="watchlist-symbol-clickable" onClick={() => {
                          setTickerA(item.symbol);
                          setSidebarOpen(false);
                        }}>
                          {item.ticker}
                        </span>
                        <button 
                          className="btn-remove-watchlist"
                          onClick={() => handleRemoveFromWatchlist(item.ticker)}
                          title="Remove from Watchlist"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-watchlist-text">Watchlist is empty</p>
                )}
              </div>

              {/* Upload PDF Section */}
              <div className="sidebar-upload-section">
                <h4>Upload Document (PDF)</h4>
                <div className="upload-dropzone">
                  <input 
                    type="file" 
                    accept=".pdf" 
                    onChange={handleFileUpload} 
                    id="sidebar-file-upload" 
                    disabled={uploadingFile}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="sidebar-file-upload" className="upload-label">
                    {uploadingFile ? (
                      <div className="upload-spinner-container">
                        <RefreshCw className="spinner-icon animate-spin spinner-xs" size={14} style={{ marginRight: '6px', display: 'inline-block' }} />
                        <span>Indexing...</span>
                      </div>
                    ) : (
                      <span>Select PDF Report</span>
                    )}
                  </label>
                </div>
                {uploadStatus && (
                  <div className={`upload-status-msg ${uploadStatus.type}`}>
                    {uploadStatus.text}
                  </div>
                )}
              </div>

              {/* Uploaded Documents List Section */}
              <div className="sidebar-documents-section">
                <h4>Uploaded Reports ({documents.length})</h4>
                {documents.length > 0 ? (
                  <div className="sidebar-doc-list">
                    {documents.map(doc => (
                      <div key={doc.id} className="sidebar-doc-item">
                        <div className="doc-info">
                          <span className="doc-name" title={doc.filename}>{doc.filename}</span>
                          <span className="doc-ticker" onClick={() => handleUpdateDocumentTicker(doc.id, doc.ticker)}>
                            Ticker: <strong>{doc.ticker}</strong> ✏️
                          </span>
                        </div>
                        <button 
                          className="btn-delete-doc" 
                          onClick={() => handleDeleteDocument(doc.id)}
                          title="Delete PDF & Vectors"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="no-docs-text">No reports uploaded yet</p>
                )}
              </div>

              <div className="sidebar-footer">
                <span className="meta-text">SQLite Database: Online</span>
                <span className="meta-text">ChromaDB Store: Active</span>
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
                        <div className="chart-selector-row">
                          <TickerDropdownSelect 
                            selectedSymbol={tickerA} 
                            onChange={(symbol) => setTickerA(symbol)} 
                            defaultCategoryFilter="Indices"
                            authToken={token}
                          />
                          <button 
                            className="btn-watchlist-star" 
                            onClick={() => handleAddToWatchlist(tickerA)}
                            title="Add to Watchlist"
                          >
                            ★
                          </button>
                        </div>

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
                          <ResponsiveContainer width="100%" height={120}>
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
                          <span className="f-price">₹{statsA.current}</span>
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
                        <div className="chart-selector-row">
                          <TickerDropdownSelect 
                            selectedSymbol={tickerB} 
                            onChange={(symbol) => setTickerB(symbol)} 
                            defaultCategoryFilter="Technology"
                            authToken={token}
                          />
                          <button 
                            className="btn-watchlist-star" 
                            onClick={() => handleAddToWatchlist(tickerB)}
                            title="Add to Watchlist"
                          >
                            ★
                          </button>
                        </div>

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
                          <ResponsiveContainer width="100%" height={120}>
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
                          <span className="f-price">₹{statsB.current}</span>
                          <span className={`f-change ${statsB.isPositive ? 'up' : 'down'}`}>
                            {statsB.changePercent}
                          </span>
                        </div>
                        <span className="f-source">{sourceB === 'yfinance' ? 'Live Feed' : 'Mock Fallback'}</span>
                      </div>
                    </div>

                  </div>
                )}
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
                        <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                        
                        {/* Source citations rendering */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="chat-citations-container">
                            <span className="citation-header-text">Sources Cited:</span>
                            <div className="citations-list">
                              {msg.sources.map((src, sIdx) => (
                                <span key={sIdx} className="citation-pill-badge" title={src.filename}>
                                  📄 {src.filename.length > 18 ? `${src.filename.substring(0, 15)}...` : src.filename} (p. {src.page})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
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
