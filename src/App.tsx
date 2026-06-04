import { useState } from 'react';
import { useGame } from './store/gameStore';
import { useGameLoop } from './hooks/useGameLoop';
import { TopBar } from './components/TopBar';
import { Sidebar, type ScreenId } from './components/Sidebar';
import { Toasts } from './components/Toasts';
import { Button, Card } from './components/ui';
import { gbp } from './game/util';
import { canPersist } from './game/persistence';
import { Dashboard } from './screens/Dashboard';
import { Orders } from './screens/Orders';
import { Workshop } from './screens/Workshop';
import { Inventory } from './screens/Inventory';
import { Showroom } from './screens/Showroom';
import { Staff } from './screens/Staff';
import { Upgrades } from './screens/Upgrades';
import { Reports } from './screens/Reports';

// App shell — top bar + sidebar + the active screen, plus onboarding and game-over.

export default function App() {
  useGameLoop();
  const [screen, setScreen] = useState<ScreenId>('dashboard');
  const [showHelp, setShowHelp] = useState(false);
  const gameOver = useGame((s) => s.state.gameOver);
  const started = useGame((s) => s.state.totalHours > 9 || s.state.speed !== 0);

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar active={screen} onNavigate={setScreen} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4">
          <Screen id={screen} onNavigate={setScreen} />
        </main>
      </div>

      <button
        onClick={() => setShowHelp(true)}
        className="fixed bottom-4 left-4 z-40 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300 shadow hover:bg-slate-700"
      >
        ? How to play
      </button>

      <Toasts />
      {!started && <Onboarding />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {gameOver && <GameOver />}
    </div>
  );
}

function Screen({ id, onNavigate }: { id: ScreenId; onNavigate: (s: ScreenId) => void }) {
  switch (id) {
    case 'dashboard':
      return <Dashboard onNavigate={onNavigate} />;
    case 'orders':
      return <Orders />;
    case 'workshop':
      return <Workshop />;
    case 'inventory':
      return <Inventory />;
    case 'showroom':
      return <Showroom />;
    case 'staff':
      return <Staff />;
    case 'upgrades':
      return <Upgrades />;
    case 'reports':
      return <Reports />;
  }
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg animate-fade-in">{children}</div>
    </div>
  );
}

function Onboarding() {
  const setSpeed = useGame((s) => s.setSpeed);
  return (
    <Modal>
      <Card title="Welcome to Made to Measure" subtitle="Blind manufacturer & shop tycoon">
        <ol className="space-y-2 text-sm text-slate-300">
          <li><b>1.</b> <span className="text-slate-400">Orders</span> — accept a job (each blind has a size, fabric and deadline).</li>
          <li><b>2.</b> <span className="text-slate-400">Workshop</span> — buy any missing stock, then assign a station to start the build.</li>
          <li><b>3.</b> Deliver on time for cash and reputation. Reputation unlocks bigger clients, machines and premises.</li>
          <li><b>4.</b> <span className="text-slate-400">Inventory</span> — batch similar widths to minimise offcut waste, your main margin lever.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          You start with {gbp(2000)} and a roller-blind line. {canPersist ? 'Progress autosaves each day.' : 'Saving is disabled in this sandbox.'}
        </p>
        <div className="mt-4 flex justify-end">
          <Button tone="success" onClick={() => setSpeed(1)}>
            Open up the shop ▶
          </Button>
        </div>
      </Card>
    </Modal>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal>
      <Card title="How to play" right={<button onClick={onClose} className="text-slate-400 hover:text-slate-200">✕</button>}>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• <b>Core loop:</b> take orders → buy materials → produce → QC → deliver → get paid → reinvest.</li>
          <li>• <b>Speed control</b> (top right) runs the clock: pause / 1× / 2× / 3×.</li>
          <li>• <b>Cutting & waste:</b> blinds are cut from fixed-length stock; offcuts are waste. Batching similar widths saves stock — see the Inventory cutting view.</li>
          <li>• <b>Quality:</b> rushing or low-skill staff risks a defect → the customer haggles and reputation dips.</li>
          <li>• <b>Staff:</b> Cutter, Assembler, Fitter (motorised/commercial), Sales (showroom). Wages are daily overhead.</li>
          <li>• <b>Grow:</b> unlock product lines, faster machines, a showroom, a factory and an online store.</li>
          <li>• <b>Don’t go bust:</b> if cash falls far below zero the shutters come down for good.</li>
        </ul>
        <div className="mt-4 flex justify-end">
          <Button tone="primary" onClick={onClose}>Got it</Button>
        </div>
      </Card>
    </Modal>
  );
}

function GameOver() {
  const state = useGame((s) => s.state);
  const newGame = useGame((s) => s.newGame);
  return (
    <Modal>
      <Card title="The shutters come down" subtitle="You ran out of cash">
        <p className="text-sm text-slate-300">
          You delivered {state.stats.ordersDelivered} orders and made {state.stats.blindsMade} blinds before the
          money ran out. Every great manufacturer has a false start or two.
        </p>
        <div className="mt-4 flex justify-end">
          <Button tone="success" onClick={newGame}>
            Start again
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
