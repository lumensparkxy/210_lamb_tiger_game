export interface GameState {
    matchId: string;
    variant: "3T-15G-23N";
    turnIndex: number;
    activePlayer: "TIGER" | "GOAT";
    phase: "PLACEMENT" | "MOVEMENT" | "GAME_OVER";
    board: ("T" | "G" | "E")[];
    goatsInHand: number;
    goatsKilled: number;
    history: string[];
    winner: "TIGER" | "GOAT" | null;
    winReason: "CAPTURE_LIMIT" | "STALEMATE" | "FORFEIT" | null;
}

export interface Move {
    player: "TIGER" | "GOAT";
    from_node: number | null;
    to_node: number;
}
