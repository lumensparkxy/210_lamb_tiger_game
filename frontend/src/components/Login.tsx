import React from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import './Login.css';

const Login: React.FC = () => {
  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <button className="close-button">×</button>
        
        <h2>Log in or sign up</h2>
        <p className="subtitle">
          Join the game to play online, track your stats, and compete on the leaderboard.
        </p>
        
        <button onClick={handleGoogleLogin} className="login-btn">
          <img 
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
            alt="Google" 
          />
          <span>Continue with Google</span>
        </button>

        {/* Placeholders for future auth providers */}
        {/* 
        <button className="login-btn" disabled>
          <span style={{ width: 20, textAlign: 'center' }}></span>
          Continue with Apple
        </button>
        <button className="login-btn" disabled>
          <img src="..." alt="Microsoft" />
          Continue with Microsoft
        </button> 
        */}

        <div className="divider">
          <span>OR</span>
        </div>

        <input 
          type="email" 
          placeholder="Email address" 
          className="email-input"
          disabled
        />
        
        <button className="continue-btn" disabled>
          Continue
        </button>

      </div>
    </div>
  );
};

export default Login;
