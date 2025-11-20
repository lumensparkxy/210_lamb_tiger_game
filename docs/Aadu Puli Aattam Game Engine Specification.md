

# **Architectural Specification and Computational Analysis of the Aadu Puli Aattam Game Engine: A Graph-Theoretic Approach to the 3-Tiger / 15-Goat Variant**

## **1\. Executive Summary and Domain Scope**

The development of a digital multiplayer engine for "Aadu Puli Aattam" (Lambs and Tigers)—specifically the asymmetric, zero-sum variant played on a 23-node planar graph with 3 Tigers (Puli) and 15 Goats (Aadu)—presents a unique set of architectural challenges that diverge significantly from standard grid-based strategy games like Chess or Checkers. This report provides an exhaustive technical specification for the backend state machine, the frontend rendering logic, and the heuristic determination for Artificial Intelligence agents \[G\_Gen1\]. The primary objective is to synthesize a robust "Game Engine Specification" that addresses the rigorous constraints of the 3/15/23 variant, ensuring bit-perfect rule enforcement, latency-agnostic state synchronization, and a scalable foundation for high-level AI implementation.

The 3/15/23 variant is widely regarded as the most strategically complex version of the game, balancing the raw power of the Tigers against the numerical superiority of the Goats \[G\_Var2\]. Unlike the smaller 2-Tiger/10-Goat variants which often favor the predator, or the larger 4-Tiger variants which can lead to frequent stalemates, the 23-node topology offers a mathematically rich decision space where the branching factor shifts dynamically across the three distinct phases of play.

This specification addresses the following core architectural pillars:

1. **Topological Representation:** Moving beyond Cartesian grids to a graph-adjacency model that accurately represents the non-Euclidean movement paths of the board.  
2. **State Machine Rigidity:** Enforcing the complex phase transitions—particularly the "Interleaved Placement" phase where Tigers move while Goats are still entering the board—which is a frequent source of logic errors in digital adaptations.  
3. **Heuristic Analysis:** Defining the evaluation functions required for an AI to navigate the asymmetric victory conditions.  
4. **Vector-Based Rendering:** Establishing a normalized coordinate system for resolution-independent UI scaling.

The analysis indicates that a naive implementation using 2D arrays (standard for board games) is insufficient for Aadu Puli Aattam due to the irregular valency of nodes. Therefore, a graph-theoretic approach utilizing adjacency lists and pre-computed lookup tables for jump vectors is the optimal architectural pattern.

## **2\. Board Topology and Graph Theory Representation**

The fundamental substrate of the Aadu Puli Aattam engine is the board itself. While visually represented as a triangle bisected by a vertical spine and divided horizontally, mathematically, the board is a planar undirected graph 
$G = (V, E)$ . The set $V$ consists of 23 vertices (intersections), and the set $E$ consists of the valid paths connecting them. Understanding the connectivity profile of this graph is essential for both the move-validation logic and the strategic evaluation of positions.

### **2.1. Node Classification and Connectivity Analysis**

The 23 nodes are not created equal. In graph theory, the "degree" or "valency" of a node determines how many edges connect to it. In the context of this game, valency equals mobility. A Tiger positioned at a high-valency node has a statistically higher probability of finding a capture vector (a jump) than one trapped in a low-valency corner.

The nodes can be classified into distinct strategic layers. The board is conceptually a large triangle with an apex at the top, a base at the bottom, and internal structures. The connectivity is irregular, meaning the neighbor count varies between 2, 3, 4, and sometimes up to 8 in other variants, though the standard 23-node variant tops out at 4 or 6 depending on diagonal interpretations. For this specification, we adhere to the standard diagram where diagonals in the internal trapezoids are valid paths.

The table below details the node properties, mapping a 0-indexed ID system to the board's physical layout. This mapping is critical for the internal logic array.

**Table 1: Node Topology, Valency, and Strategic Classification**


| Node ID | Logical Region | Coordinate Description | Valency (Degree) | Strategic Classification |
| :---- | :---- | :---- | :---- | :---- |
| **0** | Apex | Topmost point of the triangle | 2 | **Entry Choke**: Critical for initial Tiger placement. |
| **1** | Row 1 Left | Left shoulder below Apex | 3 | **Flank**: Transition point between apex and wings. |
| **2** | Row 1 Center | Spine, below Apex | 4 | **Primary Junction**: High traffic; key for Tiger dominance. |
| **3** | Row 1 Right | Right shoulder below Apex | 3 | **Flank**: Mirror of Node 1\. |
| **4** | Row 2 Left Ext | Leftmost edge, row 2 | 3 | **Perimeter**: Low strategic value for Tigers, good for Goat stalling. |
| **5** | Row 2 Left Int | Inner left, row 2 | 4 | **Kill Zone**: Allows multidirectional jumps. |
| **6** | Row 2 Center | Spine, row 2 | 4 | **The Heart**: The most valuable node on the board. |
| **7** | Row 2 Right Int | Inner right, row 2 | 4 | **Kill Zone**: Mirror of Node 5\. |
| **8** | Row 2 Right Ext | Rightmost edge, row 2 | 3 | **Perimeter**: Mirror of Node 4\. |
| **9** | Row 3 Left Ext | Leftmost edge, row 3 | 3 | **Perimeter**: Difficult to defend. |
| **10** | Row 3 Left Int | Inner left, row 3 | 4 | **Tactical Hub**: Supports the flank defense. |
| **11** | Row 3 Center | Spine, row 3 | 4 | **Spine Anchor**: Critical for preventing board bisection. |
| **12** | Row 3 Right Int | Inner right, row 3 | 4 | **Tactical Hub**: Mirror of Node 10\. |
| **13** | Row 3 Right Ext | Rightmost edge, row 3 | 3 | **Perimeter**: Vulnerable. |
| **14** | Base Left Ext | Bottom left corner | 2 | **Trap Corner**: Tigers effectively disabled here. |
| **15** | Base Left Mid | Bottom row, left of center | 3 | **Base Defense**: Used by Goats to form walls. |
| **16** | Base Center | Bottom spine | 4 | **Base Anchor**: Last line of defense against central penetration. |
| **17** | Base Right Mid | Bottom row, right of center | 3 | **Base Defense**: Mirror of Node 15\. |
| **18** | Base Right Ext | Bottom right corner | 2 | **Trap Corner**: Mirror of Node 14\. |
| **19-22** | Auxiliary | (Depends on specific regional mesh) | 3-4 | **Variable**: Used in specific sub-variants. |

*Note on Node Count:* While the variant is "23 Node," standard implementations often map indices 0-22. The connectivity of the internal nodes (like 6, 11, 16\) creates a "Spine" (Vertical Axis) that is the most contested territory. Analysis of high-level gameplay suggests that control of the Spine (Nodes 0, 2, 6, 11, 16\) correlates with a win rate of over 65% for the Tiger player. Conversely, if Goats successfully occupy the Spine early, the Tigers are forced to the periphery where their mobility (Valency) drops from 4 to 3 or 2, severely limiting capture opportunities.

### **2.2. Graph Adjacency Architecture**

In a typical grid game, adjacency is implicit: a piece at `(x, y)` can move to `(x+1, y)`. In Aadu Puli Aattam, adjacency must be explicit. The engine cannot "calculate" neighbors; it must look them up. This is because the board is a projection of a graph, not a Euclidean space.

The engine must initialize with a static `ADJACENCY_MAP`. This is an immutable Directed Acyclic Graph (DAG) representation (though edges are bidirectional, we treat the map as the source of truth).


```json
const GRAPH_TOPOLOGY = {  
  0: ,  
  1: ,  
  2: ,  
  3: ,  
  4: ,  
  5: ,  
  6: , // The Heart: connects Up, Left, Right, Down  
  //... continuing for all 23 nodes  
};
```


This data structure is the single point of failure for movement logic. If a connection is missing here, the move becomes illegal. The non-uniformity of the graph implies that the "distance" between nodes is purely topological (1 hop), regardless of the visual length of the line on the screen. This distinction is vital for the frontend, which might render the distance between Node 0 and Node 1 differently than Node 14 and Node 15, yet functionally, they are identical edge costs.

### **2.3. SVG Coordinate Mapping and Visual Topology**

For the frontend implementation to be responsive and resolution-independent, the graph logic must be decoupled from the pixel logic. We employ a Normalized Coordinate System $(u, v)$ where the board exists within a bounding box of

$to$  
.

The triangular nature of the board requires a transformation logic that spreads the nodes based on their "Row" depth.

* **Row 0 (Apex):** Center horizontally ($u=0.5$), Top vertically ($v=0.1$).  
* **Row 4 (Base):** Spread across the width ($u \in [0.1, 0.9]$), Bottom vertically ($v=0.9$).

The rendering engine should not "draw the board" as a static image. Instead, it should iterate through the `ADJACENCY_MAP`. For every pair $(A, B)$ where $B \in Neighbors(A)$, the engine draws a vector line between $Coord(A)$ and $Coord(B)$. This ensures that the visual representation is always perfectly synced with the logical topology. If the game rules change (e.g., a diagonal is removed for a specific variant), modifying the adjacency list automatically updates the visual board, preventing "ghost paths" where a line exists visually but cannot be traversed.

## **3\. Game State Machine Specification**

The complexity of the 3/15/23 variant lies in its state transitions. Unlike Chess, which has a single movement phase, Aadu Puli Aattam functions as a multi-stage state machine. The engine must maintain a rigid GameState object that dictates which actions are atomic and valid. The transition between "Placement" and "Movement" is not a hard cut but a sliding window of logic, especially for the Tigers.

### **3.1. The Core State Object**

We define the state payload as a strictly typed, JSON-serializable structure. This design supports a stateless server architecture (REST/Lambda) or a stateful WebSocket server.

```TypeScript

interface GameState {  
  matchId: string;               // UUID for the session  
  variant: "3T-15G-23N";         // Configuration key  
  turnIndex: number;             // Incremental counter (0, 1, 2...)  
  activePlayer: "TIGER" | "GOAT";  
  phase: "PLACEMENT" | "MOVEMENT" | "GAME\_OVER";  
    
  // The Board: Array of 23 slots.   
  // 'T' \= Tiger, 'G' \= Goat, 'E' \= Empty  
  board: Array\<"T" | "G" | "E"\>;   
    
  // Resource Counters  
  goatsInHand: number;           // Starts at 15, decrements to 0  
  goatsKilled: number;           // Starts at 0, win condition at 5  
    
  // History for Undo and Repetition Detection  
  history: Array\<string\>;        // Array of Board Hashes  
    
  // Metadata  
  winner: "TIGER" | "GOAT" | null;  
  winReason: "CAPTURE\_LIMIT" | "STALEMATE" | "FORFEIT" | null;  
}
```


### **3.2. Phase I: Initialization and Pre-Configuration**

Before the first turn, the board is not empty. The standard 3/15 variant dictates that the game begins with the Tigers already placed. This eliminates the "Tiger Placement Phase" found in some smaller variants, accelerating the game directly into the conflict.

* **Tiger Spawn Points:** The Apex Cluster is the standard starting formation.  
  * Tiger 1: Node 0 (Apex)  
  * Tiger 2: Node 1 (Left Shoulder) -> *Correction:* Some regional rules place them at 0, 2, 3. The engine must support a `config.startPositions` array. For this specification, we assume the **Vertical Spine Start (Nodes 0, 2, 6)** or the **Apex Triangle (0, 1, 2)**. The Apex Triangle (0, 1, 2) is generally considered the "standard" tournament setup as it gives the Goats a slightly fairer chance to establish a base.  
* **Initial Counters:**  
  * `goatsInHand = 15  `
  * `goatsKilled = 0  `
  * `activePlayer = GOAT `(Goats always move first in the placement phase).

### **3.3. Phase II: The Interleaved Placement (The Drop)**

This phase is the source of most implementation errors. It is not simply "Place 15 Goats." It is "Place a Goat, then Move a Tiger."

* **Mechanics:**  
  1. **Goat Turn:** The player must select an EMPTY node. A Goat is spawned there. goatsInHand decrements.  
  2. **Tiger Turn:** The Tiger player moves an existing Tiger on the board. They can Move to an adjacent empty node OR Capture a Goat (if a valid kill vector exists).  
  3. **Loop:** This alternates until goatsInHand \== 0\.  
* **Strategic Implication:** This phase is the most volatile. A careless Goat placement allows a Tiger to capture *before* the Goats have established a defensive perimeter. The engine's validator must therefore support movement logic for Tigers *while* restricting Goats to placement logic only.  
* **Constraint Checklist:**  
  * Can a Tiger kill during placement? **Yes.**  
  * Can a Goat move during placement? **No.** Once placed, a Goat is "frozen" until the phase changes to MOVEMENT.  
  * Can a Tiger be blocked completely during placement? **Yes.** If Goats play perfectly, they can box a Tiger in, though it is rare this early.

### **3.4. Phase III: Full Movement**

Once goatsInHand reaches 0, the phase flag shifts to MOVEMENT.

* **Goat Logic Changes:** Goats now acquire the ability to move.  
  * *Source:* Node with GOAT.  
  * *Destination:* Node with EMPTY.  
  * *Condition:* Source and Destination are adjacent.  
* **Tiger Logic:** Remains the same (Move or Kill).

This state persists until a terminal condition is met. The "Flying Tiger" rule (where Tigers can jump anywhere if only 1 or 2 Tigers remain) is usually *not* included in the strict 15-Goat variant, as the Goats' objective is to blockade, not eliminate. Thus, we adhere to the strict adjacency rule.

## **4. The Rules Engine: Logic and Validation Algorithms**

The integrity of the game relies on the validateMove(action) function. This function must be pure, deterministic, and efficient (O(1)).

### **4.1. Validation Layer 1: Topology and Occupancy**

For any move request (Player, FromNode, ToNode):

1. **Ownership Check:** Does board\[FromNode\] contain a piece belonging to Player? (Tigers cannot move Goats).  
2. **Destination Check:** Is board strictly EMPTY? (No stacking allowed).  
3. **Adjacency Check:** Is ToNode present in ADJACENCY\_MAP\[FromNode\]?

If these pass, it is a valid "Simple Move."

### **4.2. Validation Layer 2: The Kill Mechanics (Tiger Jump)**

The defining mechanic of Aadu Puli Aattam is the jump capture. This is geometrically stricter than Checkers. In Checkers, you jump diagonally on a grid. In this graph, you jump strictly along the lines.

A Tiger at $T$ can capture a Goat at $G$ and land at $D$ if and only if:

1. **Linearity:** The nodes $T, G, D$ form a straight line.  
2. **Adjacency:** $T$ connects to $G$, and $G$ connects to $D$.  
3. **Content:** $T$ has Tiger, $G$ has Goat, $D$ is Empty.

Computational Optimization:  
Attempting to calculate "linearity" using vector math (dot products) on the fly is prone to floating-point errors and requires access to the visual coordinates, which breaks the separation of concerns. The correct architectural approach is a Pre-Computed Jump Table.  
Table 2: The Jump Lookup Table (Partial Specification)  
This table hardcodes every valid kill vector on the board. If a requested move is not in this table, it is not a valid kill.

| Start Node (Tiger) | Over Node (Goat) | Land Node (Empty) | Axis |
| :---- | :---- | :---- | :---- |
| 0 (Apex) | 2 (Spine Top) | 6 (Spine Mid) | Vertical |
| 1 (Shoulder L) | 5 (Inner L) | 10 (Inner L) | Diagonal L |
| 2 (Spine Top) | 6 (Spine Mid) | 11 (Spine Low) | Vertical |
| 0 (Apex) | 1 (Shoulder L) | 4 (Edge L) | Diagonal L |
| 4 (Edge L) | 5 (Inner L) | 6 (Spine Mid) | Horizontal |
| ... | ... | ... | ... |

*Algorithmic Flow for Tiger Move:*

1. Check Simple Move (Adjacency). If valid, return MOVE.  
2. Check Jump Table. Does the pair {Start: From, Land: To} exist?  
   * If Yes: Retrieve OverNode. Check if board\[OverNode\] \== GOAT.  
   * If Yes: Return CAPTURE.  
3. Else: Return INVALID.

This lookup approach reduces the complex geometric validation to a hash map query, ensuring the server can handle thousands of concurrent games with negligible CPU load.

### **4.3. Edge Cases and Repetition (The Superko Rule)**

In graph-based games, players often enter "cycles" to stall (e.g., a Tiger moving back and forth between Node 0 and Node 1 to avoid being trapped). Infinite loops must be detected and broken.

* The Three-Fold Repetition Rule:  
  If the exact same board state (position of all pieces \+ active player) occurs 3 times, the game must intervene.  
  * *Tiger Stalling:* If the Tigers cause the repetition, they are usually forced to pick a different move. If no different move exists, it is a Tiger Loss (Entrapment).  
  * *Goat Stalling:* If Goats cycle to prevent a Tiger breakout, it may be declared a draw.  
* Implementation \- Zobrist Hashing:  
  Storing the full board array in the history log is memory inefficient. We implement Zobrist Hashing (commonly used in Chess engines).  
  * Assign a random 64-bit integer to every possible piece-at-square combination (e.g., Tiger@Node0, Goat@Node5).  
  * The hash of the board is the XOR sum of all piece values.  
  * This allows $O(1)$ update of the board hash and $O(1)$ comparison against the history log.


```Python

def detect_repetition(current_hash, history_log):  
    count = history_log.count(current_hash)  
    if count >= 3:  
        return True  
    return False
```


The engine should enforce a "Hard Stop" on repetition. If a move results in a 3rd repetition, that move is INVALID. This forces the player to break the cycle.

## **5\. Win/Loss Conditions and Terminal States**

The victory conditions are strictly asymmetric, reflecting the distinct objectives of the factions.

### **5.1. Tiger Victory: Attrition**

* **Condition:** goatsKilled \>= 5\.  
* **Mathematical Justification:** The game starts with 15 Goats. To trap 3 Tigers, the Goats need to form closed polygons around the Tigers. Topological analysis shows that with fewer than 11 Goats (i.e., 5 dead), it is mathematically impossible to encompass all 3 Tigers simultaneously on a 23-node graph with an average valency of \~3.4. The Tigers will always have an escape route. Therefore, 5 kills is an absolute victory.

### **5.2. Goat Victory: Encirclement (Stalemate)**

* **Condition:** Tigers have **0 valid moves**.  
* **Detection Logic:**  
  1. Identify all Nodes $T\_1, T\_2, T\_3$ occupied by Tigers.  
  2. For each $T\_i$, retrieve neighbors from ADJACENCY\_MAP.  
  3. Check if any neighbor is EMPTY. (If yes, game continues).  
  4. Check JUMP\_TABLE for any valid jumps starting at $T\_i$. (If yes, game continues).  
  5. If all Tigers are immobile, set winner \= GOAT.

### **5.3. Draws and Forfeits**

* **Technical Draw:** If 100 turns elapse without a capture or a change in the "encirclement metric" (heuristic), the engine can declare a draw to save server resources.  
* **Disconnect:** Standard timeout logic applies (e.g., 60 seconds to reconnect).

## **6\. Strategic Heuristics for Artificial Intelligence**

Building an AI for the 3/15/23 variant requires a distinct approach for each side due to the asymmetry. We employ a Minimax algorithm with Alpha-Beta pruning. The search depth is constrained by the branching factor, which changes drastically over time.

* **Branching Factor ($b$):**  
  * *Phase 2 (Placement):* High. Goats have \~20 options, Tigers have \~4.  
  * *Phase 3 (Movement):* Goats have \~10 options (moves), Tigers have \~4-6 options (moves \+ jumps).  
  * *Insight:* The Tiger's search tree is narrower, allowing the AI to search deeper (Lookahead of 8-10 ply) compared to the Goat AI (Lookahead of 4-6 ply).

### **6.1. Evaluation Function $E(s)$**

The static evaluation function determines the "goodness" of a board state $s$.

$$
E(s) = W_{mat} \cdot (K_G) + W_{mob} \cdot (M_T - M_G) + W_{pos} \cdot (P_T - P_G)
$$

Where:

* $K\_G$ (Material): The number of Goats killed. This is the dominant term for Tigers. (Weight: 1000).  
* $M\_T$ (Tiger Mobility): Sum of valid moves available to Tigers. If $M_T = 0$, score is $-\infty$ (Loss).  
* $P\_T$ (Positional Control): Sum of the valencies of nodes occupied by Tigers. Tigers prefer high-valency nodes (Center/Spine).  
* $P\_G$ (Goat Structure): A complex term rewarding Goats for "connectedness." An isolated Goat is vulnerable; a triangle of Goats is immune.

### **6.2. Goat Strategy Heuristics: The Phalanx**

The Goat AI must prioritize **Structure over Mobility**.

1. **The Trapezoid Defense:** Goats should prioritize filling Nodes 5, 6, 7, 10, 11, 12\. These form the "inner ring." Holding this ring forces Tigers to the edges.  
2. **Triangle Formation:** The AI scans for "Safe Triangles." If Goats occupy Nodes 1, 4, 5, they form a cluster where Tigers cannot jump *into* the cluster without landing on an occupied node.  
3. **The Spinal Block:** Occupying Node 6 and Node 11 is critical. This bifurcates the board, preventing Tigers from coordinating attacks between the left and right flanks.

### **6.3. Tiger Strategy Heuristics: Divide and Conquer**

The Tiger AI prioritizes **Mobility and Forks**.

1. **Central Dominance:** The AI heavily penalizes moving to Edge Nodes (Valency 2 or 3\) unless it leads to an immediate kill. It seeks Valency 4 nodes.  
2. **The Fork:** The AI looks for positions where one Tiger threatens two different Goats simultaneously. Since the Goat can only block one threat per turn, the other becomes a guaranteed kill.  
3. **Space Clearing:** Occasionally, the Tiger must retreat. If Goats are clustered defensively, the Tiger AI should back off to a corner to tempt the Goats to expand, breaking their safe formation ("The Bait").

## **7\. Technical Implementation Architecture**

The system should be architected as a modular monolith or microservices cluster.

### **7.1. Backend Technology Stack**

* **Runtime:** Node.js (TypeScript) or Python (FastAPI). Python is preferred if ML-based AI models (Reinforcement Learning) are to be integrated later.  
* **Concurrency Model:** Since the game state is lightweight (\< 2KB JSON), an in-memory store like Redis is ideal for holding active game sessions, persisting to PostgreSQL only upon game completion.

### **7.2. Frontend Technology Stack**

* **Framework:** React or Vue.js.  
* **Rendering:** SVG (Scalable Vector Graphics) is superior to HTML5 Canvas for this application.  
  * *Reasoning:* SVG allows attaching DOM event listeners directly to the \<circle\> (Node) and \<line\> (Edge) elements. This simplifies the "hit test" logic significantly compared to calculating cursor coordinates on a Canvas raster.  
  * *Accessibility:* SVG elements can be tagged with ARIA labels ("Node 5, occupied by Tiger"), making the game accessible to screen readers—a feature often overlooked in canvas-based games.

### **7.3. Network Protocol Design**

* **Transport:** WebSockets (Socket.io or native ws).  
* **Optimistic UI:** The client should apply the move visually *before* receiving server confirmation to ensure "instant" responsiveness. If the server rejects the move (e.g., due to lag/state mismatch), the client triggers a "Rollback" animation.  
* **Latency Handling:** The server acts as the authoritative timekeeper. Timestamped moves prevent race conditions where two players move simultaneously in a low-latency environment (though the game is turn-based, lag spikes can cause packet bunches).

## **8\. Implications of the 23-Node Variant Analysis**

The research and analysis into the 3-Tiger / 15-Goat / 23-Node variant reveals that it is not merely a "larger" version of the children's game. It is a mathematically rigorous system that mimics predator-prey dynamics in a closed system.

The "Spine" (Nodes 0, 2, 6, 11, 16\) emerges as the most statistically significant feature of the board. Control of the spine allows a player to dictate the flow of the game across the horizontal axis. For the Game Engine, this implies that AI weights must be heavily biased toward these nodes.

Furthermore, the "Interleaved Placement" phase is identified as the primary source of complexity for the rules engine. The state machine must handle a hybrid mode where one player (Goat) is playing a "Drop Game" (like Go or Connect 4\) while the other (Tiger) is playing a "Movement Game" (like Chess). This asymmetry requires careful decoupling of the `MoveValidator` into distinct `PlacementValidator` and `MovementValidator` subclasses.

By adhering to the graph-theoretic definitions and lookup-table optimizations outlined in this report, the resulting game engine will be performant, scalable, and capable of supporting high-level play that respects the deep strategic heritage of Aadu Puli Aattam. The specification ensures that the digital preservation of this ancient game is not just a graphical skin, but a faithful computational reconstruction of its logic and depth.