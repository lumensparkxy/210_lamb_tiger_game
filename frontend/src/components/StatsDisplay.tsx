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
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                setError(null);
                // Use relative URL if served from same origin, or configured API URL
                const response = await fetch(`/api/stats/${playerId}`);
                if (response.ok) {
                    const data = await response.json();
                    setStats(data);
                } else {
                    setError("Failed to load stats");
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
                setError("Network error");
            } finally {
                setLoading(false);
            }
        };

        if (playerId) {
            fetchStats();
        }
    }, [playerId]);

    if (loading) return <div className="stats-loading">Loading stats...</div>;
    if (error) return <div className="stats-error">{error}</div>;
    
    // Default empty stats if null
    const displayStats = stats || {
        total_wins: 0, total_losses: 0, total_draws: 0,
        tiger_wins: 0, tiger_losses: 0, tiger_draws: 0,
        goat_wins: 0, goat_losses: 0, goat_draws: 0
    };

    return (
        <div className="stats-container">
            <h3>Your Statistics</h3>
            
            <div className="stats-grid">
                <div className="stat-card win">
                    <div className="stat-main">
                        <div className="stat-value">{displayStats.total_wins || 0}</div>
                        <div className="stat-label">WINS</div>
                    </div>
                    <div className="stat-sub">
                        <span>🐯 {displayStats.tiger_wins || 0}</span>
                        <span>🐐 {displayStats.goat_wins || 0}</span>
                    </div>
                </div>

                <div className="stat-card loss">
                    <div className="stat-main">
                        <div className="stat-value">{displayStats.total_losses || 0}</div>
                        <div className="stat-label">LOSSES</div>
                    </div>
                    <div className="stat-sub">
                        <span>🐯 {displayStats.tiger_losses || 0}</span>
                        <span>🐐 {displayStats.goat_losses || 0}</span>
                    </div>
                </div>

                <div className="stat-card draw">
                    <div className="stat-main">
                        <div className="stat-value">{displayStats.total_draws || 0}</div>
                        <div className="stat-label">DRAWS</div>
                    </div>
                    <div className="stat-sub">
                        <span>🐯 {displayStats.tiger_draws || 0}</span>
                        <span>🐐 {displayStats.goat_draws || 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StatsDisplay;
