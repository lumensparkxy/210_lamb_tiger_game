import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import StatsDisplay from './components/StatsDisplay';
import { GameState, Move } from './game/types.ts';
import { Board } from './components/Board';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isMatchmaking, setIsMatchmaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const matchmakingWsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setPlayerId(user.uid);
      } else {
        setPlayerId("");
        setGameState(null);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!playerId) return;

    // Check URL for Game ID once we have a player ID
    const params = new URLSearchParams(window.location.search);
    const gameIdFromUrl = params.get("gameId");

    if (gameIdFromUrl) {
      joinGame(gameIdFromUrl, playerId);
    } else {
      setIsCreating(true);
    }
  }, [playerId]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      window.location.href = "/"; // Reset URL
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  const joinGame = async (matchId: string, pId: string) => {
    try {
      const res = await axios.get(`/api/games/${matchId}?playerId=${pId}`);
      setGameState(res.data);
      connectWebSocket(matchId);
      setIsCreating(false);
    } catch (e) {
      console.error("Game not found", e);
      setIsCreating(true);
      // Clear URL if invalid
      window.history.pushState({}, '', window.location.pathname);
    }
  };

  const createNewGame = async (preferredRole: "TIGER" | "GOAT", vsAI: boolean = false) => {
    try {
      const res = await axios.post('/api/games', { 
        variant: "3T-15G-23N",
        playerId: playerId,
        preferredRole: preferredRole,
        vsAI: vsAI
      });
      setGameState(res.data);
      window.history.pushState({}, '', `?gameId=${res.data.matchId}`);
      connectWebSocket(res.data.matchId);
      setIsCreating(false);
    } catch (e) {
      console.error("Error creating game", e);
    }
  };

  const findMatch = () => {
    setIsMatchmaking(true);
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.DEV ? `${window.location.hostname}:8000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/matchmaking/${playerId}`;
    
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log("Connected to Matchmaking Queue");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === "MATCH_FOUND") {
        console.log("Match found!", data);
        setIsMatchmaking(false);
        // Join the game
        joinGame(data.matchId, playerId);
        // Update URL
        window.history.pushState({}, '', `?gameId=${data.matchId}`);
      }
    };
    
    ws.onclose = () => {
      console.log("Matchmaking connection closed");
    };

    matchmakingWsRef.current = ws;
  };

  const cancelMatchmaking = () => {
    if (matchmakingWsRef.current) {
      matchmakingWsRef.current.close();
    }
    setIsMatchmaking(false);
  };

  const connectWebSocket = (matchId: string) => {
    if (wsRef.current) wsRef.current.close();
    
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In development, we connect to port 8000 directly. In production, we use the same host (relative).
    const host = import.meta.env.DEV ? `${window.location.hostname}:8000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${matchId}${playerId ? `?playerId=${playerId}` : ''}`;
    
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to WebSocket for game:", matchId);
    };

    ws.onmessage = (event) => {
      console.log("Received update via WebSocket");
      const newState = JSON.parse(event.data);
      setGameState(newState);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    wsRef.current = ws;
  };

  const getMyRole = (): "TIGER" | "GOAT" | "SPECTATOR" => {
    if (!gameState) return "SPECTATOR";
    if (gameState.tigerPlayerId === playerId) return "TIGER";
    if (gameState.goatPlayerId === playerId) return "GOAT";
    return "SPECTATOR";
  };

  const handleNodeClick = async (nodeId: number) => {
    if (!gameState) return;
    
    const myRole = getMyRole();
    if (myRole === "SPECTATOR") {
      setError("You are spectating.");
      return;
    }
    if (gameState.activePlayer !== myRole) {
      setError(`It is ${gameState.activePlayer}'s turn.`);
      return;
    }

    setError(null);

    const piece = gameState.board[nodeId];

    if (gameState.phase === "PLACEMENT") {
      if (gameState.activePlayer === "GOAT") {
        if (piece === "E") {
          await sendMove({ player: "GOAT", from_node: null, to_node: nodeId, playerId });
        }
      } else {
        // Tiger moves during placement
        handleMovementClick(nodeId, piece);
      }
    } else if (gameState.phase === "MOVEMENT") {
      handleMovementClick(nodeId, piece);
    }
  };

  const handleMovementClick = async (nodeId: number, piece: string) => {
    if (!gameState) return;

    if (selectedNode === null) {
      // Select source
      if (piece === "E") return;
      if (piece === "T" && gameState.activePlayer === "TIGER") setSelectedNode(nodeId);
      if (piece === "G" && gameState.activePlayer === "GOAT") setSelectedNode(nodeId);
    } else {
      // Move to target
      if (nodeId === selectedNode) {
        setSelectedNode(null); // Deselect
        return;
      }
      
      if (piece !== "E") {
        // Change selection?
        if (piece === "T" && gameState.activePlayer === "TIGER") setSelectedNode(nodeId);
        else if (piece === "G" && gameState.activePlayer === "GOAT") setSelectedNode(nodeId);
        return;
      }

      // Attempt move
      await sendMove({
        player: gameState.activePlayer,
        from_node: selectedNode,
        to_node: nodeId,
        playerId
      });
      setSelectedNode(null);
    }
  };

  const sendMove = async (move: Move) => {
    if (!gameState) return;
    try {
      const response = await axios.post(`/api/games/${gameState.matchId}/move`, move);
      setGameState(response.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Invalid move");
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Aadu Puli Aattam',
          text: `Join my game! I am playing as ${getMyRole() === 'TIGER' ? 'Tiger' : 'Goat'}.`,
          url: url
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!"); 
      } catch (err) {
        console.error('Failed to copy: ', err);
      }
    }
  };

  const returnToHome = () => {
    setGameState(null);
    setSelectedNode(null);
    setError(null);
    setIsCreating(true);
    window.history.pushState({}, '', window.location.pathname);
  };

  if (loadingAuth) {
    return <div style={{ color: '#888', marginTop: '20vh', textAlign: 'center' }}>Loading...</div>;
  }

  // If not logged in, we show the Login popup over the Home screen
  const showLogin = !playerId;

  if (isCreating || showLogin) {
    return (
      <div className="App game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        {showLogin && <Login />}
        
        <div style={{ position: 'absolute', top: '1rem', right: '1rem' }}>
          {playerId && (
            <button 
              onClick={handleSignOut}
              style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', color: '#ccc', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          )}
        </div>
        <h1>Aadu Puli Aattam</h1>
        <p>Create a new game to start playing.</p>
        
        {playerId && (
            <div style={{ width: '100%', maxWidth: '500px', marginBottom: '2rem' }}>
                <StatsDisplay playerId={playerId} />
            </div>
        )}
        
        <div style={{ marginBottom: '2rem', textAlign: 'center', opacity: showLogin ? 0.5 : 1, pointerEvents: showLogin ? 'none' : 'auto' }}>
            <h3>Play vs Human</h3>
            <div style={{ marginBottom: '1rem' }}>
              <button 
                onClick={findMatch}
                style={{ 
                  padding: '1rem 2rem', 
                  fontSize: '1.2rem', 
                  background: 'linear-gradient(45deg, #6c5ce7, #a29bfe)', 
                  border: 'none', 
                  borderRadius: '8px', 
                  cursor: 'pointer', 
                  color: 'white', 
                  width: '100%', 
                  maxWidth: '300px',
                  boxShadow: '0 4px 15px rgba(108, 92, 231, 0.3)',
                  fontWeight: 'bold'
                }}
              >
                🔍 Find Match (Random)
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => createNewGame("TIGER", false)}
                style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#ff9f43', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
              >
                Play as Tiger 🐯
              </button>
              <button 
                onClick={() => createNewGame("GOAT", false)}
                style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#1dd1a1', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
              >
                Play as Goat 🐐
              </button>
            </div>
        </div>

        {isMatchmaking && (
          <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
              backdropFilter: 'blur(5px)'
          }}>
              <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', textAlign: 'center', maxWidth: '90%', width: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                  <h2 style={{ marginTop: 0, color: '#2d3436' }}>Searching for Opponent...</h2>
                  <p style={{ color: '#636e72' }}>Please wait while we find a match for you.</p>
                  <div className="spinner" style={{ margin: '2rem auto' }}></div>
                  <button 
                      onClick={cancelMatchmaking}
                      style={{ 
                        padding: '0.8rem 2rem', 
                        background: '#ff7675', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '8px', 
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600',
                        transition: 'background 0.2s'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = '#d63031'}
                      onMouseOut={(e) => e.currentTarget.style.background = '#ff7675'}
                  >
                      Cancel Search
                  </button>
              </div>
          </div>
        )}

        <div style={{ textAlign: 'center' }}>
            <h3>Play vs AI</h3>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button 
                onClick={() => createNewGame("TIGER", true)}
                style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#d35400', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
              >
                Tiger vs AI 🤖
              </button>
              <button 
                onClick={() => createNewGame("GOAT", true)}
                style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#16a085', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
              >
                Goat vs AI 🤖
              </button>
            </div>
        </div>
      </div>
    );
  }

  if (!gameState) return <div style={{ color: '#888', marginTop: '20vh' }}>Loading Game Engine...</div>;

  const myRole = getMyRole();

  return (
    <div className="App game-container">
      <header>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1>Aadu Puli Aattam</h1>
          <button 
            onClick={handleSignOut}
            style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid #ccc', borderRadius: '4px', color: '#ccc', cursor: 'pointer', fontSize: '0.8rem' }}
          >
            Sign Out
          </button>
        </div>
        <div className={`turn-indicator turn-${gameState.activePlayer}`}>
          Current Turn: <strong>{gameState.activePlayer}</strong>
          <span className="phase-badge">{gameState.phase}</span>
        </div>
        <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#aaa' }}>
          You are: <strong style={{ color: myRole === 'TIGER' ? '#ff9f43' : myRole === 'GOAT' ? '#1dd1a1' : '#ccc' }}>{myRole}</strong>
          {myRole === 'SPECTATOR' && " (View Only)"}
        </div>
        <button 
          onClick={handleShare}
          style={{ 
            marginTop: '1rem', 
            marginLeft: 'auto',
            marginRight: 'auto',
            cursor: 'pointer',
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.5rem',
            padding: '0.6rem 1.2rem',
            background: 'rgba(100, 108, 255, 0.1)',
            borderRadius: '20px',
            border: '1px solid rgba(100, 108, 255, 0.2)',
            fontSize: '0.9rem',
            color: '#646cff',
            fontWeight: '600',
            transition: 'all 0.2s'
          }}
          title="Click to share game link"
        >
          <span>Share to Play ⚔️</span>
          <span>🔗</span>
        </button>
      </header>

      <div className="game-info">
        <div className="stat-card">
          <div className="stat-label">Goats in Hand</div>
          <div className="stat-value">{gameState.goatsInHand}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Goats Killed</div>
          <div className="stat-value" style={{ color: gameState.goatsKilled > 0 ? '#ff4444' : '#eee' }}>
            {gameState.goatsKilled} / 5
          </div>
        </div>
      </div>

      {gameState.winner && (
        <div style={{ 
            background: 'rgba(255, 215, 0, 0.1)', 
            border: '1px solid gold', 
            padding: '1rem', 
            borderRadius: '8px',
            marginBottom: '1rem',
            textAlign: 'center'
        }}>
          <h2 style={{ color: 'gold', margin: 0 }}>🏆 {gameState.winner} Wins! 🏆</h2>
          <p style={{ margin: '0.5rem 0 1rem', color: '#ccc' }}>Reason: {gameState.winReason}</p>
          
          <button
            onClick={returnToHome}
            style={{
                padding: '0.8rem 1.5rem',
                fontSize: '1rem',
                background: '#646cff',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                transition: 'transform 0.1s'
            }}
            onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            🏠 Return to Home
          </button>
        </div>
      )}
      
      {error && (
        <div style={{ 
            color: '#ff6b6b', 
            background: 'rgba(255, 107, 107, 0.1)', 
            padding: '0.5rem 1rem', 
            borderRadius: '4px',
            marginBottom: '1rem'
        }}>
            {error}
        </div>
      )}
      
      <div className="board-container">
        <Board 
            gameState={gameState} 
            onNodeClick={handleNodeClick} 
            selectedNode={selectedNode} 
        />
      </div>
    </div>
  );
}

export default App;
