from pydantic import BaseModel
from typing import List, Optional, Literal

class GameState(BaseModel):
    matchId: str
    variant: Literal["3T-15G-23N"]
    turnIndex: int
    activePlayer: Literal["TIGER", "GOAT"]
    phase: Literal["PLACEMENT", "MOVEMENT", "GAME_OVER"]
    board: List[Literal["T", "G", "E"]]
    goatsInHand: int
    goatsKilled: int
    history: List[str]
    zobristHash: str
    winner: Optional[Literal["TIGER", "GOAT"]] = None
    winReason: Optional[Literal["CAPTURE_LIMIT", "STALEMATE", "FORFEIT", "REPETITION", "OPPONENT_DISCONNECTED"]] = None
    tigerPlayerId: Optional[str] = None
    goatPlayerId: Optional[str] = None

class Move(BaseModel):
    player: Literal["TIGER", "GOAT"]
    from_node: Optional[int] = None # None for placement
    to_node: int
    playerId: str

