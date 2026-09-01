import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

function DocumentCardMesh() {
  const cardRef = useRef();
  const laserRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (cardRef.current) {
      cardRef.current.rotation.y = Math.sin(t * 0.3) * 0.08;
      cardRef.current.rotation.x = Math.cos(t * 0.25) * 0.05;
    }
    if (laserRef.current) {
      // Laser scan moves up and down smoothly
      laserRef.current.position.y = Math.sin(t * 1.5) * 1.3;
    }
  });

  return (
    <group ref={cardRef}>
      {/* 3D Paper Document Card */}
      <mesh>
        <boxGeometry args={[2.2, 3.1, 0.06]} />
        <meshStandardMaterial
          color="#FFFFFF"
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>

      {/* Emerald Laser Scan Line */}
      <mesh ref={laserRef} position={[0, 0, 0.05]}>
        <boxGeometry args={[2.3, 0.04, 0.02]} />
        <meshStandardMaterial
          color="#10B981"
          emissive="#10B981"
          emissiveIntensity={1.2}
        />
      </mesh>

      {/* Floating Verified Skill Tags */}
      <Html position={[1.4, 0.8, 0.2]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #10B981', color: '#065F46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
          ✓ Python & FastAPI
        </div>
      </Html>

      <Html position={[-1.4, 0.2, 0.2]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div style={{ backgroundColor: '#ECFDF5', border: '1px solid #10B981', color: '#065F46', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
          ✓ SQL & Indexing
        </div>
      </Html>

      <Html position={[1.5, -0.6, 0.2]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div style={{ backgroundColor: '#FFFBEB', border: '1px solid #F59E0B', color: '#92400E', padding: '3px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' }}>
          ! Gap: System Design
        </div>
      </Html>
    </group>
  );
}

export const ResumeScan3D = ({ className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '340px',
        position: 'relative',
        ...style,
      }}
    >
      <ThreeFallback>
        <Canvas
          camera={{ position: [0, 0, 4.8], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 5, 3]} intensity={1.2} />
          <pointLight position={[-2, 2, 2]} intensity={0.7} color="#10B981" />

          <Float speed={1.3} rotationIntensity={0.1} floatIntensity={0.25}>
            <DocumentCardMesh />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
