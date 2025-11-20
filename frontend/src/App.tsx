import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { GameState, Move } from './game/types.ts';
import { Board } from './components/Board';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [isCreating, setIsCreating] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 1. Initialize Player ID
    let storedId = localStorage.getItem("apa_playerId");
    if (!storedId) {
      storedId = generateUUID();
      localStorage.setItem("apa_playerId", storedId);
    }
    setPlayerId(storedId);

    // 2. Check URL for Game ID
    const params = new URLSearchParams(window.location.search);
    const gameIdFromUrl = params.get("gameId");

    if (gameIdFromUrl) {
      joinGame(gameIdFromUrl, storedId);
    } else {
      setIsCreating(true);
    }

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

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

  const createNewGame = async (preferredRole: "TIGER" | "GOAT") => {
    try {
      const res = await axios.post('/api/games', { 
        variant: "3T-15G-23N",
        playerId: playerId,
        preferredRole: preferredRole
      });
      setGameState(res.data);
      window.history.pushState({}, '', `?gameId=${res.data.matchId}`);
      connectWebSocket(res.data.matchId);
      setIsCreating(false);
    } catch (e) {
      console.error("Error creating game", e);
    }
  };

  const connectWebSocket = (matchId: string) => {
    if (wsRef.current) wsRef.current.close();
    
    // Determine WebSocket URL based on environment
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // In development, we connect to port 8000 directly. In production, we use the same host (relative).
    const host = import.meta.env.DEV ? `${window.location.hostname}:8000` : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/${matchId}`;
    
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

  if (isCreating) {
    return (
      <div className="App game-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <h1>Aadu Puli Aattam</h1>
        <p>Create a new game to start playing.</p>
        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
          <button 
            onClick={() => createNewGame("TIGER")}
            style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#ff9f43', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
          >
            Play as Tiger 🐯
          </button>
          <button 
            onClick={() => createNewGame("GOAT")}
            style={{ padding: '1rem 2rem', fontSize: '1.2rem', background: '#1dd1a1', border: 'none', borderRadius: '8px', cursor: 'pointer', color: 'white' }}
          >
            Play as Goat 🐐
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) return <div style={{ color: '#888', marginTop: '20vh' }}>Loading Game Engine...</div>;

  const myRole = getMyRole();

  return (
    <div className="App game-container">
      <header>
        <h1>Aadu Puli Aattam</h1>
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
            marginBottom: '1rem'
        }}>
          <h2 style={{ color: 'gold', margin: 0 }}>🏆 {gameState.winner} Wins! 🏆</h2>
          <p style={{ margin: '0.5rem 0 0', color: '#ccc' }}>Reason: {gameState.winReason}</p>
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
