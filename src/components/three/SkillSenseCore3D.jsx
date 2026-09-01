import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

// Central Core Sphere & Glowing Rings
function CoreMesh({ pointer }) {
  const coreRef = useRef();
  const ring1Ref = useRef();
  const ring2Ref = useRef();
  const ring3Ref = useRef();

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.25;
      coreRef.current.rotation.x = Math.sin(t * 0.2) * 0.1;
      // Gentle pointer response
      coreRef.current.position.x = THREE.MathUtils.lerp(coreRef.current.position.x, (pointer.current.x || 0) * 0.4, 0.05);
      coreRef.current.position.y = THREE.MathUtils.lerp(coreRef.current.position.y, (pointer.current.y || 0) * 0.4, 0.05);
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = t * 0.15;
      ring1Ref.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.1) * 0.05;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -t * 0.12;
      ring2Ref.current.rotation.y = Math.PI / 4 + Math.cos(t * 0.1) * 0.05;
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.z = t * 0.08;
    }
  });

  return (
    <group>
      {/* Central Emerald Sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[1.35, 48, 48]} />
        <meshStandardMaterial
          color="#062E25"
          emissive="#084C3B"
          emissiveIntensity={0.65}
          roughness={0.25}
          metalness={0.7}
          wireframe={false}
        />
        {/* Inner Glowing Core */}
        <mesh scale={0.88}>
          <sphereGeometry args={[1.35, 32, 32]} />
          <meshBasicMaterial color="#0F766E" wireframe opacity={0.35} transparent />
        </mesh>
      </mesh>

      {/* Orbit Ring 1 (Inner Emerald) */}
      <mesh ref={ring1Ref}>
        <torusGeometry args={[2.5, 0.02, 16, 100]} />
        <meshStandardMaterial color="#0F766E" emissive="#0F766E" emissiveIntensity={0.5} />
      </mesh>

      {/* Orbit Ring 2 (Middle Lime Accent) */}
      <mesh ref={ring2Ref}>
        <torusGeometry args={[3.2, 0.022, 16, 100]} />
        <meshStandardMaterial color="#C7F36B" emissive="#C7F36B" emissiveIntensity={0.7} />
      </mesh>

      {/* Orbit Ring 3 (Outer Subtle Ring) */}
      <mesh ref={ring3Ref}>
        <torusGeometry args={[3.9, 0.015, 16, 100]} />
        <meshStandardMaterial color="#084C3B" opacity={0.4} transparent />
      </mesh>
    </group>
  );
}

// Floating 3D Skill Badge Node
function SkillBadge3D({ label, radius, speed, offset, height, isPrimary }) {
  const nodeRef = useRef();

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * speed + offset;
    const x = Math.cos(t) * radius;
    const z = Math.sin(t) * radius;
    const y = Math.sin(t * 1.5) * 0.45 + height;

    if (nodeRef.current) {
      nodeRef.current.position.set(x, y, z);
    }
  });

  return (
    <group ref={nodeRef}>
      {/* 3D Orb Marker */}
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={isPrimary ? '#C7F36B' : '#0F766E'}
          emissive={isPrimary ? '#C7F36B' : '#0F766E'}
          emissiveIntensity={0.6}
        />
      </mesh>

      {/* HTML Label Badge with SkillSense Theme */}
      <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            backgroundColor: isPrimary ? 'var(--color-lime)' : 'var(--color-white)',
            color: 'var(--color-deep-forest)',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '0.78rem',
            fontWeight: 800,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(6, 46, 37, 0.12)',
            border: `1.5px solid ${isPrimary ? 'var(--color-deep-forest)' : 'rgba(15, 118, 110, 0.25)'}`,
            userSelect: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '0.65rem', color: isPrimary ? 'var(--color-deep-forest)' : 'var(--color-emerald)' }}>✦</span>
          <span>{label}</span>
        </div>
      </Html>
    </group>
  );
}

// Background Particle Dust
function ParticleField() {
  const count = 45;
  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 10;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    return pos;
  }, []);

  const pointsRef = useRef();
  useFrame((state) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = state.clock.getElapsedTime() * 0.03;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.06} color="#C7F36B" transparent opacity={0.45} />
    </points>
  );
}

export const SkillSenseCore3D = ({ className = '', style = {} }) => {
  const pointer = useRef({ x: 0, y: 0 });

  const handlePointerMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.current = { x, y };
  };

  const skills = [
    { label: 'Python', radius: 2.7, speed: 0.35, offset: 0, height: 0.3, isPrimary: true },
    { label: 'Java', radius: 3.1, speed: -0.3, offset: 1.2, height: -0.4, isPrimary: false },
    { label: 'React', radius: 2.8, speed: 0.4, offset: 2.4, height: 0.6, isPrimary: true },
    { label: 'DSA', radius: 3.4, speed: -0.28, offset: 3.6, height: 0.2, isPrimary: true },
    { label: 'AI', radius: 2.9, speed: 0.32, offset: 4.8, height: -0.5, isPrimary: true },
    { label: 'SQL', radius: 3.3, speed: -0.34, offset: 0.7, height: 0.7, isPrimary: false },
    { label: 'MongoDB', radius: 3.0, speed: 0.26, offset: 1.9, height: -0.2, isPrimary: false },
    { label: 'FastAPI', radius: 3.5, speed: -0.31, offset: 3.1, height: -0.7, isPrimary: false },
    { label: 'Cloud', radius: 3.2, speed: 0.38, offset: 4.3, height: 0.5, isPrimary: false },
  ];

  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100%',
        minHeight: '440px',
        position: 'relative',
        ...style,
      }}
      onPointerMove={handlePointerMove}
    >
      <ThreeFallback>
        <Canvas
          camera={{ position: [0, 0, 7.2], fov: 48 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          style={{ pointerEvents: 'auto' }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.2} color="#FFFFFF" />
          <pointLight position={[-4, -3, 3]} intensity={0.8} color="#C7F36B" />

          <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.4}>
            <CoreMesh pointer={pointer} />
            {skills.map((s, idx) => (
              <SkillBadge3D key={idx} {...s} />
            ))}
            <ParticleField />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
