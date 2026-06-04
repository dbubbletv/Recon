import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  ContactShadows,
  Edges,
  Grid,
  Html,
  OrbitControls,
  RoundedBox,
  SoftShadows,
  Sky,
} from '@react-three/drei';
import * as THREE from 'three';
import { useGame } from '../store/gameStore';
import { MACHINES_BY_ID } from '../data/machines';
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
import {
  BlindModel,
  FinishedGoods,
  IdleStaff,
  lightingFor,
  MachineModel,
  MaterialCart,
  stationGridPos,
  StockShelf,
  Worker,
} from './parts';

// The live 3D workshop floor: a proper building with sky + windows, distinct machines
// per tier, animated cutting + staff, stock & despatch, and camera presets — all driven
// by the same game state as the rest of the UI.

type Preset = 'overview' | 'top' | 'follow';

export function Floor() {
  const state = useGame((s) => s.state);
  const start = useGame((s) => s.startProduction);
  const [selected, setSelected] = useState<string | null>(null);
  const [preset, setPreset] = useState<Preset>('overview');

  const light = lightingFor(state.hour);
  const runningJob = state.jobs.find((j) => j.status === 'running') ?? null;
  const runningStationIndex = runningJob
    ? state.stations.findIndex((s) => s.id === runningJob.stationId)
    : -1;
  const followTarget = runningStationIndex >= 0 ? stationGridPos(runningStationIndex) : null;

  const startOnStation = (stationId: string) => {
    const station = stationById(state, stationId);
    if (!station || station.broken) return;
    if (!freeStations(state).some((s) => s.id === stationId)) return;
    const ready = state.orders.filter((o) => o.status === 'accepted' && canFulfilOrder(state, o));
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
      <Canvas shadows dpr={[1, 1.6]} camera={{ position: [11, 8, 14], fov: 40 }} gl={{ antialias: true }}>
        <SoftShadows size={22} samples={6} focus={0.6} />
        <Sky sunPosition={light.sunPosition} turbidity={light.isNight ? 12 : 6} rayleigh={light.isNight ? 0.4 : 2} />
        <fog attach="fog" args={[light.isNight ? '#0b1120' : '#aec6e4', 30, 70]} />

        <LightRig light={light} />
        <Building />
        <Grid
          position={[0, 0.02, 2]}
          args={[40, 40]}
          cellSize={1}
          cellThickness={0.6}
          cellColor="#1e293b"
          sectionSize={5}
          sectionThickness={1.1}
          sectionColor="#334155"
          fadeDistance={42}
          infiniteGrid
        />
        <ContactShadows position={[0, 0.04, 2]} opacity={0.5} scale={45} blur={2.2} far={6} />

        <StockShelf state={state} />
        <FinishedGoods made={state.stats.blindsMade} />
        <MaterialCart active={!!runningJob} target={followTarget ? [followTarget[0], followTarget[1] - 2] : [0, -2]} />

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
              workerRole={worker?.role}
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

        <IdleStaff state={state} />

        <OrbitControls makeDefault target={[0, 1, 1]} minDistance={5} maxDistance={34} maxPolarAngle={Math.PI / 2.1} enablePan />
        <CameraRig preset={preset} followTarget={followTarget} />
      </Canvas>

      <SceneHud state={state} preset={preset} onPreset={setPreset} hasFollow={!!followTarget} />
    </div>
  );
}

/** Smoothly eases the camera + orbit target toward the chosen preset each frame. */
function CameraRig({ preset, followTarget }: { preset: Preset; followTarget: [number, number] | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null };
  const want = useMemo(() => {
    if (preset === 'top') return { pos: new THREE.Vector3(0.1, 22, 2.5), tgt: new THREE.Vector3(0, 0, 2) };
    if (preset === 'follow' && followTarget) {
      const [x, z] = followTarget;
      return { pos: new THREE.Vector3(x + 3, 3.2, z + 1), tgt: new THREE.Vector3(x, 1.2, z - 2) };
    }
    return { pos: new THREE.Vector3(11, 8, 14), tgt: new THREE.Vector3(0, 1, 1) };
  }, [preset, followTarget]);

  const armed = useRef(0);
  // Re-arm the lerp for a short window whenever the preset changes.
  useMemo(() => {
    armed.current = 1.2;
    return null;
  }, [preset]);

  useFrame((_, delta) => {
    if (armed.current <= 0) return;
    armed.current -= delta;
    camera.position.lerp(want.pos, 0.06);
    if (controls?.target) {
      controls.target.lerp(want.tgt, 0.06);
      controls.update();
    }
  });
  return null;
}

function LightRig({ light }: { light: ReturnType<typeof lightingFor> }) {
  return (
    <group>
      <ambientLight intensity={light.ambient} />
      <hemisphereLight args={['#cfe0ff', '#1f2937', 0.55]} />
      <directionalLight
        position={light.sunPosition}
        intensity={light.dir}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-bias={-0.0004}
      />
      {/* Ceiling fluorescents — brighter at night. */}
      {[-7, 0, 7].map((x) => (
        <pointLight key={x} position={[x, 5.2, 1]} intensity={light.isNight ? 1.2 : 0.55} color="#ffe6b8" distance={22} />
      ))}
    </group>
  );
}

/** The shell: solid floor base, back + side walls with a window strip, steel columns, roof beams + light fixtures. */
function Building() {
  return (
    <group>
      {/* floor base under the grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 2]} receiveShadow>
        <planeGeometry args={[44, 44]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>

      {/* back wall with a window strip */}
      <mesh position={[0, 2, -9]} receiveShadow castShadow>
        <boxGeometry args={[30, 4, 0.3]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <mesh position={[0, 4.4, -9]}>
        <boxGeometry args={[30, 0.9, 0.1]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.28} metalness={0.1} roughness={0.05} />
      </mesh>
      <mesh position={[0, 5, -9]} castShadow>
        <boxGeometry args={[30, 0.4, 0.4]} />
        <meshStandardMaterial color="#334155" />
      </mesh>

      {/* left wall */}
      <mesh position={[-14.8, 2.4, 2]} receiveShadow castShadow>
        <boxGeometry args={[0.3, 4.8, 22]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>

      {/* steel columns */}
      {[-14, -7, 0, 7, 14].map((x) => (
        <mesh key={x} position={[x, 2.6, -8.8]} castShadow>
          <boxGeometry args={[0.3, 5.2, 0.3]} />
          <meshStandardMaterial color="#334155" metalness={0.5} />
        </mesh>
      ))}

      {/* roof beams */}
      {[-6, 0, 6, 12].map((z) => (
        <mesh key={z} position={[0, 5.4, z - 4]} castShadow>
          <boxGeometry args={[30, 0.2, 0.3]} />
          <meshStandardMaterial color="#475569" metalness={0.4} />
        </mesh>
      ))}
      {/* hanging light fixtures */}
      {[-7, 0, 7].map((x) =>
        [-2, 4].map((z) => (
          <group key={`${x}-${z}`} position={[x, 5, z]}>
            <mesh position={[0, 0.2, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
              <meshStandardMaterial color="#334155" />
            </mesh>
            <mesh castShadow>
              <boxGeometry args={[1.4, 0.12, 0.4]} />
              <meshStandardMaterial color="#0f172a" emissive="#fff4d6" emissiveIntensity={0.9} />
            </mesh>
          </group>
        )),
      )}

      {/* roller-shutter door on the right */}
      <mesh position={[14.8, 2, 2]} castShadow>
        <boxGeometry args={[0.25, 4, 6]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[14.65, 0.4 + i * 0.42, 2]} castShadow>
          <boxGeometry args={[0.08, 0.36, 5.6]} />
          <meshStandardMaterial color={i % 2 ? '#475569' : '#3f4f63'} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function StationView({
  station,
  job,
  order,
  workerRole,
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
  workerRole?: 'cutter' | 'assembler' | 'fitter' | 'sales';
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
  const idle = !job && !station.broken;

  const benchTop = blocked ? '#7f1d1d' : running ? '#1e3a8a' : '#334155';

  return (
    <group position={position}>
      {/* bench top + legs */}
      <RoundedBox
        args={[2.1, 0.18, 1.3]}
        radius={0.04}
        position={[0, 0.92, 0]}
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
        <meshStandardMaterial color={benchTop} metalness={0.2} roughness={0.7} />
        <Edges color={running ? '#3b82f6' : '#475569'} />
      </RoundedBox>
      {[-0.9, 0.9].map((x) =>
        [-0.5, 0.5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.45, z]} castShadow>
            <boxGeometry args={[0.1, 0.9, 0.1]} />
            <meshStandardMaterial color="#1e293b" metalness={0.4} />
          </mesh>
        )),
      )}

      <MachineModel machineId={station.machineId} running={running} />

      {order && <BlindModel blindTypeId={order.lines[0].blindTypeId} fabric={order.lines[0].fabric} progress={progress} running={running} />}

      {/* status beacon */}
      <mesh position={[-0.95, 1.15, 0.55]}>
        <sphereGeometry args={[0.08, 12, 12]} />
        <meshStandardMaterial
          color={blocked ? '#ef4444' : running ? '#22c55e' : '#64748b'}
          emissive={blocked ? '#ef4444' : running ? '#22c55e' : '#000'}
          emissiveIntensity={running || blocked ? 0.9 : 0}
        />
      </mesh>

      {/* worker at the bench when staffed + running */}
      {running && workerRole && (
        <group position={[0, 0, 0.95]}>
          <Worker role={workerRole} working />
        </group>
      )}

      {/* floating progress ring as a thin bar above the bench */}
      {running && (
        <group position={[0, 2.15, 0]}>
          <mesh>
            <boxGeometry args={[1.4, 0.08, 0.05]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          <mesh position={[-0.7 + (progress * 1.4) / 2, 0, 0.01]}>
            <boxGeometry args={[Math.max(0.02, progress * 1.4), 0.08, 0.06]} />
            <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.5} />
          </mesh>
        </group>
      )}

      {/* labels + action */}
      <Html position={[0, 2.45, 0]} center distanceFactor={13} occlude={false}>
        <div className="pointer-events-none select-none whitespace-nowrap text-center">
          <div className="rounded bg-slate-900/85 px-1.5 py-0.5 text-[10px] font-medium text-slate-100 ring-1 ring-slate-700">
            {station.name} · {machine?.name.split(' ')[0]}
          </div>
          {running && order && (
            <div className="mt-0.5 rounded bg-blue-900/85 px-1.5 py-0.5 text-[9px] text-blue-100">
              {order.customerName} · {Math.round(progress * 100)}%
            </div>
          )}
          {blocked && <div className="mt-0.5 rounded bg-rose-900/85 px-1.5 py-0.5 text-[9px] text-rose-100">⚠ broken</div>}
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

      {selected && order && job && (
        <Html position={[0, 3.15, 0]} center distanceFactor={12}>
          <div className="pointer-events-none w-48 rounded-lg bg-slate-900/95 p-2 text-[10px] text-slate-200 ring-1 ring-slate-700">
            {order.lines.slice(0, 3).map((l, i) => (
              <div key={i}>• {describeLine(l)}</div>
            ))}
            {workerName && <div className="mt-1 text-slate-400">👷 {workerName}</div>}
            <div className="text-slate-400">
              ~{Math.max(0, Math.ceil((job.totalHours - job.hoursDone) / Math.max(0.1, speed)))}h left
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function SceneHud({
  state,
  preset,
  onPreset,
  hasFollow,
}: {
  state: GameState;
  preset: Preset;
  onPreset: (p: Preset) => void;
  hasFollow: boolean;
}) {
  const running = state.jobs.filter((j) => j.status === 'running').length;
  const accepted = state.orders.filter((o) => o.status === 'accepted').length;
  const hour = Math.floor(state.hour);
  const presets: { id: Preset; label: string; disabled?: boolean }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'top', label: 'Top-down' },
    { id: 'follow', label: 'Follow job', disabled: !hasFollow },
  ];

  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-900/70 px-3 py-2 text-xs text-slate-200 ring-1 ring-slate-700 backdrop-blur">
        <div className="font-medium">Workshop floor · {hour.toString().padStart(2, '0')}:00</div>
        <div className="mt-1 text-slate-400">
          {running} building · {accepted} ready · {state.stations.length} bench{state.stations.length > 1 ? 'es' : ''}
        </div>
        <div className="mt-1 text-[10px] text-slate-500">drag to orbit · scroll to zoom · click a bench</div>
      </div>

      <div className="absolute right-3 top-3 flex overflow-hidden rounded-lg border border-slate-700">
        {presets.map((p) => (
          <button
            key={p.id}
            disabled={p.disabled}
            onClick={() => onPreset(p.id)}
            className={`px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-30 ${
              preset === p.id ? 'bg-brand-600 text-white' : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute bottom-3 left-3 flex gap-3 rounded-lg bg-slate-900/70 px-3 py-1.5 text-[10px] text-slate-300 ring-1 ring-slate-700">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> running</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-500" /> idle</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-rose-500" /> broken</span>
      </div>
    </>
  );
}
