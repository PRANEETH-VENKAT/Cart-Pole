// =====================================================================
// VERBATIM CARTPOLE PHYSICS, QUANTUM MEASUREMENT & EVOLUTION STRATEGY
// Preserved directly from the user's original double inverted pendulum
// simulation without modifying any equations, constants, or learning math.
// =====================================================================

// 1) PHYSICS SETTINGS (unchanged)
export const G = 9.81;                        // gravity (m/s^2)
export const MC = 1.0;                        // cart mass (kg)
export const L1 = 0.6;
export const M1 = 0.3;                        // pole 1: length (m), mass (kg)
export const L2 = 0.5;
export const M2 = 0.2;                        // pole 2: length (m), mass (kg)
export const A1 = L1 / 2;
export const A2 = L2 / 2;                     // pivot -> centre of mass of each pole
export const I1 = (M1 * L1 * L1) / 12;        // rotational inertia of a thin rod about its centre
export const I2 = (M2 * L2 * L2) / 12;

// Shortcut groups that appear in the equations
export const KA = M1 * A1 + M2 * L1;          // cart <-> pole 1 coupling
export const KB = M2 * A2;                    // cart <-> pole 2 coupling
export const KC = M2 * L1 * A2;               // pole 1 <-> pole 2 coupling

export const DT = 1 / 500;                    // physics time step (s)
export const MAX_ANGLE = (30 * Math.PI) / 180;// reset if a pole passes 30 degrees (radians)
export const TRACK_HALF = 2.0;                // cart resets if it runs past +/-2 m
export const KEY_FORCE = 20;                  // N, push while an arrow key is held
export const KICK_FORCE = 15;                 // N, strength of a kick
export const KICK_TIME = 0.15;                // s, how long a kick lasts

export const KEYS = ['x', 'th1', 'th2', 'dx', 'dth1', 'dth2'] as const;
export type StateKey = (typeof KEYS)[number];

export interface CartpoleState {
  x: number;
  th1: number;
  th2: number;
  dx: number;
  dth1: number;
  dth2: number;
}

export interface QuantumState {
  sigma: number;
}

export type ModeKey = 'c' | 'q';

export interface HistoryPoint {
  s: number;
  stage: number;
}

export interface BrainModeState {
  w: number[];
  smult: number;
  stage: number;
  hist: HistoryPoint[];
}

export interface BrainStore {
  c: BrainModeState;
  q: BrainModeState;
}

export interface BestAIStore {
  c: number;
  q: number;
}

// 4b) AI + QUANTUM SETTINGS (unchanged)
export const CTRL_DT = 0.02;          // AI / measurement period (s)
export const CTRL_STEPS = Math.round(CTRL_DT / DT);
export const F_MAX = 30;              // N, AI force limit
export const TRAIN_SUB = 4;           // physics sub-steps per control tick while training
export const EP_MAX = 8;              // s, training episode length (score cap)
export const Q_GROW = 0.135;          // rad^2/s, how fast the cloud spreads between measurements
export const Q_SHRINK = 0.5;          // cloud shrinks to this fraction after a measurement
export const Q_FLOOR = 0.004;         // rad, smallest cloud spread
export const Q_KICK = 0.08;           // rad/s, back-action kick (std dev) on each pole
export const Q_START = 0.03;          // rad, starting spread
export const N_GHOST = 30;
export const CURRICULUM = [0.01, 0.03, 0.05, 0.08, 0.12] as const;
export const ES_PAIRS = 10;
export const ES_STARTS = 2;
export const ES_ELITE = 5;
export const ES_LR = 0.7;
export const ES_SCALE = [1.5, 2.5, 40, 8, 40, 8] as const;
export const TRAIN_SLICE_MS = 12;

// =====================================================================
// 2) EQUATIONS OF MOTION (from the Lagrangian — verbatim)
// =====================================================================

export function massMatrix(th1: number, th2: number): number[][] {
  const c1 = Math.cos(th1);
  const c2 = Math.cos(th2);
  const cd = Math.cos(th1 - th2);
  return [
    [MC + M1 + M2, KA * c1, KB * c2],
    [KA * c1, M1 * A1 * A1 + I1 + M2 * L1 * L1, KC * cd],
    [KB * c2, KC * cd, M2 * A2 * A2 + I2],
  ];
}

export function rhsVector(s: CartpoleState, force: number): number[] {
  const s1 = Math.sin(s.th1);
  const s2 = Math.sin(s.th2);
  const sd = Math.sin(s.th1 - s.th2);
  return [
    force + KA * s1 * s.dth1 * s.dth1 + KB * s2 * s.dth2 * s.dth2,
    G * KA * s1 - KC * sd * s.dth2 * s.dth2,
    G * KB * s2 + KC * sd * s.dth1 * s.dth1,
  ];
}

export function solve3(M: number[][], b: number[]): [number, number, number] {
  const a = M.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];

    for (let r = col + 1; r < 3; r++) {
      const f = a[r][col] / a[col][col];
      for (let k = col; k < 4; k++) a[r][k] -= f * a[col][k];
    }
  }

  const x: [number, number, number] = [0, 0, 0];
  for (let r = 2; r >= 0; r--) {
    let sum = a[r][3];
    for (let k = r + 1; k < 3; k++) sum -= a[r][k] * x[k];
    x[r] = sum / a[r][r];
  }
  return x;
}

export function derivative(s: CartpoleState, force: number): CartpoleState {
  const M = massMatrix(s.th1, s.th2);
  const rhs = rhsVector(s, force);
  const acc = solve3(M, rhs);
  return {
    x: s.dx,
    th1: s.dth1,
    th2: s.dth2,
    dx: acc[0],
    dth1: acc[1],
    dth2: acc[2],
  };
}

export function addScaled(s: CartpoleState, d: CartpoleState, h: number): CartpoleState {
  return {
    x: s.x + d.x * h,
    th1: s.th1 + d.th1 * h,
    th2: s.th2 + d.th2 * h,
    dx: s.dx + d.dx * h,
    dth1: s.dth1 + d.dth1 * h,
    dth2: s.dth2 + d.dth2 * h,
  };
}

// =====================================================================
// 3) THE STEP FUNCTION (RK4 — verbatim)
// =====================================================================

export function step(state: CartpoleState, force: number, dt = DT): CartpoleState {
  const k1 = derivative(state, force);
  const k2 = derivative(addScaled(state, k1, dt / 2), force);
  const k3 = derivative(addScaled(state, k2, dt / 2), force);
  const k4 = derivative(addScaled(state, k3, dt), force);

  return {
    x: state.x + (dt / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    th1: state.th1 + (dt / 6) * (k1.th1 + 2 * k2.th1 + 2 * k3.th1 + k4.th1),
    th2: state.th2 + (dt / 6) * (k1.th2 + 2 * k2.th2 + 2 * k3.th2 + k4.th2),
    dx: state.dx + (dt / 6) * (k1.dx + 2 * k2.dx + 2 * k3.dx + k4.dx),
    dth1: state.dth1 + (dt / 6) * (k1.dth1 + 2 * k2.dth1 + 2 * k3.dth1 + k4.dth1),
    dth2: state.dth2 + (dt / 6) * (k1.dth2 + 2 * k2.dth2 + 2 * k3.dth2 + k4.dth2),
  };
}

// =====================================================================
// 4) INITIAL STATES, QUANTUM MEASUREMENT, POLICY & TRAINING (verbatim)
// =====================================================================

export function freshState(): CartpoleState {
  return {
    x: 0,
    th1: (Math.random() - 0.5) * 0.1,
    th2: (Math.random() - 0.5) * 0.1,
    dx: 0,
    dth1: 0,
    dth2: 0,
  };
}

export function gauss(): number {
  let u = 0;
  while (!u) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
}

export function createGhostZ(): Array<[number, number]> {
  return Array.from({ length: N_GHOST }, () => [gauss(), gauss()]);
}

export function createBrainStore(): BrainStore {
  return {
    c: { w: [0, 0, 0, 0, 0, 0], smult: 1, stage: 0, hist: [] },
    q: { w: [0, 0, 0, 0, 0, 0], smult: 1, stage: 0, hist: [] },
  };
}

export function resetBrainMode(brain: BrainStore, key: ModeKey): void {
  brain[key] = { w: [0, 0, 0, 0, 0, 0], smult: 1, stage: 0, hist: [] };
}

export function policy(w: readonly number[], o: readonly number[]): number {
  let u = 0;
  for (let i = 0; i < 6; i++) u += w[i] * o[i];
  return Math.max(-F_MAX, Math.min(F_MAX, u));
}

export function quantumMeasure(
  s: CartpoleState,
  q: QuantumState,
  grown: boolean
): [number, number] {
  if (!grown) q.sigma = Math.sqrt(q.sigma * q.sigma + Q_GROW * CTRL_DT);
  const m1 = s.th1 + gauss() * q.sigma;
  const m2 = s.th2 + gauss() * q.sigma;
  s.dth1 += gauss() * Q_KICK;
  s.dth2 += gauss() * Q_KICK;
  q.sigma = Math.max(Q_FLOOR, q.sigma * Q_SHRINK);
  return [m1, m2];
}

export function startState(range: number): CartpoleState {
  return {
    x: 0,
    th1: (Math.random() * 2 - 1) * range,
    th2: (Math.random() * 2 - 1) * range,
    dx: 0,
    dth1: 0,
    dth2: 0,
  };
}

export function fell(st: CartpoleState): boolean {
  return (
    Math.abs(st.th1) > MAX_ANGLE ||
    Math.abs(st.th2) > MAX_ANGLE ||
    Math.abs(st.x) > TRACK_HALF
  );
}

export function rollout(
  w: readonly number[],
  quantum: boolean,
  s0: CartpoleState
): { t: number; fit: number } {
  let s = { ...s0 };
  const q: QuantumState = { sigma: Q_START };
  const dt = CTRL_DT / TRAIN_SUB;
  const steps = Math.round(EP_MAX / CTRL_DT);
  let t = 0;
  let fit = 0;
  for (let n = 0; n < steps; n++) {
    let m1 = s.th1;
    let m2 = s.th2;
    if (quantum) [m1, m2] = quantumMeasure(s, q, false);
    const force = policy(w, [s.x, s.dx, m1, s.dth1, m2, s.dth2]);
    let next = s;
    for (let i = 0; i < TRAIN_SUB; i++) next = step(next, force, dt);
    if (fell(next)) break;
    s = next;
    t += CTRL_DT;
    fit += 1 + Math.max(0, 1 - (Math.abs(s.th1) + Math.abs(s.th2)) / (2 * MAX_ANGLE));
  }
  return { t, fit };
}

export function* trainRoundGen(
  brain: BrainStore,
  bestAI: BestAIStore,
  key: ModeKey,
  quantum: boolean
): Generator<void, number, void> {
  const B = brain[key];
  const range = CURRICULUM[B.stage];
  const starts = Array.from({ length: ES_STARTS }, () => startState(range));
  const cands: Array<{ w: number[]; f: number }> = [];
  for (let p = 0; p < ES_PAIRS; p++) {
    const d = ES_SCALE.map((sc) => gauss() * sc * B.smult);
    for (const sign of [1, -1] as const) {
      const w = B.w.map((m, i) => m + sign * d[i]);
      let f = 0;
      for (const s0 of starts) {
        f += rollout(w, quantum, s0).fit;
        yield;
      }
      cands.push({ w, f });
    }
  }
  cands.sort((x, y) => y.f - x.f);
  const elite = cands.slice(0, ES_ELITE);
  const avg = B.w.map((_, i) => elite.reduce((acc, c) => acc + c.w[i], 0) / ES_ELITE);
  B.w = B.w.map((m, i) => m + ES_LR * (avg[i] - m));
  B.smult = Math.max(0.15, B.smult * 0.98);

  let sum = 0;
  let best = 0;
  const N = 3;
  for (let i = 0; i < N; i++) {
    const t = rollout(B.w, quantum, startState(range)).t;
    sum += t;
    best = Math.max(best, t);
    yield;
  }
  const score = sum / N;
  B.hist.push({ s: score, stage: B.stage });
  bestAI[key] = Math.max(bestAI[key], best);

  if (score >= 0.9 * EP_MAX && B.stage < CURRICULUM.length - 1) {
    B.stage++;
    B.smult = Math.max(B.smult, 0.5);
  }
  return score;
}

// =====================================================================
// 5) BATCH TRAINING & PLAYBACK CONTROL STATE MACHINE (Pure Logic)
// Gives users proper Start, Pause/Stop, and Continue-for-N-rounds control
// without changing a single line of the cartpole math above.
// =====================================================================

export type SimPlaybackStatus = 'ready' | 'running' | 'paused';
export type TrainingStatus = 'idle' | 'running' | 'paused' | 'completed';

export interface TrainingBatchState {
  status: TrainingStatus;
  mode: ModeKey;
  batchSize: number;           // Requested number of tests/rounds for this session
  completedInBatch: number;    // Rounds completed in the active batch
  totalRoundsBeforeBatch: number;
  lastScore: number | null;
}

export function clampBatchSize(value: number): number {
  if (!Number.isFinite(value)) return 25;
  return Math.max(1, Math.min(500, Math.round(value)));
}

export function createInitialBatchState(mode: ModeKey = 'c', batchSize = 25): TrainingBatchState {
  return {
    status: 'idle',
    mode,
    batchSize: clampBatchSize(batchSize),
    completedInBatch: 0,
    totalRoundsBeforeBatch: 0,
    lastScore: null,
  };
}

export function startBatchTraining(
  currentTotalRounds: number,
  mode: ModeKey,
  batchSize: number
): TrainingBatchState {
  return {
    status: 'running',
    mode,
    batchSize: clampBatchSize(batchSize),
    completedInBatch: 0,
    totalRoundsBeforeBatch: currentTotalRounds,
    lastScore: null,
  };
}

export function pauseBatchTraining(state: TrainingBatchState): TrainingBatchState {
  if (state.status !== 'running') return state;
  return {
    ...state,
    status: 'paused',
  };
}

export function continueBatchTraining(
  state: TrainingBatchState,
  currentTotalRounds: number,
  mode: ModeKey,
  extraRounds: number
): TrainingBatchState {
  // If paused mid-batch for the same mode and there are remaining rounds, resume the remaining batch.
  if (
    state.status === 'paused' &&
    state.mode === mode &&
    state.completedInBatch < state.batchSize
  ) {
    return {
      ...state,
      status: 'running',
    };
  }
  // Otherwise start a fresh continuation batch of +extraRounds from the preserved brain weights.
  return startBatchTraining(currentTotalRounds, mode, extraRounds);
}

export function recordCompletedRound(
  state: TrainingBatchState,
  score: number
): TrainingBatchState {
  if (state.status !== 'running') return state;
  const completedInBatch = state.completedInBatch + 1;
  const isDone = completedInBatch >= state.batchSize;
  return {
    ...state,
    completedInBatch,
    lastScore: score,
    status: isDone ? 'completed' : 'running',
  };
}
