import { useState, useEffect } from 'react';
import axios from 'axios';
import { GameState, Move } from './game/types.ts';
import { Board } from './components/Board';

function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createGame = async () => {
      try {
        const response = await axios.post('/api/games', { variant: "3T-15G-23N" });
        setGameState(response.data);
      } catch (error) {
        console.error("Error creating game:", error);
      }
    };
    createGame();
  }, []);

  const handleNodeClick = async (nodeId: number) => {
    if (!gameState) return;
    setError(null);

    const piece = gameState.board[nodeId];
    // const isMyTurn = true; // Single player for now, or hotseat

    if (gameState.phase === "PLACEMENT") {
      if (gameState.activePlayer === "GOAT") {
        if (piece === "E") {
          await sendMove({ player: "GOAT", from_node: null, to_node: nodeId });
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
        to_node: nodeId
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

  if (!gameState) return <div style={{ color: '#888', marginTop: '20vh' }}>Loading Game Engine...</div>;

  return (
    <div className="App game-container">
      <header>
        <h1>Aadu Puli Aattam</h1>
        <div className={`turn-indicator turn-${gameState.activePlayer}`}>
          Current Turn: <strong>{gameState.activePlayer}</strong>
          <span className="phase-badge">{gameState.phase}</span>
        </div>
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
