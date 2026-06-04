import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Edges, Html, RoundedBox, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { MACHINES_BY_ID } from '../data/machines';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import type { GameState, Staff } from '../game/types';
import { concreteTexture, fabricTexture, metalTexture, woodTexture } from './textures';

// Building blocks for the 3D workshop floor. Everything here is procedural geometry
// (no external textures/fonts/HDRIs) so the scene renders offline and in sandboxes.

export const COLS = 4;
export const SPACING = 3.6;

export function stationGridPos(index: number): [number, number] {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = (col - (COLS - 1) / 2) * SPACING;
  const z = row * SPACING;
  return [x, z];
}

/** Sun direction + light levels + sky tints derived from the in-game hour. */
export function lightingFor(hour: number) {
  const dayAngle = ((hour - 6) / 24) * Math.PI * 2; // sunrise ~6, noon ~12
  const elevation = Math.sin(((hour - 6) / 12) * Math.PI); // -1..1, peak at noon
  const day = THREE.MathUtils.clamp((elevation + 0.3) / 1.1, 0, 1);
  const sunDistance = 60;
  const sunPosition: [number, number, number] = [
    Math.cos(dayAngle) * sunDistance,
    Math.max(2, elevation * sunDistance),
    Math.sin(dayAngle) * sunDistance * 0.6 - 10,
  ];
  const ambient = 0.6 + day * 0.35;
  const dir = 0.6 + day * 1.0;
  const isNight = day < 0.3;
  return { sunPosition, ambient, dir, day, isNight };
}

export function fabricColour(fabric: string, blindId?: string): string {
  if (blindId === 'wood_venetian') return '#b45309';
  if (blindId === 'roman') return '#8b5cf6';
  if (blindId === 'cellular') return '#0ea5e9';
  if (blindId === 'vertical') return '#94a3b8';
  switch (fabric) {
    case 'luxury':
      return '#f472b6';
    case 'premium':
      return '#34d399';
    default:
      return '#e2e8f0';
  }
}

const ROLE_HAT: Record<Staff['role'], string> = {
  cutter: '#3b82f6',
  assembler: '#22c55e',
  fitter: '#f59e0b',
  sales: '#a855f7',
};

/** An articulated little worker: torso, head, hard hat, swinging arms, legs. */
export function Worker({
  role,
  working,
  phase = 0,
}: {
  role: Staff['role'];
  working?: boolean;
  phase?: number;
}) {
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hat = ROLE_HAT[role];

  useFrame((s) => {
    const t = s.clock.elapsedTime + phase;
    if (working) {
      const swing = Math.sin(t * 6) * 0.5;
      if (rightArm.current) rightArm.current.rotation.x = -0.7 + swing;
      if (leftArm.current) leftArm.current.rotation.x = -0.7 - swing;
      if (body.current) body.current.position.y = Math.abs(Math.sin(t * 3)) * 0.03;
    } else {
      const sway = Math.sin(t * 4) * 0.5;
      if (rightArm.current) rightArm.current.rotation.x = sway;
      if (leftArm.current) leftArm.current.rotation.x = -sway;
    }
  });

  return (
    <group ref={body}>
      {/* legs */}
      <mesh position={[-0.08, 0.18, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0.08, 0.18, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.28, 4, 8]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* torso */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.34, 4, 10]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* hi-vis vest band */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <cylinderGeometry args={[0.185, 0.185, 0.12, 12, 1, true]} />
        <meshStandardMaterial color={hat} emissive={hat} emissiveIntensity={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* arms */}
      <group ref={rightArm} position={[0.22, 0.78, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>
      <group ref={leftArm} position={[-0.22, 0.78, 0]}>
        <mesh position={[0, -0.18, 0]} castShadow>
          <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      </group>
      {/* head */}
      <mesh position={[0, 1.0, 0]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      {/* hard hat */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.17, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={hat} />
      </mesh>
      <mesh position={[0, 1.09, 0.12]} castShadow>
        <boxGeometry args={[0.3, 0.03, 0.12]} />
        <meshStandardMaterial color={hat} />
      </mesh>
    </group>
  );
}

/** Idle staff wandering the front break area. */
export function IdleStaff({ state }: { state: GameState }) {
  const idle = state.staff.filter((s) => !s.assignedJobId);
  return (
    <group position={[0, 0, 8.5]}>
      {idle.map((s, i) => (
        <Wanderer key={s.id} index={i} count={idle.length} role={s.role} name={s.name} />
      ))}
    </group>
  );
}

function Wanderer({
  index,
  count,
  role,
  name,
}: {
  index: number;
  count: number;
  role: Staff['role'];
  name: string;
}) {
  const ref = useRef<THREE.Group>(null);
  const baseX = (index - (count - 1) / 2) * 1.6;
  const phase = index * 1.3;
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime + phase;
    const x = baseX + Math.sin(t * 0.4) * 1.1;
    ref.current.position.x = x;
    ref.current.rotation.y = Math.cos(t * 0.4) > 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  return (
    <group ref={ref}>
      <Worker role={role} phase={phase} />
      <Html position={[0, 1.4, 0]} center distanceFactor={14}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-slate-900/70 px-1 text-[9px] text-slate-300">
          {name.split(' ')[0]} · {role}
        </div>
      </Html>
    </group>
  );
}

/** A blind taking shape on the bench, varying by blind family, growing with progress. */
export function BlindModel({
  blindTypeId,
  fabric,
  progress,
  running,
}: {
  blindTypeId: string;
  fabric: string;
  progress: number;
  running: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const def = BLIND_TYPES_BY_ID[blindTypeId];
  const colour = fabricColour(fabric, blindTypeId);
  const tex = useMemo(() => fabricTexture(colour), [colour]);

  useFrame((s) => {
    if (running && group.current) group.current.rotation.z = Math.sin(s.clock.elapsedTime * 2) * 0.03;
  });

  const family =
    blindTypeId === 'vertical'
      ? 'vertical'
      : blindTypeId === 'alu_venetian' || blindTypeId === 'wood_venetian'
        ? 'venetian'
        : 'sheet';

  return (
    <group ref={group} position={[-0.35, 1.55, 0]}>
      {/* headrail */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.0, 0.08, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
      </mesh>

      {family === 'sheet' && (
        <mesh position={[0, 0.58 - (progress * 1.0) / 2, 0]} castShadow>
          <boxGeometry args={[0.94, Math.max(0.02, progress * 1.0), 0.03]} />
          <meshStandardMaterial map={tex} color={colour} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
      )}

      {family === 'venetian' &&
        Array.from({ length: 11 }).map((_, i) => (
          <mesh key={i} position={[0, 0.54 - i * 0.092, 0]} castShadow visible={i / 11 < progress} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.9, 0.06, 0.05]} />
            <meshStandardMaterial color={colour} />
          </mesh>
        ))}

      {family === 'vertical' &&
        Array.from({ length: 9 }).map((_, i) => (
          <mesh key={i} position={[-0.4 + i * 0.1, 0.1, 0]} castShadow visible={i / 9 < progress} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.07, 1.0, 0.02]} />
            <meshStandardMaterial color={colour} />
          </mesh>
        ))}

      {/* bottom bar follows the fabric edge on sheet blinds */}
      {family === 'sheet' && progress > 0.05 && (
        <mesh position={[0, 0.58 - progress * 1.0, 0]} castShadow>
          <boxGeometry args={[0.96, 0.05, 0.06]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.5} />
        </mesh>
      )}

      {def?.tier === 'premium' && (
        <Sparkles count={6} scale={[1, 1, 0.3]} size={2} speed={0.3} color="#fde68a" position={[0, 0.2, 0.1]} />
      )}
    </group>
  );
}

/** A cutting head that slides across the work while a job runs, throwing sparks. */
function CuttingHead({ running }: { running: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (ref.current) {
      const x = running ? Math.sin(s.clock.elapsedTime * 3.5) * 0.6 : 0;
      ref.current.position.x = x;
    }
  });
  return (
    <group ref={ref} position={[0, 1.18, 0.18]}>
      <mesh castShadow>
        <boxGeometry args={[0.16, 0.2, 0.16]} />
        <meshStandardMaterial color="#0ea5e9" metalness={0.6} roughness={0.3} emissive="#0ea5e9" emissiveIntensity={running ? 0.5 : 0} />
      </mesh>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.12, 6]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {running && (
        <Sparkles count={14} scale={[0.4, 0.2, 0.2]} size={4} speed={3} color="#fb923c" position={[0, -0.24, 0]} />
      )}
    </group>
  );
}

/** The machine superstructure on a bench, distinct per tier. */
export function MachineModel({ machineId, running }: { machineId: string; running: boolean }) {
  const gantry = useRef<THREE.Group>(null);
  const metal = useMemo(() => metalTexture(), []);
  const wood = useMemo(() => woodTexture(), []);
  useFrame((s) => {
    if (gantry.current && running) gantry.current.position.x = Math.sin(s.clock.elapsedTime * 2) * 0.55;
  });

  if (machineId === 'manual_bench') {
    return (
      <group>
        {/* tool board behind the bench */}
        <mesh position={[0, 1.55, -0.5]} castShadow>
          <boxGeometry args={[1.6, 0.7, 0.05]} />
          <meshStandardMaterial map={wood} color="#a07a4d" roughness={0.85} />
        </mesh>
        {[-0.5, -0.1, 0.3, 0.6].map((x, i) => (
          <mesh key={i} position={[x, 1.55, -0.46]} castShadow>
            <boxGeometry args={[0.05, 0.3 + (i % 2) * 0.12, 0.04]} />
            <meshStandardMaterial color="#475569" metalness={0.5} />
          </mesh>
        ))}
        {/* bench vice */}
        <mesh position={[0.65, 1.0, 0.2]} castShadow>
          <boxGeometry args={[0.18, 0.16, 0.2]} />
          <meshStandardMaterial color="#334155" metalness={0.6} />
        </mesh>
      </group>
    );
  }

  if (machineId === 'semi_auto_cut') {
    return (
      <group>
        {/* rail */}
        <mesh position={[0, 1.32, 0.18]} castShadow>
          <boxGeometry args={[1.5, 0.06, 0.06]} />
          <meshStandardMaterial map={metal} metalness={0.85} roughness={0.28} envMapIntensity={1.2} />
        </mesh>
        <CuttingHead running={running} />
        {/* control panel */}
        <mesh position={[0.7, 1.2, -0.1]} rotation={[0, -0.3, 0]} castShadow>
          <boxGeometry args={[0.3, 0.22, 0.05]} />
          <meshStandardMaterial color="#0f172a" emissive={running ? '#22c55e' : '#1e293b'} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }

  // auto_cut & precision_cell: enclosed CNC cell with a moving gantry + screen.
  const premium = machineId === 'precision_cell';
  return (
    <group>
      {/* cell housing */}
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[1.7, 1.0, 1.3]} />
        <meshStandardMaterial
          map={metal}
          color={premium ? '#f1f5f9' : '#64748b'}
          metalness={0.7}
          roughness={0.18}
          envMapIntensity={1.4}
          transparent
          opacity={0.34}
        />
        <Edges color={premium ? '#22d3ee' : '#94a3b8'} />
      </mesh>
      {/* interior gantry */}
      <group ref={gantry} position={[0, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.12, 0.7, 1.2]} />
          <meshStandardMaterial color={premium ? '#22d3ee' : '#0ea5e9'} emissive="#0ea5e9" emissiveIntensity={running ? 0.6 : 0.15} />
        </mesh>
      </group>
      {/* status screen */}
      <mesh position={[0.86, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[0.5, 0.32, 0.04]} />
        <meshStandardMaterial color="#0f172a" emissive={running ? '#22c55e' : '#334155'} emissiveIntensity={0.7} />
      </mesh>
    </group>
  );
}

/** Tall shelving stacked with fabric rolls + bar bundles; fills with inventory. */
export function StockShelf({ state }: { state: GameState }) {
  const totalUnits = useMemo(
    () => Object.values(state.inventory).reduce((s, n) => s + n, 0),
    [state.inventory],
  );
  const rolls = Math.min(24, Math.round(totalUnits / 3));
  const rollColours = ['#38bdf8', '#f59e0b', '#a78bfa', '#34d399', '#f472b6'];

  return (
    <group position={[-12.4, 0, 0]}>
      {/* uprights + shelves */}
      {[-4, 0, 4].map((z) => (
        <mesh key={z} position={[0, 1.7, z]} castShadow>
          <boxGeometry args={[0.18, 3.4, 0.18]} />
          <meshStandardMaterial color="#1e293b" metalness={0.4} />
        </mesh>
      ))}
      {[0.7, 1.7, 2.7].map((y) => (
        <mesh key={y} position={[0.3, y, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.06, 8.4]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      ))}
      {/* fabric rolls lying on the shelves */}
      {Array.from({ length: rolls }).map((_, i) => {
        const shelf = Math.floor(i / 8);
        const slot = i % 8;
        return (
          <mesh
            key={i}
            position={[0.3, 0.85 + shelf * 1.0, -3.5 + slot * 1.0]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[0.22, 0.22, 0.9, 16]} />
            <meshStandardMaterial map={fabricTexture(rollColours[i % rollColours.length])} roughness={0.92} />
          </mesh>
        );
      })}
      <Html position={[0.4, 3.7, 0]} center distanceFactor={16}>
        <div className="pointer-events-none rounded bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-slate-300">
          STOCK · {totalUnits} units
        </div>
      </Html>
    </group>
  );
}

/** A pallet of finished blinds that grows with lifetime output. */
export function FinishedGoods({ made }: { made: number }) {
  const boxes = Math.min(30, made);
  return (
    <group position={[12, 0, 4]}>
      {/* pallet */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <boxGeometry args={[2, 0.16, 2]} />
        <meshStandardMaterial color="#7c5c3a" />
      </mesh>
      {Array.from({ length: boxes }).map((_, i) => {
        const layer = Math.floor(i / 4);
        const slot = i % 4;
        const x = (slot % 2) * 0.85 - 0.42;
        const z = Math.floor(slot / 2) * 0.85 - 0.42;
        return (
          <mesh key={i} position={[x, 0.35 + layer * 0.42, z]} castShadow>
            <boxGeometry args={[0.78, 0.38, 0.78]} />
            <meshStandardMaterial color={i % 2 ? '#a8763e' : '#c89b6a'} />
            <Edges color="#5b4324" />
          </mesh>
        );
      })}
      <Html position={[0, 0.9 + (boxes / 4) * 0.42, 0]} center distanceFactor={16}>
        <div className="pointer-events-none rounded bg-slate-900/70 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-emerald-300">
          DESPATCH · {made}
        </div>
      </Html>
    </group>
  );
}

/** A material cart that ferries stock to the nearest running bench while busy. */
export function MaterialCart({ active, target }: { active: boolean; target: [number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!ref.current) return;
    if (!active) {
      ref.current.position.set(-11, 0, 4);
      return;
    }
    // Loop between the stock shelf and the target bench.
    const t = (Math.sin(s.clock.elapsedTime * 0.5) + 1) / 2; // 0..1
    const x = THREE.MathUtils.lerp(-11, target[0], t);
    const z = THREE.MathUtils.lerp(4, target[1], t);
    ref.current.position.set(x, 0, z);
    ref.current.rotation.y = Math.atan2(target[0] - -11, target[1] - 4);
  });
  return (
    <group ref={ref} position={[-11, 0, 4]}>
      <mesh position={[0, 0.22, 0]} castShadow>
        <boxGeometry args={[0.7, 0.3, 1.0]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.3} />
      </mesh>
      {/* roll on the cart */}
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.16, 0.7, 12]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
      {[-0.28, 0.28].map((x) =>
        [-0.4, 0.4].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.08, z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 12]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
        )),
      )}
    </group>
  );
}

/** A lit showroom strip along the back wall with framed sample blinds. */
export function Showroom() {
  const samples = [
    { colour: '#e2e8f0', label: 'Roller' },
    { colour: '#b45309', label: 'Wood Venetian' },
    { colour: '#8b5cf6', label: 'Roman' },
    { colour: '#0ea5e9', label: 'Cellular' },
  ];
  return (
    <group position={[0, 0, -8.6]}>
      {samples.map((s, i) => {
        const x = (i - (samples.length - 1) / 2) * 3.0;
        return (
          <group key={i} position={[x, 2.2, 0]}>
            {/* lit display niche */}
            <mesh position={[0, 0, -0.05]}>
              <boxGeometry args={[1.6, 2.0, 0.1]} />
              <meshStandardMaterial color="#0b1120" emissive="#1e293b" emissiveIntensity={0.5} />
            </mesh>
            {/* frame */}
            <mesh>
              <boxGeometry args={[1.7, 2.1, 0.06]} />
              <meshStandardMaterial color="#334155" metalness={0.5} roughness={0.4} />
              <Edges color="#64748b" />
            </mesh>
            {/* sample blind */}
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[1.3, 1.7, 0.04]} />
              <meshStandardMaterial map={fabricTexture(s.colour)} color={s.colour} roughness={0.9} />
            </mesh>
            {/* niche spotlight */}
            <spotLight position={[0, 1.6, 1.6]} angle={0.5} penumbra={0.6} intensity={6} distance={6} color="#fff4d6" target-position={[x, 1.5, -8]} />
            <Html position={[0, -1.25, 0.1]} center distanceFactor={16}>
              <div className="pointer-events-none whitespace-nowrap rounded bg-slate-900/80 px-1.5 py-0.5 text-[9px] font-medium text-slate-200">
                {s.label}
              </div>
            </Html>
          </group>
        );
      })}
      <Html position={[0, 4.0, 0]} center distanceFactor={20}>
        <div className="pointer-events-none rounded bg-slate-900/70 px-3 py-0.5 text-[11px] font-semibold tracking-[0.3em] text-sky-300">
          SHOWROOM
        </div>
      </Html>
    </group>
  );
}

/** A forklift idling by the despatch bay, gently shuttling a pallet. */
export function Forklift({ active }: { active: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const mast = useRef<THREE.Group>(null);
  const metal = useMemo(() => metalTexture(), []);
  useFrame((s) => {
    if (!ref.current) return;
    const t = s.clock.elapsedTime;
    if (active) {
      ref.current.position.z = 4 + Math.sin(t * 0.4) * 2.2;
      ref.current.rotation.y = Math.cos(t * 0.4) > 0 ? 0 : Math.PI;
    }
    if (mast.current) mast.current.position.y = 0.2 + (Math.sin(t * 0.8) * 0.5 + 0.5) * 0.4;
  });
  return (
    <group ref={ref} position={[9.5, 0, 4]}>
      {/* body */}
      <mesh position={[0, 0.5, -0.2]} castShadow>
        <boxGeometry args={[0.9, 0.7, 1.4]} />
        <meshStandardMaterial map={metal} color="#f59e0b" metalness={0.4} roughness={0.5} />
      </mesh>
      {/* cab cage */}
      <mesh position={[0, 1.25, -0.45]} castShadow>
        <boxGeometry args={[0.7, 0.7, 0.06]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      {/* mast */}
      <mesh position={[0, 0.9, 0.55]} castShadow>
        <boxGeometry args={[0.7, 1.8, 0.1]} />
        <meshStandardMaterial color="#334155" metalness={0.6} />
      </mesh>
      {/* forks + pallet */}
      <group ref={mast} position={[0, 0.2, 0.65]}>
        {[-0.2, 0.2].map((x) => (
          <mesh key={x} position={[x, 0, 0.2]} castShadow>
            <boxGeometry args={[0.08, 0.05, 0.6]} />
            <meshStandardMaterial color="#64748b" metalness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 0.12, 0.3]} castShadow>
          <boxGeometry args={[0.7, 0.18, 0.6]} />
          <meshStandardMaterial color="#7c5c3a" />
        </mesh>
        <mesh position={[0, 0.35, 0.3]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.13, 0.5, 12]} />
          <meshStandardMaterial map={fabricTexture('#38bdf8')} />
        </mesh>
      </group>
      {/* wheels */}
      {[-0.4, 0.4].map((x) =>
        [-0.5, 0.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.18, z - 0.2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.12, 14]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        )),
      )}
    </group>
  );
}

export { RoundedBox, MACHINES_BY_ID, concreteTexture };
