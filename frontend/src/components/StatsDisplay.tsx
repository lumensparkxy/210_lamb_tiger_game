import React, { useEffect, useState } from 'react';
import './StatsDisplay.css';

interface Stats {
    total_wins: number;
    total_losses: number;
    total_draws: number;
    tiger_wins: number;
    tiger_losses: number;
    tiger_draws: number;
    goat_wins: number;
    goat_losses: number;
    goat_draws: number;
}

interface StatsDisplayProps {
    playerId: string;
}

const StatsDisplay: React.FC<StatsDisplayProps> = ({ playerId }) => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Use relative URL if served from same origin, or configured API URL
                const response = await fetch(`/api/stats/${playerId}`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        if (playerId) {
            fetchStats();
        }
    }, [playerId]);

    if (loading) return <div className="stats-loading">Loading stats...</div>;
    if (!stats) return null;

    return (
        <div className="stats-container">
            <h3>Your Statistics</h3>
            
            <div className="stats-grid">
                <div className="stat-card win">
                    <div className="stat-value">{stats.total_wins}</div>
                    <div className="stat-label">WINS</div>
                    <div className="stat-sub">
                        <span>🐯 {stats.tiger_wins}</span>
                        <span>🐐 {stats.goat_wins}</span>
                    </div>
                </div>

                <div className="stat-card loss">
                    <div className="stat-value">{stats.total_losses}</div>
                    <div className="stat-label">LOSSES</div>
                    <div className="stat-sub">
                        <span>🐯 {stats.tiger_losses}</span>
                        <span>🐐 {stats.goat_losses}</span>
                    </div>
                </div>

                <div className="stat-card draw">
                    <div className="stat-value">{stats.total_draws}</div>
                    <div className="stat-label">DRAWS</div>
                    <div className="stat-sub">
                        <span>🐯 {stats.tiger_draws}</span>
                        <span>🐐 {stats.goat_draws}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsDisplay;
