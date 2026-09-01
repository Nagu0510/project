import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

function SkillNetworkNodes() {
  const groupRef = useRef();

  const currentSkills = [
    { name: 'Java', score: '82%', pos: [-1.8, 1.2, 0.4], color: '#0F766E', isGap: false },
    { name: 'Python', score: '76%', pos: [-0.6, 2.0, -0.2], color: '#0F766E', isGap: false },
    { name: 'DSA', score: '62%', pos: [1.6, 1.4, 0.3], color: '#0F766E', isGap: false },
    { name: 'SQL', score: '78%', pos: [-1.4, -0.8, 0.5], color: '#0F766E', isGap: false },
    { name: 'React', score: '71%', pos: [0.8, -0.6, -0.4], color: '#0F766E', isGap: false },
    // Missing Gaps
    { name: 'System Design', score: 'Gap', pos: [2.2, -1.2, 0.2], color: '#C7F36B', isGap: true },
    { name: 'Docker & AWS', score: 'Gap', pos: [-0.2, -1.8, 0.4], color: '#C7F36B', isGap: true },
  ];

  const lineGeometry = useMemo(() => {
    const points = [];
    // Connect nodes in a web
    points.push(new THREE.Vector3(...currentSkills[0].pos), new THREE.Vector3(...currentSkills[1].pos));
    points.push(new THREE.Vector3(...currentSkills[1].pos), new THREE.Vector3(...currentSkills[2].pos));
    points.push(new THREE.Vector3(...currentSkills[0].pos), new THREE.Vector3(...currentSkills[3].pos));
    points.push(new THREE.Vector3(...currentSkills[3].pos), new THREE.Vector3(...currentSkills[4].pos));
    points.push(new THREE.Vector3(...currentSkills[2].pos), new THREE.Vector3(...currentSkills[4].pos));
    points.push(new THREE.Vector3(...currentSkills[4].pos), new THREE.Vector3(...currentSkills[5].pos));
    points.push(new THREE.Vector3(...currentSkills[3].pos), new THREE.Vector3(...currentSkills[6].pos));
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.15) * 0.18;
      groupRef.current.rotation.x = Math.cos(state.clock.getElapsedTime() * 0.12) * 0.1;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Connecting Vector Lines */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#0F766E" transparent opacity={0.35} />
      </lineSegments>

      {/* Skill Nodes */}
      {currentSkills.map((s, idx) => (
        <group key={idx} position={s.pos}>
          <mesh>
            <sphereGeometry args={[s.isGap ? 0.22 : 0.28, 24, 24]} />
            <meshStandardMaterial
              color={s.isGap ? '#C7F36B' : '#0F766E'}
              emissive={s.isGap ? '#C7F36B' : '#084C3B'}
              emissiveIntensity={0.6}
            />
          </mesh>

          <Html center distanceFactor={8} style={{ pointerEvents: 'none' }}>
            <div
              style={{
                backgroundColor: s.isGap ? 'var(--color-lime-soft)' : 'var(--color-white)',
                color: 'var(--color-deep-forest)',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: 800,
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(6, 46, 37, 0.12)',
                border: `1px solid ${s.isGap ? 'rgba(245, 158, 11, 0.4)' : 'rgba(15, 118, 110, 0.2)'}`,
                transform: 'translateY(-20px)',
              }}
            >
              {s.name} · <strong style={{ color: s.isGap ? '#92400E' : 'var(--color-emerald)' }}>{s.score}</strong>
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

export const SkillNetwork3D = ({ className = '', style = {} }) => {
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
          camera={{ position: [0, 0, 5.8], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[3, 5, 3]} intensity={1.1} />
          <pointLight position={[-2, -2, 2]} intensity={0.7} color="#C7F36B" />

          <Float speed={1.4} rotationIntensity={0.15} floatIntensity={0.3}>
            <SkillNetworkNodes />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
