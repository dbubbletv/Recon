import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Html, OrbitControls, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../store/gameStore';
import { MACHINES_BY_ID } from '../data/machines';
import { BLIND_TYPES_BY_ID } from '../data/blindTypes';
import {
  freeStations,
  freeWorkers,
  jobSpeed,
  orderNeedsFitter,
  stationById,
  workerById,
} from '../game/systems/productionSystem';
import { canFulfilOrder } from '../game/systems/inventorySystem';
import type { GameState, Job, Order, Station } from '../game/types';
import { describeLine } from '../game/describe';

// 3D workshop floor — a live, orbitable visualisation driven by the same game state
// as the rest of the UI. Benches animate their jobs, staff appear at their stations,
// stock racks fill with inventory, and the lighting follows the in-game clock.
// Clicking an idle bench starts the next ready, buildable order there.

const COLS = 4;
const SPACING = 3.2;

function stationGridPos(index: number): [number, number] {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const xOffset = ((Math.min(COLS, 1) - 1) / 2) * SPACING;
  const total = COLS;
  const x = (col - (total - 1) / 2) * SPACING + xOffset;
  const z = row * SPACING;
  return [x, z];
}

/** Warm/cool lighting + sky colour derived from the in-game hour (0..23). */
function lightingFor(hour: number) {
  // Day curve: peak brightness around midday, low at night.
  const t = Math.cos(((hour - 13) / 24) * Math.PI * 2); // 1 at ~13:00, -1 at ~01:00
  const day = (t + 1) / 2; // 0..1
  // Keep a workable floor of light even at night (the shop lights stay on).
  const ambient = 0.5 + day * 0.45;
  const dir = 0.45 + day * 0.7;
  const sky = new THREE.Color().lerpColors(
    new THREE.Color('#0b1120'),
    new THREE.Color('#9ec5ff'),
    day,
  );
  const isNight = day < 0.35;
  return { ambient, dir, sky, isNight, day };
}

export function Floor() {
  const state = useGame((s) => s.state);
  const start = useGame((s) => s.startProduction);
  const [selected, setSelected] = useState<string | null>(null);

  const light = lightingFor(state.hour);

  // Try to start the next ready order on a clicked idle bench.
  const startOnStation = (stationId: string) => {
    const station = stationById(state, stationId);
    if (!station || station.broken) return;
    if (!freeStations(state).some((s) => s.id === stationId)) return;

    const ready = state.orders.filter(
      (o) => o.status === 'accepted' && canFulfilOrder(state, o),
    );
    const workers = freeWorkers(state);
    for (const order of ready) {
      if (orderNeedsFitter(order)) {
        const fitter = workers.find((w) => w.role === 'fitter');
        if (!fitter) continue;
        start(order.id, stationId, fitter.id);
        return;
      }
      const worker = workers.find((w) => w.role === 'cutter' || w.role === 'assembler') ?? null;
      start(order.id, stationId, worker?.id ?? null);
      return;
    }
  };

  return (
    <div className="relative h-[calc(100vh-110px)] overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <Canvas shadows camera={{ position: [7, 6.5, 10.5], fov: 42 }}>
        <color attach="background" args={[light.sky.getStyle()]} />
        <fog attach="fog" args={[light.sky.getStyle(), 24, 50]} />

        <ambientLight intensity={light.ambient} />
        <hemisphereLight args={['#bcd4ff', '#1e293b', 0.5]} />
        <directionalLight
          position={[10, 16, 8]}
          intensity={light.dir}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        {/* Warm interior shop lights, always on. */}
        <pointLight position={[0, 6, 3]} intensity={light.isNight ? 1.3 : 0.5} color="#ffe2b0" distance={36} />
        <pointLight position={[-8, 5, 2]} intensity={0.4} color="#ffe2b0" distance={24} />

        <FloorPlane />
        <Walls />
        <StockRack state={state} />

        {state.stations.map((station, i) => {
          const [x, z] = stationGridPos(i);
          const job = state.jobs.find((j) => j.stationId === station.id) ?? null;
          const order = job ? state.orders.find((o) => o.id === job.orderId) ?? null : null;
          const worker = job ? workerById(state, job.workerId) : undefined;
          return (
            <StationView
              key={station.id}
              station={station}
              job={job}
              order={order}
              workerName={worker?.name}
              speed={job ? jobSpeed(state, job) : 0}
              position={[x, 0, z - 2]}
              selected={selected === station.id}
              onSelect={() => setSelected(selected === station.id ? null : station.id)}
              onStart={() => startOnStation(station.id)}
              hasReadyWork={state.orders.some((o) => o.status === 'accepted')}
            />
          );
        })}

        {/* Idle staff loitering in the break area at the front. */}
        <IdleStaff state={state} />

        <OrbitControls
          target={[0, 0.8, 0]}
          minDistance={5}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.15}
          enablePan
        />
      </Canvas>

      <SceneHud state={state} />
    </div>
  );
}

function FloorPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="#1e293b" />
      {/* subtle grid lines via a second wireframe plane */}
    </mesh>
  );
}

function Walls() {
  return (
    <group>
      <mesh position={[0, 2.5, -7]} receiveShadow>
        <boxGeometry args={[26, 5, 0.3]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-13, 2.5, 2]} receiveShadow>
        <boxGeometry args={[0.3, 5, 18]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
    </group>
  );
}

/** A back-wall rack whose shelves fill to reflect total stock held. */
function StockRack({ state }: { state: GameState }) {
  const totalUnits = useMemo(
    () => Object.values(state.inventory).reduce((s, n) => s + n, 0),
    [state.inventory],
  );
  const rolls = Math.min(18, Math.round(totalUnits / 4));
  return (
    <group position={[-11.6, 0, -2]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.4, 3, 8]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {Array.from({ length: rolls }).map((_, i) => {
        const shelf = Math.floor(i / 6);
        const slot = i % 6;
        return (
          <mesh key={i} position={[0.4, 0.7 + shelf * 0.9, -3 + slot * 1.2]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.28, 0.28, 0.8, 12]} />
            <meshStandardMaterial color={['#38bdf8', '#f59e0b', '#a78bfa'][i % 3]} />
          </mesh>
        );
      })}
      <Html position={[0.6, 3.3, 0]} center distanceFactor={12}>
        <div className="pointer-events-none select-none rounded bg-slate-900/70 px-1.5 text-[10px] font-semibold tracking-wider text-slate-300">
          STOCK
        </div>
      </Html>
    </group>
  );
}

function StationView({
  station,
  job,
  order,
  workerName,
  speed,
  position,
  selected,
  onSelect,
  onStart,
  hasReadyWork,
}: {
  station: Station;
  job: Job | null;
  order: Order | null;
  workerName?: string;
  speed: number;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
  onStart: () => void;
  hasReadyWork: boolean;
}) {
  const machine = MACHINES_BY_ID[station.machineId];
  const running = job?.status === 'running';
  const blocked = job?.status === 'blocked' || station.broken;
  const progress = job && job.totalHours > 0 ? job.hoursDone / job.totalHours : 0;

  const benchColor = blocked ? '#7f1d1d' : running ? '#1d4ed8' : '#475569';
  const idle = !job && !station.broken;

  return (
    <group position={position}>
      {/* Bench */}
      <RoundedBox
        args={[1.8, 0.9, 1.1]}
        radius={0.06}
        position={[0, 0.45, 0]}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => (document.body.style.cursor = 'default')}
      >
        <meshStandardMaterial color={benchColor} />
      </RoundedBox>

      {/* Machine block on the bench, sized by machine tier */}
      <mesh position={[0.55, 1.05, 0]} castShadow>
        <boxGeometry args={[0.5, 0.4 + (machine?.speed ?? 1) * 0.12, 0.7]} />
        <meshStandardMaterial color={machine?.id === 'manual_bench' ? '#64748b' : '#22d3ee'} metalness={0.4} roughness={0.4} />
      </mesh>

      {/* Blind being built — slats fill in with progress */}
      {order && <BlindInProgress order={order} progress={progress} animated={running} />}

      {/* Status indicator light */}
      <mesh position={[-0.8, 1.1, 0.5]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshStandardMaterial
          color={blocked ? '#ef4444' : running ? '#22c55e' : '#94a3b8'}
          emissive={blocked ? '#ef4444' : running ? '#22c55e' : '#000000'}
          emissiveIntensity={running ? 0.8 : 0}
        />
      </mesh>

      {/* Worker figure at the bench when staffed */}
      {running && workerName && <Worker position={[0, 0, 0.85]} working color="#fbbf24" />}

      {/* Floating label / progress / action */}
      <Html position={[0, 1.9, 0]} center distanceFactor={11} occlude={false}>
        <div className="pointer-events-none select-none whitespace-nowrap text-center">
          <div className="rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 ring-1 ring-slate-700">
            {station.name} · {machine?.name.split(' ')[0]}
          </div>
          {running && order && (
            <div className="mt-0.5 rounded bg-blue-900/80 px-1.5 py-0.5 text-[9px] text-blue-100">
              {order.customerName} · {Math.round(progress * 100)}%
            </div>
          )}
          {blocked && (
            <div className="mt-0.5 rounded bg-rose-900/80 px-1.5 py-0.5 text-[9px] text-rose-100">broken</div>
          )}
          {idle && (
            <button
              className="pointer-events-auto mt-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              disabled={!hasReadyWork}
              onClick={(e) => {
                e.stopPropagation();
                onStart();
              }}
              title={hasReadyWork ? 'Start the next ready order here' : 'No accepted orders ready'}
            >
              ▶ start job
            </button>
          )}
        </div>
      </Html>

      {selected && order && (
        <Html position={[0, 2.7, 0]} center distanceFactor={10}>
          <div className="pointer-events-none w-44 rounded-lg bg-slate-900/95 p-2 text-[10px] text-slate-200 ring-1 ring-slate-700">
            {order.lines.slice(0, 3).map((l, i) => (
              <div key={i}>• {describeLine(l)}</div>
            ))}
            {workerName && <div className="mt-1 text-slate-400">👷 {workerName}</div>}
            <div className="text-slate-400">~{Math.max(0, Math.ceil((job!.totalHours - job!.hoursDone) / Math.max(0.1, speed)))}h left</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** A small mounted blind whose slats reveal as the job progresses. */
function BlindInProgress({ order, progress, animated }: { order: Order; progress: number; animated: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const line = order.lines[0];
  const def = line ? BLIND_TYPES_BY_ID[line.blindTypeId] : undefined;
  const slatColor = fabricColour(line?.fabric ?? 'standard', def?.id);
  const slatCount = 10;
  const revealed = Math.round(progress * slatCount);

  useFrame((_, delta) => {
    if (animated && groupRef.current) groupRef.current.rotation.y += delta * 0.15;
  });

  return (
    <group ref={groupRef} position={[-0.3, 1.35, 0]}>
      {/* Headrail */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.9, 0.08, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>
      {Array.from({ length: slatCount }).map((_, i) => (
        <mesh key={i} position={[0, 0.5 - i * 0.1, 0]} castShadow visible={i < revealed}>
          <boxGeometry args={[0.86, 0.07, 0.04]} />
          <meshStandardMaterial color={slatColor} />
        </mesh>
      ))}
    </group>
  );
}

function fabricColour(fabric: string, blindId?: string): string {
  if (blindId === 'wood_venetian') return '#b45309';
  if (blindId === 'roman') return '#7c3aed';
  if (blindId === 'cellular') return '#0ea5e9';
  switch (fabric) {
    case 'luxury':
      return '#f472b6';
    case 'premium':
      return '#34d399';
    default:
      return '#e2e8f0';
  }
}

/** A blocky little person. `working` gives a gentle bob animation. */
function Worker({ position, color, working }: { position: [number, number, number]; color: string; working?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (working && ref.current) {
      ref.current.position.y = Math.abs(Math.sin(s.clock.elapsedTime * 3)) * 0.06;
    }
  });
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.16, 0.4, 4, 8]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
    </group>
  );
}

function IdleStaff({ state }: { state: GameState }) {
  const idle = state.staff.filter((s) => !s.assignedJobId);
  return (
    <group position={[0, 0, 7]}>
      {idle.map((s, i) => {
        const colour = s.role === 'sales' ? '#a78bfa' : s.role === 'fitter' ? '#f59e0b' : '#60a5fa';
        return (
          <group key={s.id} position={[(i - (idle.length - 1) / 2) * 1.1, 0, 0]}>
            <Worker position={[0, 0, 0]} color={colour} />
            <Html position={[0, 1.2, 0]} center distanceFactor={12}>
              <div className="pointer-events-none whitespace-nowrap rounded bg-slate-900/80 px-1 text-[9px] text-slate-300">
                {s.name.split(' ')[0]} · {s.role}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function SceneHud({ state }: { state: GameState }) {
  const running = state.jobs.filter((j) => j.status === 'running').length;
  const accepted = state.orders.filter((o) => o.status === 'accepted').length;
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-200 ring-1 ring-slate-700 backdrop-blur">
      <div className="font-medium">Workshop floor</div>
      <div className="mt-1 text-slate-400">
        {running} building · {accepted} ready · {state.stations.length} bench{state.stations.length > 1 ? 'es' : ''}
      </div>
      <div className="mt-1 text-[10px] text-slate-500">drag to orbit · scroll to zoom · click a bench</div>
    </div>
  );
}
