"""Unit tests for the GameEngine class."""
import pytest
from backend.game_engine import GameEngine, ADJACENCY_MAP, JUMP_LINES
from backend.models import Move


class TestGameEngineInitialization:
    """Tests for game initialization."""

    def test_initial_state_has_three_tigers(self):
        """Game should start with 3 tigers on the board."""
        game = GameEngine()
        tiger_count = game.state.board.count("T")
        assert tiger_count == 3

    def test_initial_state_has_no_goats_on_board(self):
        """Game should start with no goats on the board."""
        game = GameEngine()
        goat_count = game.state.board.count("G")
        assert goat_count == 0

    def test_initial_goats_in_hand(self):
        """Game should start with 15 goats in hand."""
        game = GameEngine()
        assert game.state.goatsInHand == 15

    def test_initial_goats_killed(self):
        """Game should start with 0 goats killed."""
        game = GameEngine()
        assert game.state.goatsKilled == 0

    def test_initial_phase_is_placement(self):
        """Game should start in PLACEMENT phase."""
        game = GameEngine()
        assert game.state.phase == "PLACEMENT"

    def test_goat_moves_first(self):
        """Goats should move first."""
        game = GameEngine()
        assert game.state.activePlayer == "GOAT"

    def test_tigers_at_apex_positions(self):
        """Tigers should start at positions 0, 1, 2."""
        game = GameEngine()
        assert game.state.board[0] == "T"
        assert game.state.board[1] == "T"
        assert game.state.board[2] == "T"

    def test_zobrist_hash_is_set(self):
        """Initial state should have a zobrist hash."""
        game = GameEngine()
        assert game.state.zobristHash is not None
        assert game.state.zobristHash.startswith("0x")


class TestGoatPlacement:
    """Tests for goat placement during placement phase."""

    def test_goat_can_place_on_empty_node(self):
        """Goat should be able to place on any empty node."""
        game = GameEngine()
        move = Move(player="GOAT", from_node=None, to_node=10, playerId="test")
        game.apply_move(move)
        assert game.state.board[10] == "G"

    def test_goat_placement_decrements_goats_in_hand(self):
        """Placing a goat should decrement goatsInHand."""
        game = GameEngine()
        initial_goats = game.state.goatsInHand
        move = Move(player="GOAT", from_node=None, to_node=10, playerId="test")
        game.apply_move(move)
        assert game.state.goatsInHand == initial_goats - 1

    def test_goat_cannot_place_on_occupied_node(self):
        """Goat should not be able to place on an occupied node."""
        game = GameEngine()
        # Node 0 has a tiger
        move = Move(player="GOAT", from_node=None, to_node=0, playerId="test")
        with pytest.raises(ValueError, match="not empty"):
            game.apply_move(move)

    def test_goat_cannot_move_during_placement(self):
        """Goats cannot move pieces during placement phase."""
        game = GameEngine()
        # First place a goat
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        # Skip tiger turn
        game.state.activePlayer = "GOAT"
        # Try to move the placed goat (should fail)
        move = Move(player="GOAT", from_node=10, to_node=9, playerId="test")
        with pytest.raises(ValueError, match="only place"):
            game.apply_move(move)


class TestTigerMovement:
    """Tests for tiger movement."""

    def test_tiger_can_move_to_adjacent_empty(self):
        """Tiger should be able to move to adjacent empty node."""
        game = GameEngine()
        # Place goat first (it's goat's turn)
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        # Now tiger can move - Tiger at 0 can move to 3, 4, 5 (adjacent empty)
        move = Move(player="TIGER", from_node=0, to_node=3, playerId="test")
        game.apply_move(move)
        assert game.state.board[0] == "E"
        assert game.state.board[3] == "T"

    def test_tiger_cannot_move_to_non_adjacent(self):
        """Tiger should not be able to move to non-adjacent node without jumping."""
        game = GameEngine()
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        # Node 0 to node 7 is not adjacent and no goat in between
        move = Move(player="TIGER", from_node=0, to_node=7, playerId="test")
        with pytest.raises(ValueError):
            game.apply_move(move)


class TestTigerCapture:
    """Tests for tiger capturing goats."""

    def test_tiger_can_capture_goat(self):
        """Tiger should be able to jump over and capture a goat."""
        game = GameEngine()
        # Setup: Place goat at node 3 (adjacent to tiger at 0)
        # Tiger at 0, goat at 3, empty at 9 -> tiger can jump 0->3->9
        game.apply_move(Move(player="GOAT", from_node=None, to_node=3, playerId="test"))
        
        # Tiger jumps from 0 over 3 to 9
        move = Move(player="TIGER", from_node=0, to_node=9, playerId="test")
        game.apply_move(move)
        
        assert game.state.board[0] == "E"  # Tiger left
        assert game.state.board[3] == "E"  # Goat captured
        assert game.state.board[9] == "T"  # Tiger landed
        assert game.state.goatsKilled == 1

    def test_tiger_win_on_five_captures(self):
        """Tiger should win when 5 goats are captured."""
        game = GameEngine()
        # Manually set up near-win state
        game.state.goatsKilled = 4
        game.state.board[3] = "G"  # Place goat for capture
        game.state.activePlayer = "TIGER"
        
        # Tiger jumps from 0 over 3 to 9
        move = Move(player="TIGER", from_node=0, to_node=9, playerId="test")
        game.apply_move(move)
        
        assert game.state.goatsKilled == 5
        assert game.state.winner == "TIGER"
        assert game.state.winReason == "CAPTURE_LIMIT"
        assert game.state.phase == "GAME_OVER"


class TestGoatWinCondition:
    """Tests for goat win conditions."""

    def test_goat_wins_when_tigers_trapped(self):
        """Goats should win when all tigers are trapped (no valid moves)."""
        game = GameEngine()
        # Set up a position where tigers are completely trapped
        game.state.phase = "MOVEMENT"
        game.state.goatsInHand = 0
        
        # Place tiger at node 13 (corner) surrounded by goats
        # Node 13 is adjacent to 7 and 14 only
        # Jump lines: 13->14->15 and 13->7->1
        # Need to block adjacents AND jump landing spots
        game.state.board = ["E"] * 23
        game.state.board[13] = "T"   # Tiger at corner node
        game.state.board[7] = "G"    # Block adjacent
        game.state.board[14] = "G"   # Block adjacent
        game.state.board[15] = "G"   # Block jump landing 13->14->15
        game.state.board[1] = "G"    # Block jump landing 13->7->1
        
        game.state.activePlayer = "GOAT"
        
        # Check win condition - tiger at 13 has no moves
        game._check_win_condition()
        
        assert game.state.winner == "GOAT"
        assert game.state.winReason == "STALEMATE"


class TestPhaseTransition:
    """Tests for game phase transitions."""

    def test_transition_to_movement_after_all_goats_placed(self):
        """Game should transition to MOVEMENT phase after all goats are placed."""
        game = GameEngine()
        
        # Place all 15 goats (alternating with tiger moves)
        while game.state.goatsInHand > 0:
            if game.state.activePlayer == "GOAT":
                # Find an empty node
                empty_nodes = [i for i in range(23) if game.state.board[i] == "E"]
                if empty_nodes:
                    node = empty_nodes[0]
                    game.apply_move(Move(player="GOAT", from_node=None, to_node=node, playerId="test"))
            else:
                # Tiger's turn - make a simple valid move
                valid_moves = game.get_valid_moves("TIGER")
                if valid_moves:
                    game.apply_move(valid_moves[0])
        
        assert game.state.phase == "MOVEMENT"
        assert game.state.goatsInHand == 0


class TestValidMoves:
    """Tests for get_valid_moves method."""

    def test_goat_valid_moves_in_placement(self):
        """Goat should have moves for all empty nodes during placement."""
        game = GameEngine()
        moves = game.get_valid_moves("GOAT")
        
        empty_count = game.state.board.count("E")
        assert len(moves) == empty_count

    def test_tiger_valid_moves_include_adjacent(self):
        """Tiger valid moves should include adjacent empty nodes."""
        game = GameEngine()
        moves = game.get_valid_moves("TIGER")
        
        # Tiger at 0 should be able to move to adjacent nodes 2, 3, 4, 5
        # But 2 has a tiger, so only 3, 4, 5
        to_nodes = [m.to_node for m in moves if m.from_node == 0]
        assert 3 in to_nodes
        assert 4 in to_nodes
        assert 5 in to_nodes

    def test_tiger_valid_moves_include_jumps(self):
        """Tiger valid moves should include valid capture jumps."""
        game = GameEngine()
        game.state.board[3] = "G"  # Place goat at 3
        
        moves = game.get_valid_moves("TIGER")
        
        # Tiger at 0 should be able to jump over goat at 3 to land at 9
        jump_moves = [m for m in moves if m.from_node == 0 and m.to_node == 9]
        assert len(jump_moves) == 1


class TestTurnAlternation:
    """Tests for turn alternation."""

    def test_turn_alternates_after_goat_move(self):
        """Turn should switch to Tiger after Goat moves."""
        game = GameEngine()
        assert game.state.activePlayer == "GOAT"
        
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        assert game.state.activePlayer == "TIGER"

    def test_turn_alternates_after_tiger_move(self):
        """Turn should switch to Goat after Tiger moves."""
        game = GameEngine()
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        assert game.state.activePlayer == "TIGER"
        
        game.apply_move(Move(player="TIGER", from_node=0, to_node=3, playerId="test"))
        assert game.state.activePlayer == "GOAT"


class TestZobristHashing:
    """Tests for Zobrist hash consistency."""

    def test_hash_changes_after_move(self):
        """Zobrist hash should change after a move."""
        game = GameEngine()
        initial_hash = game.state.zobristHash
        
        game.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        assert game.state.zobristHash != initial_hash

    def test_same_position_same_hash(self):
        """Same board position should produce same hash."""
        game1 = GameEngine()
        game2 = GameEngine()
        
        # Apply same move to both
        game1.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        game2.apply_move(Move(player="GOAT", from_node=None, to_node=10, playerId="test"))
        
        assert game1.state.zobristHash == game2.state.zobristHash


class TestAdjacencyMap:
    """Tests for the adjacency map correctness."""

    def test_adjacency_is_symmetric(self):
        """If A is adjacent to B, then B should be adjacent to A."""
        for node, neighbors in ADJACENCY_MAP.items():
            for neighbor in neighbors:
                assert node in ADJACENCY_MAP[neighbor], \
                    f"Node {node} is adjacent to {neighbor} but not vice versa"

    def test_all_nodes_have_adjacencies(self):
        """All 23 nodes should have at least one adjacent node."""
        for i in range(23):
            assert i in ADJACENCY_MAP, f"Node {i} not in adjacency map"
            assert len(ADJACENCY_MAP[i]) > 0, f"Node {i} has no adjacent nodes"


class TestErrorHandling:
    """Tests for error handling."""

    def test_wrong_player_turn(self):
        """Should raise error when wrong player tries to move."""
        game = GameEngine()
        # It's Goat's turn
        move = Move(player="TIGER", from_node=0, to_node=3, playerId="test")
        with pytest.raises(ValueError, match="Not TIGER's turn"):
            game.apply_move(move)

    def test_cannot_move_after_game_over(self):
        """Should raise error when trying to move after game is over."""
        game = GameEngine()
        game.state.winner = "TIGER"
        game.state.phase = "GAME_OVER"
        
        move = Move(player="GOAT", from_node=None, to_node=10, playerId="test")
        with pytest.raises(ValueError, match="Game is over"):
            game.apply_move(move)

    def test_invalid_piece_selection(self):
        """Should raise error when selecting opponent's piece."""
        game = GameEngine()
        game.state.phase = "MOVEMENT"
        game.state.goatsInHand = 0
        game.state.board[10] = "G"
        
        # Try to move tiger's piece as goat
        move = Move(player="GOAT", from_node=0, to_node=3, playerId="test")
        with pytest.raises(ValueError, match="Invalid piece"):
            game.apply_move(move)
