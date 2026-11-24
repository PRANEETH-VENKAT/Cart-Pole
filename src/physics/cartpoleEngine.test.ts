import test from 'node:test';
import assert from 'node:assert/strict';
import {
  G,
  MC,
  L1,
  M1,
  L2,
  M2,
  DT,
  EP_MAX,
  F_MAX,
  MAX_ANGLE,
  TRACK_HALF,
  Q_START,
  Q_FLOOR,
  CURRICULUM,
  ES_SCALE,
  massMatrix,
  solve3,
  step,
  policy,
  quantumMeasure,
  fell,
  rollout,
  createBrainStore,
  trainRoundGen,
  createInitialBatchState,
  startBatchTraining,
  pauseBatchTraining,
  continueBatchTraining,
  recordCompletedRound,
  clampBatchSize,
  type CartpoleState,
} from './cartpoleEngine';

test('preserves exact original cartpole physics and ES constants', () => {
  assert.equal(G, 9.81);
  assert.equal(MC, 1.0);
  assert.equal(L1, 0.6);
  assert.equal(M1, 0.3);
  assert.equal(L2, 0.5);
  assert.equal(M2, 0.2);
  assert.equal(DT, 1 / 500);
  assert.equal(EP_MAX, 8);
  assert.equal(F_MAX, 30);
  assert.deepEqual([...CURRICULUM], [0.01, 0.03, 0.05, 0.08, 0.12]);
  assert.deepEqual([...ES_SCALE], [1.5, 2.5, 40, 8, 40, 8]);
});

test('solve3 accurately solves 3x3 linear systems including massMatrix', () => {
  const M = massMatrix(0.1, -0.05);
  const expected: [number, number, number] = [1.5, -2.0, 3.25];
  const b = M.map((row) => row[0] * expected[0] + row[1] * expected[1] + row[2] * expected[2]);
  const solved = solve3(M, b);
  for (let i = 0; i < 3; i++) {
    assert.ok(Math.abs(solved[i] - expected[i]) < 1e-10);
  }
});

test('RK4 step preserves exact upright equilibrium and responds to cart force', () => {
  const upright: CartpoleState = { x: 0, th1: 0, th2: 0, dx: 0, dth1: 0, dth2: 0 };
  const nextZero = step(upright, 0);
  assert.equal(nextZero.x, 0);
  assert.equal(nextZero.th1, 0);
  assert.equal(nextZero.th2, 0);

  const nextPushed = step(upright, 20);
  assert.ok(nextPushed.dx > 0, 'positive force accelerates cart right');
  assert.ok(nextPushed.dth1 < 0, 'pushing cart right tips pole 1 left (negative angle)');
});

test('policy computes exact dot product clamped to [-F_MAX, F_MAX]', () => {
  const w = [1, 2, 10, 0, 0, 0];
  assert.equal(policy(w, [1, 2, 1, 0, 0, 0]), 15);
  assert.equal(policy(w, [10, 10, 10, 0, 0, 0]), F_MAX);
  assert.equal(policy(w, [-10, -10, -10, 0, 0, 0]), -F_MAX);
});

test('quantumMeasure shrinks sigma toward floor and adds velocity back-action', () => {
  const s: CartpoleState = { x: 0, th1: 0.05, th2: -0.05, dx: 0, dth1: 0, dth2: 0 };
  const q = { sigma: Q_START };
  const [m1, m2] = quantumMeasure(s, q, true);
  assert.ok(Number.isFinite(m1) && Number.isFinite(m2));
  assert.equal(q.sigma, Math.max(Q_FLOOR, Q_START * 0.5));
  assert.ok(s.dth1 !== 0 || s.dth2 !== 0, 'back-action perturbs angular velocities');
});

test('fell detects angle and track limits accurately', () => {
  assert.equal(fell({ x: 0, th1: 0.1, th2: -0.1, dx: 0, dth1: 0, dth2: 0 }), false);
  assert.equal(fell({ x: 0, th1: MAX_ANGLE + 0.01, th2: 0, dx: 0, dth1: 0, dth2: 0 }), true);
  assert.equal(fell({ x: TRACK_HALF + 0.01, th1: 0, th2: 0, dx: 0, dth1: 0, dth2: 0 }), true);
});

test('rollout and trainRoundGen complete a full training round cleanly', () => {
  const brain = createBrainStore();
  const bestAI = { c: 0, q: 0 };
  const r0 = rollout(brain.c.w, false, { x: 0, th1: 0.05, th2: 0.05, dx: 0, dth1: 0, dth2: 0 });
  assert.ok(r0.t >= 0 && r0.t < EP_MAX);

  const gen = trainRoundGen(brain, bestAI, 'c', false);
  let res = gen.next();
  while (!res.done) {
    res = gen.next();
  }
  assert.equal(brain.c.hist.length, 1);
  assert.ok(typeof res.value === 'number' && res.value >= 0);
  assert.ok(brain.c.w.some((v) => v !== 0), 'weights updated after ES round');
});

test('batch training state machine supports Start, Pause, Continue, and auto-stop at N rounds', () => {
  assert.equal(clampBatchSize(0), 1);
  assert.equal(clampBatchSize(999), 500);

  let batch = createInitialBatchState('c', 3);
  assert.equal(batch.status, 'idle');

  batch = startBatchTraining(0, 'c', 3);
  assert.equal(batch.status, 'running');
  assert.equal(batch.batchSize, 3);

  batch = recordCompletedRound(batch, 1.2);
  assert.equal(batch.completedInBatch, 1);
  assert.equal(batch.status, 'running');

  batch = pauseBatchTraining(batch);
  assert.equal(batch.status, 'paused');

  // Continue from paused resumes remaining rounds in same batch
  batch = continueBatchTraining(batch, 1, 'c', 3);
  assert.equal(batch.status, 'running');
  assert.equal(batch.completedInBatch, 1);

  batch = recordCompletedRound(batch, 2.4);
  assert.equal(batch.status, 'running');
  batch = recordCompletedRound(batch, 3.6);
  assert.equal(batch.completedInBatch, 3);
  assert.equal(batch.status, 'completed');

  // Continue after completion starts a new +5 batch preserving total rounds
  batch = continueBatchTraining(batch, 3, 'c', 5);
  assert.equal(batch.status, 'running');
  assert.equal(batch.batchSize, 5);
  assert.equal(batch.completedInBatch, 0);
  assert.equal(batch.totalRoundsBeforeBatch, 3);
});
