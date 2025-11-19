import uuid
import math
from typing import List, Dict, Optional, Tuple
from backend.models import GameState, Move

# Node coordinates for the 23-node board (Custom Variant)
# Calculated based on a perspective "Fan" projection where lines diverge from Node 0 (or virtual apex).
NODE_COORDINATES = {
    0: (50, 0),
    # Row 2 (y=30)
    1: (10, 30), 2: (32, 30), 3: (44, 30), 4: (56, 30), 5: (68, 30), 6: (90, 30),
    # Row 3 (y=55)
    7: (0, 55), 8: (17, 55), 9: (39, 55), 10: (61, 55), 11: (83, 55), 12: (100, 55),
    # Row 4 (y=80)
    13: (-10, 80), 14: (2, 80), 15: (34, 80), 16: (66, 80), 17: (98, 80), 18: (110, 80),
    # Row 5 (y=100)
    19: (-10, 100), 20: (30, 100), 21: (70, 100), 22: (110, 100)
}

# Explicit Adjacency Map
ADJACENCY_MAP = {
    0: [2, 3, 4, 5],
    1: [2, 7],
    2: [0, 1, 3, 8],
    3: [0, 2, 4, 9],
    4: [0, 3, 5, 10],
    5: [0, 4, 6, 11],
    6: [5, 12],
    7: [1, 8, 13],
    8: [2, 7, 9, 14],
    9: [3, 8, 10, 15],
    10: [4, 9, 11, 16],
    11: [5, 10, 12, 17],
    12: [6, 11, 18],
    13: [7, 14],
    14: [8, 13, 15, 19],
    15: [9, 14, 16, 20],
    16: [10, 15, 17, 21],
    17: [11, 16, 18, 22],
    18: [12, 17],
    19: [14, 20],
    20: [15, 19, 21],
    21: [16, 20, 22],
    22: [17, 21]
}

# Explicit Lines for Valid Jumps
JUMP_LINES = [
    # Horizontal
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22],
    # Vertical / Fan
    [1, 7, 13],             # Left Wing
    [0, 2, 8, 14, 19],      # Fan 1
    [0, 3, 9, 15, 20],      # Fan 2
    [0, 4, 10, 16, 21],     # Fan 3
    [0, 5, 11, 17, 22],     # Fan 4
    [6, 12, 18]             # Right Wing
]

class GameEngine:
    def __init__(self, variant: str = "3T-15G-23N"):
        self.adjacency_map = ADJACENCY_MAP
        self.jump_table = self._build_jump_table()
        self.state = self._initialize_state(variant)

    def _build_adjacency_map(self) -> Dict[int, List[int]]:
        return ADJACENCY_MAP

    def _build_jump_table(self) -> List[Tuple[int, int, int]]:
        jumps = []
        # Iterate over all defined lines
        for line in JUMP_LINES:
            # Check forward jumps
            for i in range(len(line) - 2):
                start, over, land = line[i], line[i+1], line[i+2]
                jumps.append((start, over, land))
            # Check backward jumps
            for i in range(len(line) - 1, 1, -1):
                start, over, land = line[i], line[i-1], line[i-2]
                jumps.append((start, over, land))
        
        # Remove duplicates
        return list(set(jumps))

    def _initialize_state(self, variant: str) -> GameState:
        # Standard 3T-15G start: Tigers at 0, 2, 6 (Spine) or 0, 1, 2 (Apex)
        # Using Apex Triangle (0, 1, 2) as default
        board = ["E"] * 23
        board[0] = "T"
        board[1] = "T"
        board[2] = "T"
        
        return GameState(
            matchId=str(uuid.uuid4()),
            variant=variant,
            turnIndex=0,
            activePlayer="GOAT", # Goats move first in placement
            phase="PLACEMENT",
            board=board,
            goatsInHand=15,
            goatsKilled=0,
            history=[],
            winner=None,
            winReason=None,
            tigerPlayerId=None,
            goatPlayerId=None
        )

    def apply_move(self, move: Move):
        if self.state.winner:
            raise ValueError("Game is over")
        
        if move.player != self.state.activePlayer:
            raise ValueError(f"Not {move.player}'s turn")

        if self.state.phase == "PLACEMENT":
            self._handle_placement(move)
        elif self.state.phase == "MOVEMENT":
            self._handle_movement(move)
        
        self._check_win_condition()
        self._toggle_turn()

    def _handle_placement(self, move: Move):
        if move.player == "GOAT":
            if move.from_node is not None:
                raise ValueError("Goats cannot move during placement, only place")
            if self.state.board[move.to_node] != "E":
                raise ValueError("Target node is not empty")
            
            self.state.board[move.to_node] = "G"
            self.state.goatsInHand -= 1
            
        elif move.player == "TIGER":
            # Tigers can move during placement
            self._handle_movement(move)

    def _handle_movement(self, move: Move):
        if move.from_node is None:
            raise ValueError("Source node required for movement")
        
        piece = self.state.board[move.from_node]
        if (move.player == "TIGER" and piece != "T") or (move.player == "GOAT" and piece != "G"):
            raise ValueError("Invalid piece selection")
            
        if self.state.board[move.to_node] != "E":
            raise ValueError("Target node is not empty")

        # Check Adjacency
        if move.to_node in self.adjacency_map[move.from_node]:
            # Simple Move
            self.state.board[move.from_node] = "E"
            self.state.board[move.to_node] = "T" if move.player == "TIGER" else "G"
            return

        # Check Jump (Tiger only)
        if move.player == "TIGER":
            for start, over, land in self.jump_table:
                if start == move.from_node and land == move.to_node:
                    if self.state.board[over] == "G":
                        # Valid Kill
                        self.state.board[move.from_node] = "E"
                        self.state.board[over] = "E" # Remove Goat
                        self.state.board[move.to_node] = "T"
                        self.state.goatsKilled += 1
                        return
                    else:
                        raise ValueError("Must jump over a Goat")
            raise ValueError("Invalid move or jump")
        
        raise ValueError("Invalid move")

    def _toggle_turn(self):
        if self.state.phase == "PLACEMENT":
            if self.state.goatsInHand == 0:
                self.state.phase = "MOVEMENT"
                # If it was Goat's turn (placing last goat), now it's Tiger's turn?
                # Usually placement alternates.
                # If Goats just placed the last goat, it becomes Tiger's turn.
                # But if we are in "Interleaved Placement", it just toggles.
                pass
        
        self.state.activePlayer = "TIGER" if self.state.activePlayer == "GOAT" else "GOAT"

    def _check_win_condition(self):
        if self.state.goatsKilled >= 5:
            self.state.winner = "TIGER"
            self.state.winReason = "CAPTURE_LIMIT"
            self.state.phase = "GAME_OVER"
            return
        
        # Check Stalemate (Tiger trapped)
        # Only relevant if it's Tiger's turn (or about to be)
        # But we check this after every move.
        # If Tigers have NO moves, Goats win.
        
        tiger_positions = [i for i, x in enumerate(self.state.board) if x == "T"]
        can_move = False
        for pos in tiger_positions:
            # Check adjacent empty
            for neighbor in self.adjacency_map[pos]:
                if self.state.board[neighbor] == "E":
                    can_move = True
                    break
            if can_move: break
            
            # Check jumps
            for start, over, land in self.jump_table:
                if start == pos:
                    if self.state.board[over] == "G" and self.state.board[land] == "E":
                        can_move = True
                        break
            if can_move: break
            
        if not can_move:
            self.state.winner = "GOAT"
            self.state.winReason = "STALEMATE"
            self.state.phase = "GAME_OVER"
