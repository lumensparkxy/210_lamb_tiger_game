# Aadu Puli Aattam (Lambs and Tigers) - 23 Node Variant

This project implements the 3-Tiger / 15-Goat / 23-Node variant of the ancient strategy game Aadu Puli Aattam.

## Architecture

- **Backend:** Python FastAPI
  - Implements the Game Engine, State Machine, and Move Validation.
  - Uses a graph-theoretic approach with an adjacency list and pre-computed jump table.
- **Frontend:** React (Vite) + TypeScript
  - Renders the board using SVG.
  - Communicates with the backend via REST API.

## Setup

### Prerequisites
- Python 3.8+
- Node.js 16+

### Installation

1. **Backend:**
   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   ```

## Running the Game

You can run the project using the VS Code Tasks provided.

1. **Run Backend:**
   - Open Command Palette (`Cmd+Shift+P`) -> `Tasks: Run Task` -> `Run Backend`
   - Or run manually: `uvicorn backend.main:app --reload`

2. **Run Frontend:**
   - Open Command Palette -> `Tasks: Run Task` -> `Run Frontend`
   - Or run manually: `cd frontend && npm run dev`

3. Open your browser to `http://localhost:5173`.

## Game Rules (3/15/23 Variant)

- **Objective:**
  - **Tigers:** Capture 5 Goats.
  - **Goats:** Encircle all Tigers so they have no valid moves.
- **Phase 1: Placement**
  - Goats are placed one by one on empty nodes.
  - Tigers can move during this phase.
- **Phase 2: Movement**
  - Once all 15 Goats are placed, they can move to adjacent empty nodes.
  - Tigers can move to adjacent empty nodes OR jump over a Goat to capture it.
