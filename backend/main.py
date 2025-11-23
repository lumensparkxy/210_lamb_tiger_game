from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.encoders import jsonable_encoder
import os
import asyncio
from pydantic import BaseModel
from typing import List, Optional, Literal, Dict
from backend.game_engine import GameEngine
from backend.ai_engine import AIEngine
from backend.models import GameState, Move

app = FastAPI(title="Aadu Puli Aattam Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory store for games
games: Dict[str, GameEngine] = {}
ai_engine = AIEngine()

class ConnectionManager:
    def __init__(self):
        # Map match_id -> List of Dict {"ws": WebSocket, "pid": str}
        self.active_connections: Dict[str, List[Dict]] = {}

    async def connect(self, websocket: WebSocket, match_id: str, player_id: Optional[str] = None):
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = []
        
        self.active_connections[match_id].append({"ws": websocket, "pid": player_id})
        print(f"Client connected to {match_id}. Total: {len(self.active_connections[match_id])}")

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.active_connections:
            self.active_connections[match_id] = [
                c for c in self.active_connections[match_id] 
                if c["ws"] != websocket
            ]
            print(f"Client disconnected from {match_id}. Total: {len(self.active_connections[match_id])}")

    def is_player_connected(self, match_id: str, player_id: str) -> bool:
        if match_id not in self.active_connections:
            return False
        return any(c["pid"] == player_id for c in self.active_connections[match_id])

    async def broadcast(self, match_id: str, message: dict):
        if match_id in self.active_connections:
            for connection in self.active_connections[match_id]:
                try:
                    await connection["ws"].send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

async def handle_disconnection(match_id: str, player_id: str):
    print(f"Player {player_id} disconnected from {match_id}. Waiting for reconnection...")
    # Wait 15 seconds for reconnection
    await asyncio.sleep(15)
    
    # Check if player is back
    if not manager.is_player_connected(match_id, player_id):
        if match_id in games:
            game = games[match_id]
            # Only forfeit if game is active and not vs AI
            if not game.state.winner and game.state.phase != "GAME_OVER":
                winner = None
                if game.state.tigerPlayerId == player_id:
                    winner = "GOAT"
                elif game.state.goatPlayerId == player_id:
                    winner = "TIGER"
                
                if winner:
                    print(f"Player {player_id} timed out. {winner} wins by forfeit.")
                    game.state.winner = winner
                    game.state.winReason = "OPPONENT_DISCONNECTED"
                    game.state.phase = "GAME_OVER"
                    await manager.broadcast(match_id, jsonable_encoder(game.state))
    else:
        print(f"Player {player_id} reconnected to {match_id}.")

class MatchmakingQueue:
    def __init__(self):
        self.queue: List[Dict] = [] # List of {"websocket": WebSocket, "playerId": str}

    async def add_player(self, websocket: WebSocket, player_id: str):
        await websocket.accept()
        # Check if player is already in queue to avoid duplicates
        if any(p["playerId"] == player_id for p in self.queue):
             # If same socket, ignore. If different, maybe remove old? 
             # For now, let's just append. The disconnect handler will clean up.
             pass
             
        self.queue.append({"websocket": websocket, "playerId": player_id})
        print(f"Player {player_id} added to matchmaking queue. Queue size: {len(self.queue)}")
        await self.check_match()

    def remove_player(self, websocket: WebSocket):
        self.queue = [p for p in self.queue if p["websocket"] != websocket]
        print(f"Player removed from matchmaking queue. Queue size: {len(self.queue)}")

    async def check_match(self):
        if len(self.queue) >= 2:
            player1 = self.queue.pop(0)
            player2 = self.queue.pop(0)
            
            # Create Game
            game = GameEngine("3T-15G-23N")
            game.state.tigerPlayerId = player1["playerId"]
            game.state.goatPlayerId = player2["playerId"]
            games[game.state.matchId] = game
            
            print(f"Match found! {game.state.matchId}: {player1['playerId']} vs {player2['playerId']}")

            # Notify Player 1
            try:
                await player1["websocket"].send_json({
                    "status": "MATCH_FOUND",
                    "matchId": game.state.matchId,
                    "role": "TIGER"
                })
                await player1["websocket"].close()
            except Exception as e:
                print(f"Error notifying player 1: {e}")

            # Notify Player 2
            try:
                await player2["websocket"].send_json({
                    "status": "MATCH_FOUND",
                    "matchId": game.state.matchId,
                    "role": "GOAT"
                })
                await player2["websocket"].close()
            except Exception as e:
                print(f"Error notifying player 2: {e}")

matchmaking_queue = MatchmakingQueue()

class CreateGameRequest(BaseModel):
    variant: Literal["3T-15G-23N"] = "3T-15G-23N"
    playerId: str
    preferredRole: Optional[Literal["TIGER", "GOAT"]] = None
    vsAI: bool = False

@app.post("/api/games", response_model=GameState)
def create_game(request: CreateGameRequest):
    game = GameEngine(request.variant)
    
    # Assign creator role
    if request.preferredRole == "TIGER":
        game.state.tigerPlayerId = request.playerId
        if request.vsAI:
            game.state.goatPlayerId = "AI"
    elif request.preferredRole == "GOAT":
        game.state.goatPlayerId = request.playerId
        if request.vsAI:
            game.state.tigerPlayerId = "AI"
    else:
        # Default to GOAT if not specified (or random)
        game.state.goatPlayerId = request.playerId
        if request.vsAI:
            game.state.tigerPlayerId = "AI"

    # If AI is assigned and it's AI's turn, make a move
    if request.vsAI:
        if (game.state.activePlayer == "TIGER" and game.state.tigerPlayerId == "AI") or \
           (game.state.activePlayer == "GOAT" and game.state.goatPlayerId == "AI"):
            ai_move = ai_engine.get_best_move(game.state)
            if ai_move:
                game.apply_move(ai_move)

    games[game.state.matchId] = game
    return game.state

@app.get("/api/games/{match_id}", response_model=GameState)
async def get_game(match_id: str, playerId: Optional[str] = None):
    if match_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[match_id]
    
    # If playerId is provided, try to assign a role if not already assigned
    if playerId:
        # Check if this player is already in the game
        if game.state.tigerPlayerId == playerId or game.state.goatPlayerId == playerId:
            pass # Already assigned
        else:
            # Try to assign empty slots
            assigned = False
            if game.state.tigerPlayerId is None:
                game.state.tigerPlayerId = playerId
                assigned = True
            elif game.state.goatPlayerId is None:
                game.state.goatPlayerId = playerId
                assigned = True
            else:
                # Game is full, user is a spectator
                pass
            
            if assigned:
                await manager.broadcast(match_id, jsonable_encoder(game.state))

    return game.state

@app.post("/api/games/{match_id}/move", response_model=GameState)
async def make_move(match_id: str, move: Move):
    if match_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[match_id]
    
    # Validate that the player making the move is the assigned player for that role
    if move.player == "TIGER":
        if game.state.tigerPlayerId and game.state.tigerPlayerId != move.playerId:
            raise HTTPException(status_code=403, detail="You are not the Tiger player")
    elif move.player == "GOAT":
        if game.state.goatPlayerId and game.state.goatPlayerId != move.playerId:
            raise HTTPException(status_code=403, detail="You are not the Goat player")

    try:
        game.apply_move(move)
        # Broadcast update
        await manager.broadcast(match_id, jsonable_encoder(game.state))
        
        # Check if next player is AI
        next_player = game.state.activePlayer
        is_ai_turn = False
        if next_player == "TIGER" and game.state.tigerPlayerId == "AI":
            is_ai_turn = True
        elif next_player == "GOAT" and game.state.goatPlayerId == "AI":
            is_ai_turn = True
            
        if is_ai_turn and not game.state.winner:
            # AI Turn
            ai_move = ai_engine.get_best_move(game.state)
            if ai_move:
                game.apply_move(ai_move)
                await manager.broadcast(match_id, jsonable_encoder(game.state))

        return game.state
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.websocket("/ws/{match_id}")
async def websocket_endpoint(websocket: WebSocket, match_id: str, playerId: Optional[str] = None):
    await manager.connect(websocket, match_id, playerId)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)
        if playerId:
            asyncio.create_task(handle_disconnection(match_id, playerId))

@app.websocket("/ws/matchmaking/{player_id}")
async def matchmaking_endpoint(websocket: WebSocket, player_id: str):
    await matchmaking_queue.add_player(websocket, player_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        matchmaking_queue.remove_player(websocket)

# Serve React App (Place this after API routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
