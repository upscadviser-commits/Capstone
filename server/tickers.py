# List of top Indian NSE/BSE stocks, global US stocks, and indices
TICKERS_DB = [
    # Indices
    {"symbol": "^NSEI", "name": "NIFTY 50", "category": "Indices", "exchange": "NSE"},
    {"symbol": "^BSESN", "name": "SENSEX", "category": "Indices", "exchange": "BSE"},
    {"symbol": "^DJI", "name": "Dow Jones Industrial Average", "category": "Indices", "exchange": "DJI"},
    {"symbol": "^GSPC", "name": "S&P 500 Index", "category": "Indices", "exchange": "S&P"},
    {"symbol": "^IXIC", "name": "NASDAQ Composite", "category": "Indices", "exchange": "NASDAQ"},
    
    # Technology (India)
    {"symbol": "TCS.NS", "name": "Tata Consultancy Services Ltd.", "category": "Technology", "exchange": "NSE"},
    {"symbol": "INFY.NS", "name": "Infosys Ltd.", "category": "Technology", "exchange": "NSE"},
    {"symbol": "WIPRO.NS", "name": "Wipro Ltd.", "category": "Technology", "exchange": "NSE"},
    {"symbol": "HCLTECH.NS", "name": "HCL Technologies Ltd.", "category": "Technology", "exchange": "NSE"},
    {"symbol": "TECHM.NS", "name": "Tech Mahindra Ltd.", "category": "Technology", "exchange": "NSE"},
    {"symbol": "LTIM.NS", "name": "LTIMindtree Ltd.", "category": "Technology", "exchange": "NSE"},
    
    # Banking & Finance (India)
    {"symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd.", "category": "Banking", "exchange": "NSE"},
    {"symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd.", "category": "Banking", "exchange": "NSE"},
    {"symbol": "SBIN.NS", "name": "State Bank of India", "category": "Banking", "exchange": "NSE"},
    {"symbol": "KOTAKBANK.NS", "name": "Kotak Mahindra Bank Ltd.", "category": "Banking", "exchange": "NSE"},
    {"symbol": "AXISBANK.NS", "name": "Axis Bank Ltd.", "category": "Banking", "exchange": "NSE"},
    {"symbol": "INDUSINDBK.NS", "name": "IndusInd Bank Ltd.", "category": "Banking", "exchange": "NSE"},
    {"symbol": "BAJFINANCE.NS", "name": "Bajaj Finance Ltd.", "category": "Banking", "exchange": "NSE"},
    
    # Energy & Utilities (India)
    {"symbol": "RELIANCE.NS", "name": "Reliance Industries Ltd.", "category": "Energy", "exchange": "NSE"},
    {"symbol": "TATAPOWER.NS", "name": "Tata Power Company Ltd.", "category": "Energy", "exchange": "NSE"},
    {"symbol": "ADANIGREEN.NS", "name": "Adani Green Energy Ltd.", "category": "Energy", "exchange": "NSE"},
    {"symbol": "NTPC.NS", "name": "NTPC Ltd.", "category": "Energy", "exchange": "NSE"},
    {"symbol": "ONGC.NS", "name": "Oil & Natural Gas Corporation", "category": "Energy", "exchange": "NSE"},
    {"symbol": "POWERGRID.NS", "name": "Power Grid Corporation", "category": "Energy", "exchange": "NSE"},
    {"symbol": "COALINDIA.NS", "name": "Coal India Ltd.", "category": "Energy", "exchange": "NSE"},
    
    # Auto & Industrials (India)
    {"symbol": "TATASTEEL.NS", "name": "Tata Steel Ltd.", "category": "Industrials", "exchange": "NSE"},
    {"symbol": "TATAMOTORS.NS", "name": "Tata Motors Ltd.", "category": "Automotive", "exchange": "NSE"},
    {"symbol": "MARUTI.NS", "name": "Maruti Suzuki India Ltd.", "category": "Automotive", "exchange": "NSE"},
    {"symbol": "M&M.NS", "name": "Mahindra & Mahindra Ltd.", "category": "Automotive", "exchange": "NSE"},
    {"symbol": "LT.NS", "name": "Larsen & Toubro Ltd.", "category": "Industrials", "exchange": "NSE"},
    
    # Consumer Goods & Pharma (India)
    {"symbol": "ITC.NS", "name": "ITC Ltd.", "category": "Consumer", "exchange": "NSE"},
    {"symbol": "HINDUNILVR.NS", "name": "Hindustan Unilever Ltd.", "category": "Consumer", "exchange": "NSE"},
    {"symbol": "NESTLEIND.NS", "name": "Nestle India Ltd.", "category": "Consumer", "exchange": "NSE"},
    {"symbol": "SUNPHARMA.NS", "name": "Sun Pharmaceutical Industries", "category": "Healthcare", "exchange": "NSE"},
    {"symbol": "TITAN.NS", "name": "Titan Company Ltd.", "category": "Consumer", "exchange": "NSE"},
    
    # US Stocks
    {"symbol": "AAPL", "name": "Apple Inc.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "MSFT", "name": "Microsoft Corp.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "GOOGL", "name": "Alphabet Inc.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "TSLA", "name": "Tesla Inc.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "AMZN", "name": "Amazon.com Inc.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "META", "name": "Meta Platforms Inc.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "NVDA", "name": "NVIDIA Corp.", "category": "US Stocks", "exchange": "NASDAQ"},
    {"symbol": "NFLX", "name": "Netflix Inc.", "category": "US Stocks", "exchange": "NASDAQ"}
]

def search_tickers_db(query):
    """
    Search database of tickers case-insensitively by name or symbol.
    """
    if not query:
        return TICKERS_DB[:15] # Return default popular selection
        
    query = query.strip().upper()
    matches = []
    
    for item in TICKERS_DB:
        # Match symbol exactly or name partially
        if query in item["symbol"].upper() or query in item["name"].upper():
            matches.append(item)
            
    return matches[:15] # Limit results to top 15
