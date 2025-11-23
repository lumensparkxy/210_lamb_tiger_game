import React, { useState } from 'react';
import { User } from 'firebase/auth';
import StatsDisplay from './StatsDisplay';
import './Menu.css';

interface MenuProps {
    user: User | null;
    onLogout: () => void;
    onShare: () => void;
}

const Menu: React.FC<MenuProps> = ({ user, onLogout, onShare }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [showStatsModal, setShowStatsModal] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const openStats = () => {
        setIsOpen(false);
        setShowStatsModal(true);
    };

    return (
        <>
            <button className="menu-toggle" onClick={toggleMenu} aria-label="Open Menu">
                <div className={`hamburger ${isOpen ? 'open' : ''}`}>
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </button>

            <div className={`menu-overlay ${isOpen ? 'open' : ''}`} onClick={toggleMenu}></div>

            <div className={`menu-drawer ${isOpen ? 'open' : ''}`}>
                <div className="menu-header">
                    {user && (
                        <div className="user-profile">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName || "User"} className="user-avatar" />
                            ) : (
                                <div className="user-avatar-placeholder">
                                    {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                                </div>
                            )}
                            <div className="user-info">
                                <span className="user-name">{user.displayName || "Player"}</span>
                                <span className="user-email">{user.email}</span>
                            </div>
                        </div>
                    )}
                    <button className="close-menu" onClick={toggleMenu}>×</button>
                </div>

                <div className="menu-content">
                    {user && (
                        <button 
                            className="menu-btn stats-toggle-btn"
                            onClick={openStats}
                        >
                            📊 My Stats
                        </button>
                    )}

                    <div className="menu-actions">
                        <button onClick={() => { onShare(); toggleMenu(); }} className="menu-btn share-btn">
                            🔗 Share Game
                        </button>
                        
                        <button onClick={onLogout} className="menu-btn logout-btn">
                            🚪 Sign Out
                        </button>
                    </div>
                </div>
                
                <div className="menu-footer">
                    <p>Aadu Puli Aattam v1.0</p>
                </div>
            </div>

            {/* Stats Modal */}
            <div className={`stats-modal-overlay ${showStatsModal ? 'open' : ''}`} onClick={() => setShowStatsModal(false)}>
                <div className="stats-modal-content" onClick={e => e.stopPropagation()}>
                    <button className="stats-modal-close" onClick={() => setShowStatsModal(false)}>×</button>
                    {user && <StatsDisplay playerId={user.uid} />}
                </div>
            </div>
        </>
    );
};

export default Menu;
