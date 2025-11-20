from backend.models import GameState, Move
from backend.game_engine import GameEngine
import random
import copy

class AIEngine:
    def __init__(self):
        pass

    def get_best_move(self, state: GameState) -> Move:
        player = state.activePlayer
        depth = 2  # Depth can be adjusted for difficulty
        
        best_score = float('-inf')
        best_move = None
        
        # Create a simulation engine
        # Use model_copy if pydantic v2, or copy if v1. 
        # To be safe with lists, we ensure deep copy.
        try:
            sim_state = state.model_copy(deep=True)
        except AttributeError:
            sim_state = state.copy(deep=True)

        sim_engine = GameEngine(state=sim_state)
        valid_moves = sim_engine.get_valid_moves(player)
        
        if not valid_moves:
            return None

        random.shuffle(valid_moves)

        for move in valid_moves:
            try:
                next_state = sim_state.model_copy(deep=True) if hasattr(sim_state, 'model_copy') else sim_state.copy(deep=True)
            except Exception:
                 # Fallback for deep copy if pydantic fails
                next_state = copy.deepcopy(sim_state)

            temp_engine = GameEngine(state=next_state)
            try:
                temp_engine.apply_move(move)
                score = self.minimax(next_state, depth - 1, False, player)
                
                if score > best_score:
                    best_score = score
                    best_move = move
            except ValueError:
                continue
                
        return best_move

    def minimax(self, state: GameState, depth: int, is_maximizing: bool, ai_player: str) -> float:
        if depth == 0 or state.phase == "GAME_OVER":
            return self.evaluate_state(state, ai_player)

        sim_engine = GameEngine(state=state)
        current_player = state.activePlayer
        valid_moves = sim_engine.get_valid_moves(current_player)

        if not valid_moves:
            return self.evaluate_state(state, ai_player)

        if is_maximizing:
            max_eval = float('-inf')
            for move in valid_moves:
                try:
                    next_state = state.model_copy(deep=True) if hasattr(state, 'model_copy') else state.copy(deep=True)
                except:
                    next_state = copy.deepcopy(state)

                temp_engine = GameEngine(state=next_state)
                try:
                    temp_engine.apply_move(move)
                    eval = self.minimax(next_state, depth - 1, False, ai_player)
                    max_eval = max(max_eval, eval)
                except:
                    continue
            return max_eval
        else:
            min_eval = float('inf')
            for move in valid_moves:
                try:
                    next_state = state.model_copy(deep=True) if hasattr(state, 'model_copy') else state.copy(deep=True)
                except:
                    next_state = copy.deepcopy(state)

                temp_engine = GameEngine(state=next_state)
                try:
                    temp_engine.apply_move(move)
                    eval = self.minimax(next_state, depth - 1, True, ai_player)
                    min_eval = min(min_eval, eval)
                except:
                    continue
            return min_eval

    def evaluate_state(self, state: GameState, ai_player: str) -> float:
        if state.winner:
            if state.winner == ai_player:
                return 10000
            else:
                return -10000

        score = 0
        
        # 1. Material: Goats Killed
        if ai_player == "TIGER":
            score += state.goatsKilled * 100
        else:
            score -= state.goatsKilled * 100
            
        # 2. Mobility: Number of available moves for Tigers
        sim_engine = GameEngine(state=state)
        tiger_moves = len(sim_engine.get_valid_moves("TIGER"))
        
        if ai_player == "TIGER":
            score += tiger_moves * 10
        else:
            score -= tiger_moves * 10
            
        return score
