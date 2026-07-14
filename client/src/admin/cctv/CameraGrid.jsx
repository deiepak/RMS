import React from 'react';
import CameraPlayer from './CameraPlayer';

export default function CameraGrid({ cameras, layout, onEnlarge }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
      gap: '20px',
      width: '100%'
    }}>
      {cameras.map((camera) => (
        <CameraPlayer
          key={camera.id}
          camera={camera}
          onEnlarge={onEnlarge}
          isEnlarged={layout === 1}
        />
      ))}
    </div>
  );
}
