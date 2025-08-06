import React from 'react';

const MainMenuUI = ({ onPlay }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '48px', top: '-100px', position: 'relative' }}>Outer Space</h1>
      <button
        onClick={onPlay}
        style={{
          width: '150px',
          height: '40px',
          color: 'white',
          background: 'green',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          fontSize: '1.2rem',
        }}
      >
        Play
      </button>
    </div>
  );
};

export default MainMenuUI;
