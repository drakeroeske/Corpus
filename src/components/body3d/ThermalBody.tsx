// 3D thermal-camera body (lazy-loaded). Procedural mannequin, fresnel rim, heat lerp, pulse, snap views.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Muscle } from '../../engine/types';
import { thermalRgb } from '../../engine/thermal';
import { proceduralBody, type BodyModel, type MeshSpec } from './model';

export type View = 'front' | 'back' | 'side';
const VIEW_ANGLE: Record<View, number> = { front: 0, back: Math.PI, side: Math.PI / 2 };

const vertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGlow;
  uniform float uHi;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec3 n = normalize(vN);
    float ndv = clamp(dot(n, normalize(vV)), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.2);
    float diff = 0.55 + 0.45 * max(dot(n, normalize(vec3(0.3, 0.6, 0.7))), 0.0);
    vec3 c = uColor * diff * (0.55 + uGlow)
           + mix(uColor, vec3(1.0, 0.95, 0.8), 0.35) * fres * (0.5 + uGlow)
           + vec3(1.0) * fres * uHi;
    gl_FragColor = vec4(c, 1.0);
  }
`;

const toColor = (t: number) => {
  const [r, g, b] = thermalRgb(t);
  return new THREE.Color(r / 255, g / 255, b / 255);
};

const sphere = new THREE.SphereGeometry(1, 24, 16);

function Part({ spec, heat, selected, onSelect, still }: { spec: MeshSpec; heat: number; selected: boolean; onSelect?: () => void; still?: boolean }) {
  const mat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms: { uColor: { value: toColor(heat) }, uGlow: { value: 0.15 }, uHi: { value: 0 } } }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const geo = useMemo(() => (spec.shape === 'capsule' ? new THREE.CapsuleGeometry(spec.scale[0], spec.scale[1], 6, 16) : sphere), [spec]);
  const target = useMemo(() => toColor(heat), [heat]);
  const glow = useRef(0.15);
  useEffect(() => () => { mat.dispose(); if (geo !== sphere) geo.dispose(); }, [mat, geo]);

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-dt / 0.2); // ~95 % of the way in 600 ms
    (mat.uniforms.uColor.value as THREE.Color).lerp(target, k);
    const want = 0.12 + heat * 0.85 + (heat > 0.6 && !still ? 0.22 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2)) : 0);
    glow.current += (want - glow.current) * k;
    mat.uniforms.uGlow.value = glow.current;
    mat.uniforms.uHi.value += ((selected ? 0.9 : 0) - mat.uniforms.uHi.value) * k;
  });

  const scale: [number, number, number] = spec.shape === 'capsule' ? [1, 1, spec.scale[2]] : spec.scale;
  return (
    <mesh
      name={spec.name}
      geometry={geo}
      material={mat}
      position={spec.position}
      rotation={spec.rotation ?? [0, 0, 0]}
      scale={scale}
      onClick={
        onSelect
          ? (e: ThreeEvent<MouseEvent>) => {
              e.stopPropagation();
              if (e.delta <= 6) onSelect();
            }
          : undefined
      }
    />
  );
}

function Snap({ controls, view, onDone }: { controls: React.RefObject<OrbitControlsImpl>; view: View | null; onDone: () => void }) {
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c || view === null) return;
    const cur = c.getAzimuthalAngle();
    let d = VIEW_ANGLE[view] - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    if (Math.abs(d) < 0.005) {
      c.setAzimuthalAngle(VIEW_ANGLE[view]);
      onDone();
    } else c.setAzimuthalAngle(cur + d * Math.min(1, dt * 7));
    c.update();
  });
  return null;
}

export interface ThermalBodyProps {
  heat: Record<Muscle, number>; // 0–1
  selected: Muscle | null;
  onSelect: (m: Muscle | null) => void;
  model?: BodyModel;
  reducedMotion?: boolean;
}

export default function ThermalBody({ heat, selected, onSelect, model = proceduralBody, reducedMotion }: ThermalBodyProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const [idle, setIdle] = useState(!reducedMotion);
  const [snap, setSnap] = useState<View | null>(null);

  return (
    <div className="relative">
      <div className="h-[420px] w-full overflow-hidden" style={{ background: '#05070D' }}>
        <Canvas
          dpr={[1, 2]}
          camera={{ position: [0, 1.05, 2.7], fov: 38, near: 0.1, far: 30 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          onPointerMissed={() => onSelect(null)}
        >
          <color attach="background" args={['#05070D']} />
          <gridHelper args={[6, 24, '#1B2340', '#10162A']} position={[0, 0, 0]} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
            <circleGeometry args={[0.7, 48]} />
            <meshBasicMaterial color="#2A1438" transparent opacity={0.35} />
          </mesh>
          <group>
            {model.meshes.map((m) => (
              <Part
                key={m.name}
                spec={m}
                heat={m.muscle ? heat[m.muscle] ?? 0 : 0.04}
                selected={!!m.muscle && m.muscle === selected}
                onSelect={m.muscle ? () => onSelect(m.muscle) : undefined}
                still={reducedMotion}
              />
            ))}
          </group>
          <OrbitControls
            ref={controls}
            target={[0, 0.95, 0]}
            enablePan={false}
            enableDamping
            minDistance={1.4}
            maxDistance={4}
            minPolarAngle={Math.PI / 2 - 0.35}
            maxPolarAngle={Math.PI / 2 + 0.15}
            autoRotate={idle && snap === null}
            autoRotateSpeed={0.6}
            onStart={() => { setIdle(false); setSnap(null); }}
          />
          <Snap controls={controls} view={snap} onDone={() => setSnap(null)} />
        </Canvas>
      </div>
      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {(['front', 'back', 'side'] as View[]).map((v) => (
          <button
            key={v}
            className="min-h-11 border-2 border-ink bg-page px-4 text-sm capitalize"
            onClick={() => { setIdle(false); setSnap(v); }}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
