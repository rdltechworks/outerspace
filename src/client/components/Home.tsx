import React from 'react';

const Home = ({ onLaunchGame }) => {
  return (
    <div style={{
      color: 'white',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>Chronicles of the Synergistic Sphere</h1>
      <p style={{ fontSize: '1.2rem', maxWidth: '600px', marginBottom: '2rem' }}>
        Explore a vast, procedurally generated galaxy. Uncover ancient secrets, trade with other players, and build your own legacy among the stars.
      </p>
      <button 
        onClick={onLaunchGame}
        style={{
          padding: '15px 30px',
          fontSize: '1.2rem',
          color: 'white',
          background: '#e94560',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          transition: 'transform 0.2s'
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Launch Game
      </button>
      <div style={{ marginTop: '4rem', fontSize: '0.9rem' }}>
        <a href="/terms" style={{ color: '#a0a0a0', margin: '0 15px' }}>Terms of Use</a>
        <a href="/privacy" style={{ color: '#a0a0a0', margin: '0 15px' }}>Privacy Policy</a>
      </div>
    </div>
  );
};

export default Home;