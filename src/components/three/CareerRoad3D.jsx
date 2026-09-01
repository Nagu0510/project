import React, { useRef, useMemo, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ThreeFallback } from './ThreeFallback';

function RoadCurveMesh({ activeStep }) {
  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(-3.2, -2.2, -1.2),
      new THREE.Vector3(-1.8, -1.0, 0.2),
      new THREE.Vector3(-0.4, 0.2, -0.4),
      new THREE.Vector3(1.2, 1.2, 0.4),
      new THREE.Vector3(2.8, 2.4, -0.6),
    ]);
  }, []);

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 70, 0.12, 12, false);
  }, [curve]);

  const checkpoints = useMemo(() => {
    const points = curve.getPoints(10);
    return points.map((p, idx) => ({
      position: [p.x, p.y, p.z],
      step: idx + 1,
      label: [
        'Foundations',
        'Programming',
        'DSA & Traversal',
        'Core Tech',
        'Advanced APIs',
        'Full Stack Projects',
        'System Design',
        'Cloud Deploy',
        'Placement Prep',
        'Career Ready ✦',
      ][idx],
    }));
  }, [curve]);

  const groupRef = useRef();

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.getElapsedTime() * 0.2) * 0.12;
    }
  });

  return (
    <group ref={groupRef}>
      {/* 3D Road Tube */}
      <mesh geometry={tubeGeometry}>
        <meshStandardMaterial
          color="#0F766E"
          emissive="#062E25"
          emissiveIntensity={0.4}
          roughness={0.3}
          metalness={0.6}
        />
      </mesh>

      {/* Checkpoints Spheres & Labels */}
      {checkpoints.map((cp) => {
        const isActive = cp.step <= activeStep;
        const isCurrent = cp.step === activeStep;

        return (
          <group key={cp.step} position={cp.position}>
            {/* 3D Marker Sphere */}
            <mesh>
              <sphereGeometry args={[isCurrent ? 0.22 : 0.15, 20, 20]} />
              <meshStandardMaterial
                color={isActive ? '#C7F36B' : '#FFFFFF'}
                emissive={isActive ? '#C7F36B' : '#084C3B'}
                emissiveIntensity={isCurrent ? 0.9 : isActive ? 0.5 : 0.1}
              />
            </mesh>

            {/* Floating Checkpoint Badge */}
            <Html distanceFactor={8} center style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  backgroundColor: isCurrent ? 'var(--color-deep-forest)' : isActive ? 'var(--color-white)' : 'rgba(255, 255, 255, 0.85)',
                  color: isCurrent ? 'var(--color-lime)' : 'var(--color-deep-forest)',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(6, 46, 37, 0.15)',
                  border: `1px solid ${isCurrent ? 'var(--color-lime)' : 'rgba(15, 118, 110, 0.2)'}`,
                  transform: 'translateY(-24px)',
                }}
              >
                {cp.step.toString().padStart(2, '0')} · {cp.label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

export const CareerRoad3D = ({ activeMilestone = 4, className = '', style = {} }) => {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '380px',
        position: 'relative',
        ...style,
      }}
    >
      <ThreeFallback>
        <Canvas
          camera={{ position: [0, 0, 6.2], fov: 45 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[4, 6, 4]} intensity={1.1} color="#FFFFFF" />
          <pointLight position={[-3, -2, 3]} intensity={0.6} color="#C7F36B" />

          <Float speed={1.2} rotationIntensity={0.1} floatIntensity={0.25}>
            <RoadCurveMesh activeStep={activeMilestone} />
          </Float>
        </Canvas>
      </ThreeFallback>
    </div>
  );
};
