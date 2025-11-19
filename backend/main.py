from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from pydantic import BaseModel
from typing import List, Optional, Literal
from backend.game_engine import GameEngine
from backend.models import GameState, Move

app = FastAPI(title="Aadu Puli Aattam Engine")

# In-memory store for games
games = {}

class CreateGameRequest(BaseModel):
    variant: Literal["3T-15G-23N"] = "3T-15G-23N"

@app.post("/api/games", response_model=GameState)
def create_game(request: CreateGameRequest):
    game = GameEngine(request.variant)
    games[game.state.matchId] = game
    return game.state

@app.get("/api/games/{match_id}", response_model=GameState)
def get_game(match_id: str):
    if match_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    return games[match_id].state

@app.post("/api/games/{match_id}/move", response_model=GameState)
def make_move(match_id: str, move: Move):
    if match_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[match_id]
    try:
        game.apply_move(move)
        return game.state
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# Serve React App (Place this after API routes)
frontend_dist = os.path.join(os.path.dirname(__file__), "../frontend/dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
