import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

function ReadinessTorqueRing({ score = 87 }) {
  const ringRef = useRef();
  const innerRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.2;
      ringRef.current.rotation.x = Math.PI / 6 + Math.sin(t * 0.15) * 0.05;
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = -t * 0.15;
    }
  });

  return (
    <group>
      {/* Outer Emerald Torque */}
      <mesh ref={ringRef}>
        <torusGeometry args={[1.5, 0.08, 16, 80]} />
        <meshStandardMaterial
          color="#0F766E"
          emissive="#084C3B"
          emissiveIntensity={0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Inner Lime Ring */}
      <mesh ref={innerRef}>
        <torusGeometry args={[1.2, 0.04, 16, 60]} />
        <meshStandardMaterial
          color="#C7F36B"
          emissive="#C7F36B"
          emissiveIntensity={0.8}
        />
      </mesh>

      {/* Center 87% Metric Display */}
      <Html center distanceFactor={6} style={{ pointerEvents: 'none' }}>
        <div style={{ textAlign: 'center', userSelect: 'none' }}>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: '2.5rem', color: 'var(--color-deep-forest)', lineHeight: 1 }}>
            {score}%
          </div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--color-emerald)', letterSpacing: '0.04em' }}>
            Career Ready
          </div>
        </div>
      </Html>
    </group>
  );
}

export const CareerReadiness3D = ({ score = 87, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '240px',
        position: 'relative',
        ...style,
      }}
    >
      <ThreeFallback>
        <Canvas
          camera={{ position: [0, 0, 4.2], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[3, 4, 3]} intensity={1.1} />
          <pointLight position={[-2, -2, 2]} intensity={0.6} color="#C7F36B" />

          <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.2}>
            <ReadinessTorqueRing score={score} />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
