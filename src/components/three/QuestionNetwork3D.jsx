import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

function QuestionConstellation() {
  const groupRef = useRef();

  const centerNode = { label: 'Two Sum Target Traversal', pos: [0, 0, 0] };
  const companyNodes = [
    { company: 'TCS NQT 2025', similarity: '94%', pos: [2.2, 1.4, 0.3], color: '#C7F36B' },
    { company: 'Infosys Online Test 2024', similarity: '91%', pos: [-2.4, 0.8, -0.2], color: '#0F766E' },
    { company: 'Accenture Coding Round 2026', similarity: '88%', pos: [0.6, -1.8, 0.4], color: '#0F766E' },
    { company: 'Cognizant GenC 2025', similarity: '96%', pos: [-1.8, -1.4, -0.3], color: '#C7F36B' },
  ];

  const lineGeometry = useMemo(() => {
    const points = [];
    companyNodes.forEach((node) => {
      points.push(new THREE.Vector3(0, 0, 0));
      points.push(new THREE.Vector3(...node.pos));
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Connecting Laser Lines */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#0F766E" transparent opacity={0.4} />
      </lineSegments>

      {/* Central Question Node */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.38, 32, 32]} />
        <meshStandardMaterial
          color="#062E25"
          emissive="#084C3B"
          emissiveIntensity={0.8}
        />
      </mesh>

      <Html position={[0, 0, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            backgroundColor: 'var(--color-deep-forest)',
            color: 'var(--color-lime)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.75rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(6, 46, 37, 0.25)',
            border: '1.5px solid var(--color-lime)',
            transform: 'translateY(-26px)',
          }}
        >
          ✦ Current Question (Two Sum)
        </div>
      </Html>

      {/* Company Historical Nodes */}
      {companyNodes.map((cn, idx) => (
        <group key={idx} position={cn.pos}>
          <mesh>
            <sphereGeometry args={[0.2, 20, 20]} />
            <meshStandardMaterial
              color={cn.color}
              emissive={cn.color}
              emissiveIntensity={0.7}
            />
          </mesh>

          <Html center distanceFactor={7} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                backgroundColor: 'var(--color-white)',
                color: 'var(--color-deep-forest)',
                padding: '4px 9px',
                borderRadius: '8px',
                fontSize: '0.72rem',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(6, 46, 37, 0.12)',
                border: '1px solid rgba(15, 118, 110, 0.25)',
                transform: 'translateY(-22px)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{cn.company}</span>
              <span style={{ color: 'var(--color-emerald)', fontWeight: 800 }}>({cn.similarity})</span>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

export const QuestionNetwork3D = ({ className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '360px',
        position: 'relative',
        ...style,
      }}
    >
      <ThreeFallback>
        <Canvas
          camera={{ position: [0, 0, 5.5], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[4, 5, 4]} intensity={1.1} />
          <pointLight position={[-3, -2, 2]} intensity={0.7} color="#C7F36B" />

          <Float speed={1.3} rotationIntensity={0.12} floatIntensity={0.25}>
            <QuestionConstellation />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
