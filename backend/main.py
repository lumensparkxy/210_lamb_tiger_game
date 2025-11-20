from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.encoders import jsonable_encoder
import os
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
        # Map match_id -> List of WebSockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, match_id: str):
        await websocket.accept()
        if match_id not in self.active_connections:
            self.active_connections[match_id] = []
        self.active_connections[match_id].append(websocket)
        print(f"Client connected to {match_id}. Total: {len(self.active_connections[match_id])}")

    def disconnect(self, websocket: WebSocket, match_id: str):
        if match_id in self.active_connections:
            if websocket in self.active_connections[match_id]:
                self.active_connections[match_id].remove(websocket)
                print(f"Client disconnected from {match_id}. Total: {len(self.active_connections[match_id])}")

    async def broadcast(self, match_id: str, message: dict):
        if match_id in self.active_connections:
            for connection in self.active_connections[match_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to client: {e}")

manager = ConnectionManager()

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
def get_game(match_id: str, playerId: Optional[str] = None):
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
            if game.state.tigerPlayerId is None:
                game.state.tigerPlayerId = playerId
            elif game.state.goatPlayerId is None:
                game.state.goatPlayerId = playerId
            else:
                # Game is full, user is a spectator
                pass

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
async def websocket_endpoint(websocket: WebSocket, match_id: str):
    await manager.connect(websocket, match_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, match_id)

# Serve React App (Place this after API routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
