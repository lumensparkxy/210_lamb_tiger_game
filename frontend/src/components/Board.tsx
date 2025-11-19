import React from 'react';
import { GameState } from '../game/types';
import { NODE_COORDINATES, ADJACENCY } from '../game/constants';

interface BoardProps {
    gameState: GameState;
    onNodeClick: (nodeId: number) => void;
    selectedNode: number | null;
}

export const Board: React.FC<BoardProps> = ({ gameState, onNodeClick, selectedNode }) => {
    const renderLines = () => {
        const lines: JSX.Element[] = [];
        const drawn = new Set<string>();

        Object.entries(ADJACENCY).forEach(([startStr, neighbors]) => {
            const start = parseInt(startStr);
            neighbors.forEach(end => {
                const key = [start, end].sort().join('-');
                if (drawn.has(key)) return;
                drawn.add(key);

                const p1 = NODE_COORDINATES[start];
                const p2 = NODE_COORDINATES[end];

                lines.push(
                    <line
                        key={key}
                        x1={p1.x}
                        y1={p1.y}
                        x2={p2.x}
                        y2={p2.y}
                        stroke="#cbd5e1"
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                );
            });
        });
        return lines;
    };

    const renderNodes = () => {
        return Object.entries(NODE_COORDINATES).map(([idStr, pos]) => {
            const id = parseInt(idStr);
            const piece = gameState.board[id];
            const isSelected = selectedNode === id;
            
            let content = null;
            if (piece === "T") {
                content = <text x={pos.x} y={pos.y} dy="6" textAnchor="middle" fontSize="18" style={{ pointerEvents: 'none' }}>🐯</text>;
            } else if (piece === "G") {
                content = <text x={pos.x} y={pos.y} dy="6" textAnchor="middle" fontSize="18" style={{ pointerEvents: 'none' }}>🐐</text>;
            }
            
            return (
                <g key={id} onClick={() => onNodeClick(id)} style={{ cursor: 'pointer' }}>
                    {/* Node Circle */}
                    <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={4}
                        fill={isSelected ? "#fbbf24" : "#fff"}
                        stroke={isSelected ? "#f59e0b" : "#94a3b8"}
                        strokeWidth={isSelected ? 2 : 1}
                        style={{ transition: 'all 0.2s' }}
                    />
                    
                    {/* Piece Icon */}
                    {content}

                    {/* Hit area */}
                    <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={10}
                        fill="transparent"
                    />
                </g>
            );
        });
    };

    return (
        <svg viewBox="-20 -10 140 120" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto', display: 'block' }}>
            {renderLines()}
            {renderNodes()}
        </svg>
    );
};
