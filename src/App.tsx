import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Zap,
  ArrowLeft,
  ArrowRight,
  Square,
  Cpu,
  User,
} from 'lucide-react';
import {
  CTRL_STEPS,
  CURRICULUM,
  DT,
  EP_MAX,
  KEY_FORCE,
  KICK_FORCE,
  KICK_TIME,
  MAX_ANGLE,
  Q_GROW,
  Q_START,
  TRACK_HALF,
  TRAIN_SLICE_MS,
  clampBatchSize,
  continueBatchTraining,
  createBrainStore,
  createGhostZ,
  createInitialBatchState,
  freshState,
  pauseBatchTraining,
  policy,
  quantumMeasure,
  recordCompletedRound,
  resetBrainMode,
  startBatchTraining,
  step,
  trainRoundGen,
  type BestAIStore,
  type BrainStore,
  type CartpoleState,
  type HistoryPoint,
  type ModeKey,
  type QuantumState,
  type SimPlaybackStatus,
  type TrainingBatchState,
} from './physics/cartpoleEngine';
import { Navbar } from './components/Navbar';
import {
  PendulumCanvas,
  type CanvasOverlayOptions,
  type CanvasRenderSnapshot,
} from './components/PendulumCanvas';
import { TrainingChart } from './components/TrainingChart';
import { BrainInspector } from './components/BrainInspector';
import { ConceptExplorer, type ConceptTabId } from './components/ConceptExplorer';
import { GuidedExperiments, type ExperimentProgress } from './components/GuidedExperiments';
import { GuidedTourStrip } from './components/GuidedTourStrip';

interface HudReadout {
  th1Deg: number;
  th2Deg: number;
  cartX: number;
  runTime: number;
  bestManual: number;
  sigmaDeg: number | null;
  activeForce: number;
}

interface TrainingUiSnapshot {
  cHist: HistoryPoint[];
  qHist: HistoryPoint[];
  cStage: number;
  qStage: number;
  cWeights: number[];
  qWeights: number[];
  bestC: number;
  bestQ: number;
}

const PRESET_BATCHES = [10, 25, 50, 100] as const;

export default function App() {
  // Core mutable simulation refs (unchanged physics state, never triggers 60Hz React re-renders)
  const simStateRef = useRef<CartpoleState>(freshState());
  const qStateRef = useRef<QuantumState>({ sigma: Q_START });
  const ghostZRef = useRef<Array<[number, number]>>(createGhostZ());
  const brainRef = useRef<BrainStore>(createBrainStore());
  const bestAIRef = useRef<BestAIStore>({ c: 0, q: 0 });

  const runTimeRef = useRef(0);
  const bestManualRef = useRef(0);
  const leftHeldRef = useRef(false);
  const rightHeldRef = useRef(false);
  const kickTimeLeftRef = useRef(0);
  const kickPushRef = useRef(0);
  const accumulatorRef = useRef(0);
  const stepCountRef = useRef(0);
  const aiForceRef = useRef(0);
  const activeForceRef = useRef(0);
  const tipTrailRef = useRef<Array<{ x: number; y: number }>>([]);
  const lastFrameRef = useRef(0);

  // Playback & mode state
  const [simStatus, setSimStatus] = useState<SimPlaybackStatus>('ready');
  const simStatusRef = useRef<SimPlaybackStatus>('ready');
  const [quantumOn, setQuantumOn] = useState(false);
  const quantumOnRef = useRef(false);
  const [aiOn, setAiOn] = useState(false);
  const aiOnRef = useRef(false);
  const [statusNotice, setStatusNotice] = useState<string>(
    'Ready — press Start to release the poles, or train the AI for a chosen number of tests.'
  );
  const noticeTimerRef = useRef<number | null>(null);

  // Visual overlays (purely visual aids, zero effect on physics)
  const [overlays, setOverlays] = useState<CanvasOverlayOptions>({
    showForceVector: true,
    showAngleGuides: true,
    showTipTrail: true,
    showLabels: true,
  });

  // Beginner tour toggle & ConceptExplorer tab
  const [tourOpen, setTourOpen] = useState(false);
  const [conceptTab, setConceptTab] = useState<ConceptTabId>('challenge');

  // Experiment checklist auto-tracking
  const [expProgress, setExpProgress] = useState<ExperimentProgress>({
    triedManual: false,
    trainedClassical: false,
    kickedAI: false,
    trainedQuantum: false,
  });

  // Batch training controls
  const [batchInput, setBatchInput] = useState<string>('25');
  const [batchState, setBatchState] = useState<TrainingBatchState>(() =>
    createInitialBatchState('c', 25)
  );
  const batchStateRef = useRef<TrainingBatchState>(batchState);
  batchStateRef.current = batchState;

  const trainTokenRef = useRef(0);
  const trainGenRef = useRef<Generator<void, number, void> | null>(null);
  const trainKeyRef = useRef<ModeKey>('c');
  const trainQuantumRef = useRef(false);

  // Canvas render snapshot & imperative redraw handle
  const renderRef = useRef<CanvasRenderSnapshot>({
    state: simStateRef.current,
    qState: qStateRef.current,
    quantumOn: false,
    aiOn: false,
    ghostZ: ghostZRef.current,
    activeForce: 0,
    tipTrail: tipTrailRef.current,
    simStatus: 'ready',
  });
  const drawSignalRef = useRef<(() => void) | null>(null);

  // Throttled React HUD state
  const [hud, setHud] = useState<HudReadout>(() => ({
    th1Deg: (simStateRef.current.th1 * 180) / Math.PI,
    th2Deg: (simStateRef.current.th2 * 180) / Math.PI,
    cartX: simStateRef.current.x,
    runTime: 0,
    bestManual: 0,
    sigmaDeg: null,
    activeForce: 0,
  }));

  const [trainUi, setTrainUi] = useState<TrainingUiSnapshot>({
    cHist: [],
    qHist: [],
    cStage: 0,
    qStage: 0,
    cWeights: [0, 0, 0, 0, 0, 0],
    qWeights: [0, 0, 0, 0, 0, 0],
    bestC: 0,
    bestQ: 0,
  });

  const activeMode: ModeKey = quantumOn ? 'q' : 'c';

  const syncTrainUi = useCallback(() => {
    const b = brainRef.current;
    const best = bestAIRef.current;
    setTrainUi({
      cHist: b.c.hist.slice(),
      qHist: b.q.hist.slice(),
      cStage: b.c.stage,
      qStage: b.q.stage,
      cWeights: b.c.w.slice(),
      qWeights: b.q.w.slice(),
      bestC: best.c,
      bestQ: best.q,
    });
  }, []);

  const syncCanvasAndHud = useCallback(() => {
    const st = simStateRef.current;
    renderRef.current = {
      state: st,
      qState: qStateRef.current,
      quantumOn: quantumOnRef.current,
      aiOn: aiOnRef.current,
      ghostZ: ghostZRef.current,
      activeForce: activeForceRef.current,
      tipTrail: tipTrailRef.current,
      simStatus: simStatusRef.current,
    };
    drawSignalRef.current?.();
    setHud({
      th1Deg: (st.th1 * 180) / Math.PI,
      th2Deg: (st.th2 * 180) / Math.PI,
      cartX: st.x,
      runTime: runTimeRef.current,
      bestManual: aiOnRef.current
        ? bestManualRef.current
        : Math.max(bestManualRef.current, runTimeRef.current),
      sigmaDeg: quantumOnRef.current ? (qStateRef.current.sigma * 180) / Math.PI : null,
      activeForce: activeForceRef.current,
    });
  }, []);

  const flashNotice = useCallback((msg: string, autoClearMs?: number) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setStatusNotice(msg);
    if (autoClearMs) {
      noticeTimerRef.current = window.setTimeout(() => {
        setStatusNotice('');
        noticeTimerRef.current = null;
      }, autoClearMs);
    }
  }, []);

  const currentManualForce = () => {
    let F = 0;
    if (leftHeldRef.current) F -= KEY_FORCE;
    if (rightHeldRef.current) F += KEY_FORCE;
    if (kickTimeLeftRef.current > 0) F += kickPushRef.current;
    return F;
  };

  const pushTipTrailPoint = (st: CartpoleState) => {
    const PX = 200;
    const PIVOT_Y = 340;
    const pivotX = 450 + st.x * PX;
    const j1x = pivotX + 0.6 * PX * Math.sin(st.th1);
    const j1y = PIVOT_Y - 0.6 * PX * Math.cos(st.th1);
    const j2x = j1x + 0.5 * PX * Math.sin(st.th2);
    const j2y = j1y - 0.5 * PX * Math.cos(st.th2);
    const trail = tipTrailRef.current;
    trail.push({ x: j2x, y: j2y });
    if (trail.length > 48) trail.shift();
  };

  const resetRun = useCallback(
    (reason?: string, nextStatus?: SimPlaybackStatus) => {
      const mKey: ModeKey = quantumOnRef.current ? 'q' : 'c';
      if (aiOnRef.current) {
        bestAIRef.current[mKey] = Math.max(bestAIRef.current[mKey], runTimeRef.current);
      } else {
        bestManualRef.current = Math.max(bestManualRef.current, runTimeRef.current);
      }
      simStateRef.current = freshState();
      runTimeRef.current = 0;
      accumulatorRef.current = 0;
      kickTimeLeftRef.current = 0;
      kickPushRef.current = 0;
      stepCountRef.current = 0;
      aiForceRef.current = 0;
      activeForceRef.current = 0;
      qStateRef.current = { sigma: Q_START };
      tipTrailRef.current = [];
      if (nextStatus) {
        simStatusRef.current = nextStatus;
        setSimStatus(nextStatus);
      }
      syncTrainUi();
      syncCanvasAndHud();
      if (reason) {
        flashNotice(reason, 2600);
      }
    },
    [flashNotice, syncCanvasAndHud, syncTrainUi]
  );

  // Exact physics advance loop (unchanged equations & thresholds)
  const advancePhysics = useCallback(
    (seconds: number) => {
      accumulatorRef.current += seconds;
      const mKey: ModeKey = quantumOnRef.current ? 'q' : 'c';

      while (accumulatorRef.current >= DT) {
        if ((aiOnRef.current || quantumOnRef.current) && stepCountRef.current % CTRL_STEPS === 0) {
          let m1 = simStateRef.current.th1;
          let m2 = simStateRef.current.th2;
          if (quantumOnRef.current) {
            [m1, m2] = quantumMeasure(simStateRef.current, qStateRef.current, true);
          }
          if (aiOnRef.current) {
            const st = simStateRef.current;
            aiForceRef.current = policy(brainRef.current[mKey].w, [
              st.x,
              st.dx,
              m1,
              st.dth1,
              m2,
              st.dth2,
            ]);
          }
        }
        stepCountRef.current++;

        const totalForce = (aiOnRef.current ? aiForceRef.current : 0) + currentManualForce();
        activeForceRef.current = totalForce;
        simStateRef.current = step(simStateRef.current, totalForce);

        if (quantumOnRef.current) {
          qStateRef.current.sigma = Math.sqrt(
            qStateRef.current.sigma * qStateRef.current.sigma + Q_GROW * DT
          );
        }

        runTimeRef.current += DT;
        kickTimeLeftRef.current -= DT;
        accumulatorRef.current -= DT;

        if (!aiOnRef.current && runTimeRef.current >= 0.8) {
          setExpProgress((prev) => (prev.triedManual ? prev : { ...prev, triedManual: true }));
        }

        if (aiOnRef.current && runTimeRef.current >= EP_MAX - 1e-9) {
          bestAIRef.current[mKey] = Math.max(bestAIRef.current[mKey], EP_MAX);
          resetRun(`Reached the ${EP_MAX}.0 s balance cap — starting a fresh test run.`);
          return;
        }

        if (
          Math.abs(simStateRef.current.th1) > MAX_ANGLE ||
          Math.abs(simStateRef.current.th2) > MAX_ANGLE
        ) {
          resetRun('A pole tipped past ±30° — reset to a fresh upright start.');
          return;
        }

        if (Math.abs(simStateRef.current.x) > TRACK_HALF) {
          resetRun('The cart reached the ±2 m track limit — reset to center.');
          return;
        }
      }

      pushTipTrailPoint(simStateRef.current);

      if (aiOnRef.current) {
        bestAIRef.current[mKey] = Math.max(bestAIRef.current[mKey], runTimeRef.current);
      }
    },
    [resetRun]
  );

  // Main requestAnimationFrame loop: ONLY advances physics when simStatus === 'running'
  useEffect(() => {
    let rafId = 0;
    let lastHudSync = 0;
    lastFrameRef.current = performance.now();

    const frame = (now: number) => {
      const seconds = Math.min((now - lastFrameRef.current) / 1000, 0.05);
      lastFrameRef.current = now;

      if (simStatusRef.current === 'running') {
        advancePhysics(seconds);
        renderRef.current = {
          state: simStateRef.current,
          qState: qStateRef.current,
          quantumOn: quantumOnRef.current,
          aiOn: aiOnRef.current,
          ghostZ: ghostZRef.current,
          activeForce: activeForceRef.current,
          tipTrail: tipTrailRef.current,
          simStatus: simStatusRef.current,
        };
        drawSignalRef.current?.();

        // Sync React HUD at ~20 Hz to avoid 60Hz React state churn
        if (now - lastHudSync > 50) {
          lastHudSync = now;
          const st = simStateRef.current;
          setHud({
            th1Deg: (st.th1 * 180) / Math.PI,
            th2Deg: (st.th2 * 180) / Math.PI,
            cartX: st.x,
            runTime: runTimeRef.current,
            bestManual: aiOnRef.current
              ? bestManualRef.current
              : Math.max(bestManualRef.current, runTimeRef.current),
            sigmaDeg: quantumOnRef.current ? (qStateRef.current.sigma * 180) / Math.PI : null,
            activeForce: activeForceRef.current,
          });
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);
    return () => window.cancelAnimationFrame(rafId);
  }, [advancePhysics]);

  // Redraw canvas whenever visual overlay toggles change (even while paused!)
  useEffect(() => {
    drawSignalRef.current?.();
  }, [overlays]);

  // Keyboard arrow controls (ignored when typing inside inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'ArrowLeft') {
        leftHeldRef.current = true;
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        rightHeldRef.current = true;
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') leftHeldRef.current = false;
      if (e.key === 'ArrowRight') rightHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Playback handlers
  const handleStartOrContinueSim = useCallback(() => {
    lastFrameRef.current = performance.now();
    simStatusRef.current = 'running';
    setSimStatus('running');
    flashNotice(
      aiOnRef.current
        ? 'AI Autopilot running — watch how it pushes the cart to keep both poles upright.'
        : 'Manual simulation running — use ← / → arrow keys or Push buttons to balance.'
    );
    syncCanvasAndHud();
  }, [flashNotice, syncCanvasAndHud]);

  const handlePauseSim = useCallback(() => {
    simStatusRef.current = 'paused';
    setSimStatus('paused');
    flashNotice(
      'Simulation paused — inspect the exact angles and force vector, or press Continue.'
    );
    syncCanvasAndHud();
  }, [flashNotice, syncCanvasAndHud]);

  const handleStopAndResetSim = useCallback(() => {
    resetRun('Simulation stopped and reset to a fresh upright start.', 'ready');
  }, [resetRun]);

  const handleStepForward = useCallback(() => {
    if (simStatusRef.current === 'running') {
      simStatusRef.current = 'paused';
      setSimStatus('paused');
    } else if (simStatusRef.current === 'ready') {
      simStatusRef.current = 'paused';
      setSimStatus('paused');
    }
    advancePhysics(0.02);
    syncCanvasAndHud();
    flashNotice('Stepped forward by 0.02 s (10 RK4 physics sub-steps).');
  }, [advancePhysics, flashNotice, syncCanvasAndHud]);

  const handleKick = useCallback(() => {
    const direction = Math.random() < 0.5 ? -1 : 1;
    kickPushRef.current = direction * KICK_FORCE * (0.5 + 0.5 * Math.random());
    kickTimeLeftRef.current = KICK_TIME;
    if (simStatusRef.current !== 'running') {
      lastFrameRef.current = performance.now();
      simStatusRef.current = 'running';
      setSimStatus('running');
    }
    if (aiOnRef.current) {
      setExpProgress((prev) => (prev.kickedAI ? prev : { ...prev, kickedAI: true }));
    }
    flashNotice(
      `Applied a ${kickPushRef.current > 0 ? 'rightward' : 'leftward'} kick (${Math.abs(
        kickPushRef.current
      ).toFixed(1)} N for ${KICK_TIME} s).`,
      2000
    );
  }, [flashNotice]);

  // Batch AI Training loop (exact trainRoundGen, sliced at 12ms, stops cleanly at target count)
  const runTrainingSlice = useCallback(
    (token: number) => {
      if (token !== trainTokenRef.current || batchStateRef.current.status !== 'running') return;

      const t0 = performance.now();
      let batchFinished = false;

      while (performance.now() - t0 < TRAIN_SLICE_MS) {
        if (!trainGenRef.current) {
          trainKeyRef.current = batchStateRef.current.mode;
          trainQuantumRef.current = batchStateRef.current.mode === 'q';
          trainGenRef.current = trainRoundGen(
            brainRef.current,
            bestAIRef.current,
            trainKeyRef.current,
            trainQuantumRef.current
          );
        }

        const r = trainGenRef.current.next();
        if (r.done) {
          trainGenRef.current = null;
          const nextBatch = recordCompletedRound(batchStateRef.current, r.value);
          batchStateRef.current = nextBatch;
          setBatchState(nextBatch);
          syncTrainUi();

          const totalForMode = brainRef.current[trainKeyRef.current].hist.length;
          if (trainKeyRef.current === 'c' && totalForMode >= 5) {
            setExpProgress((prev) =>
              prev.trainedClassical ? prev : { ...prev, trainedClassical: true }
            );
          }
          if (trainKeyRef.current === 'q' && totalForMode >= 5) {
            setExpProgress((prev) =>
              prev.trainedQuantum ? prev : { ...prev, trainedQuantum: true }
            );
          }

          if (nextBatch.status === 'completed') {
            batchFinished = true;
            const modeLabel = trainKeyRef.current === 'q' ? 'Quantum' : 'Classical';
            flashNotice(
              `Finished ${nextBatch.batchSize} ${modeLabel} training rounds (total: ${totalForMode}). Press Watch AI to test or Continue to train more.`
            );
            break;
          }
        }
      }

      if (!batchFinished && token === trainTokenRef.current && batchStateRef.current.status === 'running') {
        window.setTimeout(() => runTrainingSlice(token), 0);
      }
    },
    [flashNotice, syncTrainUi]
  );

  const parsedBatchSize = clampBatchSize(Number(batchInput));

  const launchTraining = useCallback(
    (mode: ModeKey, count: number, isContinue: boolean) => {
      const targetCount = clampBatchSize(count);
      const totalRounds = brainRef.current[mode].hist.length;

      // Exact original Quantum warm-start rule: copy classical weights if quantum is untrained
      if (mode === 'q' && brainRef.current.q.hist.length === 0 && brainRef.current.c.hist.length > 0) {
        brainRef.current.q.w = brainRef.current.c.w.slice();
      }

      trainTokenRef.current += 1;
      trainGenRef.current = null;
      const token = trainTokenRef.current;

      const nextBatch = isContinue
        ? continueBatchTraining(batchStateRef.current, totalRounds, mode, targetCount)
        : startBatchTraining(totalRounds, mode, targetCount);

      batchStateRef.current = nextBatch;
      setBatchState(nextBatch);
      syncTrainUi();

      const modeLabel = mode === 'q' ? 'Quantum' : 'Classical';
      flashNotice(
        `Training ${modeLabel} AI (${nextBatch.completedInBatch}/${nextBatch.batchSize} rounds in this batch)…`
      );
      window.setTimeout(() => runTrainingSlice(token), 16);
    },
    [flashNotice, runTrainingSlice, syncTrainUi]
  );

  const handleStopTraining = useCallback(() => {
    trainTokenRef.current += 1;
    trainGenRef.current = null;
    const paused = pauseBatchTraining(batchStateRef.current);
    batchStateRef.current = paused;
    setBatchState(paused);
    flashNotice(
      `Training paused at ${paused.completedInBatch}/${paused.batchSize} rounds — learned weights saved. Press Continue to resume.`
    );
  }, [flashNotice]);

  const handleResetCurrentBrain = useCallback(() => {
    trainTokenRef.current += 1;
    trainGenRef.current = null;
    resetBrainMode(brainRef.current, activeMode);
    bestAIRef.current[activeMode] = 0;

    const freshBatch = createInitialBatchState(activeMode, parsedBatchSize);
    batchStateRef.current = freshBatch;
    setBatchState(freshBatch);

    if (aiOnRef.current) {
      aiOnRef.current = false;
      setAiOn(false);
    }

    syncTrainUi();
    syncCanvasAndHud();
    flashNotice(
      `Reset ${activeMode === 'q' ? 'Quantum' : 'Classical'} AI brain weights back to zero.`
    );
  }, [activeMode, flashNotice, parsedBatchSize, syncCanvasAndHud, syncTrainUi]);

  // Mode switches (Classical vs Quantum, Manual vs Watch AI)
  const handleSelectPhysicsMode = useCallback(
    (nextQuantum: boolean) => {
      if (nextQuantum === quantumOnRef.current) return;

      // Pause any active training for the previous mode cleanly
      if (batchStateRef.current.status === 'running') {
        trainTokenRef.current += 1;
        trainGenRef.current = null;
        const paused = pauseBatchTraining(batchStateRef.current);
        batchStateRef.current = paused;
        setBatchState(paused);
      }

      quantumOnRef.current = nextQuantum;
      setQuantumOn(nextQuantum);
      qStateRef.current = { sigma: Q_START };

      const mKey: ModeKey = nextQuantum ? 'q' : 'c';
      if (aiOnRef.current && brainRef.current[mKey].hist.length === 0) {
        aiOnRef.current = false;
        setAiOn(false);
        resetRun(
          `Switched to ${nextQuantum ? 'Quantum' : 'Classical'} mode (no trained AI yet — switched to Manual).`,
          'ready'
        );
      } else {
        resetRun(
          nextQuantum
            ? 'Quantum mode active — watch the purple uncertainty cloud (σ) spread and kick both poles.'
            : 'Classical mode active — exact noiseless pole readings.',
          simStatusRef.current === 'running' ? 'running' : 'ready'
        );
      }
    },
    [resetRun]
  );

  const handleSelectController = useCallback(
    (enableAI: boolean) => {
      const mKey: ModeKey = quantumOnRef.current ? 'q' : 'c';
      if (enableAI && brainRef.current[mKey].hist.length === 0) {
        flashNotice(
          `No trained ${mKey === 'q' ? 'Quantum' : 'Classical'} AI yet — choose a number of rounds and click Start Training first.`,
          3500
        );
        return;
      }
      aiOnRef.current = enableAI;
      setAiOn(enableAI);
      if (enableAI) {
        resetRun(
          `Watching trained ${mKey === 'q' ? 'Quantum' : 'Classical'} AI balance the pendulum.`,
          'running'
        );
      } else {
        resetRun('Switched to Manual control — press Start and use ← / → to balance.', 'ready');
      }
    },
    [flashNotice, resetRun]
  );

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      trainTokenRef.current += 1;
      if (noticeTimerRef.current !== null) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  // Guided Experiment 1-click launchers
  const scrollToSimulator = () => {
    document.getElementById('simulator')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleExpManual = () => {
    scrollToSimulator();
    aiOnRef.current = false;
    setAiOn(false);
    handleSelectPhysicsMode(false);
    resetRun('Manual test ready — press ← / → or hold Push Left / Push Right!', 'running');
  };

  const handleExpClassicalBatch = () => {
    scrollToSimulator();
    handleSelectPhysicsMode(false);
    setBatchInput('25');
    launchTraining('c', 25, false);
  };

  const handleExpWatchAndKick = () => {
    scrollToSimulator();
    const mKey: ModeKey = quantumOnRef.current ? 'q' : 'c';
    if (brainRef.current[mKey].hist.length === 0) {
      flashNotice('Train at least 1 batch of rounds first, then click Watch AI & Test Kick!', 3500);
      return;
    }
    handleSelectController(true);
    window.setTimeout(() => {
      if (aiOnRef.current && simStatusRef.current === 'running') {
        handleKick();
      }
    }, 900);
  };

  const handleExpQuantumBatch = () => {
    scrollToSimulator();
    handleSelectPhysicsMode(true);
    setBatchInput('25');
    launchTraining('q', 25, false);
  };

  const currentModeRounds = activeMode === 'q' ? trainUi.qHist.length : trainUi.cHist.length;
  const currentModeStage = activeMode === 'q' ? trainUi.qStage : trainUi.cStage;
  const currentModeWeights = activeMode === 'q' ? trainUi.qWeights : trainUi.cWeights;
  const isTrainingRunning = batchState.status === 'running';
  const isTrainingPausedSameMode =
    batchState.status === 'paused' &&
    batchState.mode === activeMode &&
    batchState.completedInBatch < batchState.batchSize;

  const batchPct =
    batchState.batchSize > 0
      ? Math.min(100, Math.round((batchState.completedInBatch / batchState.batchSize) * 100))
      : 0;

  const compareMax = Math.max(trainUi.bestC, trainUi.bestQ, EP_MAX);

  return (
    <div id="top" className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Navbar
        tourOpen={tourOpen}
        onToggleTour={() => {
          setTourOpen((open) => !open);
          if (!tourOpen) scrollToSimulator();
        }}
        onSelectConceptTab={(tab) => setConceptTab(tab)}
      />

      <main
        data-sim-status={simStatus}
        data-training-status={batchState.status}
        data-physics-mode={activeMode}
      >
        {/* Editorial Intro Band */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:py-10">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-blue-700">
                  Interactive Physics &amp; Reinforcement Learning Project
                </p>
                <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
                  Double Inverted Pendulum on a Cart
                </h1>
                <p className="mt-2.5 text-base leading-relaxed text-slate-600">
                  Balance two stacked hinged poles on a sliding cart, train a 6-weight AI for any
                  number of tests, and compare{' '}
                  <strong className="font-semibold text-slate-800">Classical mechanics</strong>{' '}
                  against{' '}
                  <strong className="font-semibold text-slate-800">
                    Quantum measurement back-action
                  </strong>
                  .
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-500 shrink-0">
                <span>500 Hz RK4 Lagrangian</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span>Evolution Strategy AI</span>
                <span className="hidden sm:inline" aria-hidden="true">
                  ·
                </span>
                <span>{EP_MAX}s Cap / ±30° Limit</span>
              </div>
            </div>
          </div>
        </section>

        {/* Primary Interactive Lab Workspace */}
        <section id="simulator" className="scroll-mt-16 py-8">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
            {tourOpen && (
              <GuidedTourStrip
                onClose={() => setTourOpen(false)}
                onActionStartSim={handleStartOrContinueSim}
                onActionTrain20={() => {
                  handleSelectPhysicsMode(false);
                  setBatchInput('20');
                  launchTraining('c', 20, false);
                }}
                onActionToggleQuantum={() => handleSelectPhysicsMode(true)}
              />
            )}

            {/* Two-Zone Precision Sandbox: Left Interactive Stage (7/12) + Right Control & Training Console (5/12) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* LEFT ZONE: Simulation Viewport, Playback Bar & Live Telemetry */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  {/* Top Mode & Overlay Strip */}
                  <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
                    {/* Segmented Mode Selector: Classical vs Quantum */}
                    <div
                      role="group"
                      aria-label="Physics mode"
                      className="inline-flex items-center rounded-lg bg-slate-100 p-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectPhysicsMode(false)}
                        aria-pressed={!quantumOn}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          !quantumOn
                            ? 'bg-white text-blue-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Classical Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectPhysicsMode(true)}
                        aria-pressed={quantumOn}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          quantumOn
                            ? 'bg-white text-violet-700 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Quantum Mode
                      </button>
                    </div>

                    {/* Segmented Controller Selector: Manual vs Watch AI */}
                    <div
                      role="group"
                      aria-label="Controller mode"
                      className="inline-flex items-center rounded-lg bg-slate-100 p-1"
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectController(false)}
                        aria-pressed={!aiOn}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          !aiOn
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <User className="h-3.5 w-3.5" aria-hidden="true" />
                        Manual Control
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSelectController(true)}
                        aria-pressed={aiOn}
                        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                          aiOn
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Cpu className="h-3.5 w-3.5" aria-hidden="true" />
                        Watch AI
                      </button>
                    </div>
                  </div>

                  {/* Interactive Canvas */}
                  <PendulumCanvas
                    renderRef={renderRef}
                    overlays={overlays}
                    drawSignalRef={drawSignalRef}
                  />

                  {/* Primary Simulation Playback Controls (Proper Start / Pause / Continue / Stop & Reset) */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {simStatus !== 'running' ? (
                        <button
                          type="button"
                          onClick={handleStartOrContinueSim}
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                        >
                          <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          {simStatus === 'paused' ? 'Continue' : 'Start'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePauseSim}
                          className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                        >
                          <Pause className="h-4 w-4 fill-current" aria-hidden="true" />
                          Pause
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={handleStopAndResetSim}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Stop &amp; Reset
                      </button>

                      <button
                        type="button"
                        onClick={handleStepForward}
                        title="Advance physics by one 0.02s step"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <StepForward className="h-4 w-4" aria-hidden="true" />
                        Step
                      </button>

                      <button
                        type="button"
                        onClick={handleKick}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Zap className="h-4 w-4 text-amber-600" aria-hidden="true" />
                        Kick
                      </button>
                    </div>

                    {/* Touch / Mouse Push Controls */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onPointerDown={() => {
                          leftHeldRef.current = true;
                        }}
                        onPointerUp={() => {
                          leftHeldRef.current = false;
                        }}
                        onPointerLeave={() => {
                          leftHeldRef.current = false;
                        }}
                        onPointerCancel={() => {
                          leftHeldRef.current = false;
                        }}
                        aria-label="Push cart left"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-blue-50 active:border-blue-300 select-none cursor-pointer whitespace-nowrap"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        Push Left
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => {
                          rightHeldRef.current = true;
                        }}
                        onPointerUp={() => {
                          rightHeldRef.current = false;
                        }}
                        onPointerLeave={() => {
                          rightHeldRef.current = false;
                        }}
                        onPointerCancel={() => {
                          rightHeldRef.current = false;
                        }}
                        aria-label="Push cart right"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-blue-50 active:border-blue-300 select-none cursor-pointer whitespace-nowrap"
                      >
                        Push Right
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Live Plain-English Status Line & Visual Overlay Checkboxes */}
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p
                      role="status"
                      aria-live="polite"
                      data-testid="status-message"
                      className="text-xs font-medium text-slate-700 min-h-[1.25rem]"
                    >
                      {statusNotice ||
                        (simStatus === 'running'
                          ? aiOn
                            ? 'AI Autopilot actively balancing both poles.'
                            : 'Running manually — hold ← / → keys or Push buttons.'
                          : simStatus === 'paused'
                            ? 'Paused — click Continue to resume or Step to advance 0.02s.'
                            : 'Ready — click Start to run the simulation.')}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 shrink-0">
                      {(
                        [
                          ['showForceVector', 'Force'],
                          ['showAngleGuides', '±30° Guides'],
                          ['showTipTrail', 'Trail'],
                          ['showLabels', 'Labels'],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={overlays[key]}
                            onChange={(e) =>
                              setOverlays((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                            className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Live Telemetry Readouts Strip (5 Precision Metrics) */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-medium text-slate-500">Pole 1 angle</div>
                    <div
                      data-testid="readout-a1"
                      className="mt-1 font-mono text-xl font-semibold tabular-nums text-blue-700"
                    >
                      {hud.th1Deg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-medium text-slate-500">Pole 2 angle</div>
                    <div
                      data-testid="readout-a2"
                      className="mt-1 font-mono text-xl font-semibold tabular-nums text-orange-600"
                    >
                      {hud.th2Deg.toFixed(1)}°
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-medium text-slate-500">Time balanced</div>
                    <div
                      data-testid="readout-time"
                      className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900"
                    >
                      {hud.runTime.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-slate-400">s</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-medium text-slate-500">Best manual</div>
                    <div className="mt-1 font-mono text-xl font-semibold tabular-nums text-slate-900">
                      {hud.bestManual.toFixed(1)}
                      <span className="ml-1 text-xs font-normal text-slate-400">s</span>
                    </div>
                  </div>
                  <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                    <div className="text-[11px] font-medium text-slate-500">Uncertainty σ</div>
                    <div
                      data-testid="readout-sigma"
                      className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                        hud.sigmaDeg !== null ? 'text-violet-700' : 'text-slate-400'
                      }`}
                    >
                      {hud.sigmaDeg !== null ? `${hud.sigmaDeg.toFixed(2)}°` : '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT ZONE: AI Training Batch Control Console & Classical vs Quantum Comparison */}
              <div className="lg:col-span-5 space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-slate-900">
                        AI Training Studio
                      </h2>
                      <p className="mt-0.5 text-xs text-slate-600">
                        Choose how many test rounds to train. Stops automatically at your target, or
                        continue anytime without losing progress.
                      </p>
                    </div>
                  </div>

                  {/* Target Number of Tests / Rounds Input */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="rounds-input"
                        className="text-xs font-semibold text-slate-700"
                      >
                        Number of training tests (rounds)
                      </label>
                      <span className="font-mono text-xs text-slate-500">
                        Mode: {activeMode === 'q' ? 'Quantum' : 'Classical'}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
                        {PRESET_BATCHES.map((n) => (
                          <button
                            key={n}
                            type="button"
                            disabled={isTrainingRunning}
                            onClick={() => setBatchInput(String(n))}
                            className={`rounded-md px-2.5 py-1 text-xs font-mono font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                              parsedBatchSize === n
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <input
                          id="rounds-input"
                          type="number"
                          min={1}
                          max={500}
                          disabled={isTrainingRunning}
                          value={batchInput}
                          onChange={(e) => setBatchInput(e.target.value)}
                          onBlur={() => setBatchInput(String(clampBatchSize(Number(batchInput))))}
                          className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm font-semibold tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-50"
                        />
                        <span className="text-xs text-slate-500">rounds</span>
                      </div>
                    </div>
                  </div>

                  {/* Start / Stop / Continue / Reset Training Controls */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {!isTrainingRunning ? (
                      <>
                        {currentModeRounds === 0 ? (
                          <button
                            type="button"
                            onClick={() => launchTraining(activeMode, parsedBatchSize, false)}
                            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap ${
                              activeMode === 'q'
                                ? 'bg-violet-600 hover:bg-violet-700'
                                : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                          >
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                            Start Training ({parsedBatchSize})
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => launchTraining(activeMode, parsedBatchSize, true)}
                              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer whitespace-nowrap ${
                                activeMode === 'q'
                                  ? 'bg-violet-600 hover:bg-violet-700'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                              {isTrainingPausedSameMode
                                ? `Continue (${batchState.batchSize - batchState.completedInBatch} left)`
                                : `Continue (+${parsedBatchSize})`}
                            </button>
                            <button
                              type="button"
                              onClick={handleResetCurrentBrain}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                              Reset AI
                            </button>
                          </>
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopTraining}
                        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Stop Training
                      </button>
                    )}
                  </div>

                  {/* Live Batch Progress Bar & Curriculum Stage Readout */}
                  <div className="mt-4 rounded-lg border border-slate-200/80 bg-[#F8FAFC] p-3.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700">
                        {batchState.status === 'running'
                          ? `Running ${batchState.mode === 'q' ? 'Quantum' : 'Classical'} batch`
                          : batchState.status === 'paused'
                            ? 'Training paused (weights saved)'
                            : batchState.status === 'completed'
                              ? 'Batch completed'
                              : 'Idle — ready to train'}
                      </span>
                      <span
                        data-testid="batch-progress"
                        className="font-mono font-semibold tabular-nums text-slate-900"
                      >
                        {batchState.completedInBatch} / {batchState.batchSize}
                      </span>
                    </div>

                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full transition-all duration-150 ${
                          activeMode === 'q' ? 'bg-violet-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${batchPct}%` }}
                      />
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-mono tabular-nums">
                      <span data-testid="total-rounds">
                        Total trained: <strong className="text-slate-900">{currentModeRounds}</strong>
                      </span>
                      <span>
                        Level {currentModeStage + 1}/{CURRICULUM.length} (±
                        {((CURRICULUM[currentModeStage] * 180) / Math.PI).toFixed(1)}°)
                      </span>
                      {batchState.lastScore !== null && (
                        <span>Last: {batchState.lastScore.toFixed(1)}s</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Head-to-Head Classical vs Quantum Scoreboard */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="font-display text-base font-semibold text-slate-900">
                    Best AI Balance Time: Classical vs Quantum
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-600">
                    Maximum single-run survival time achieved by each mode (cap {EP_MAX}.0 s).
                  </p>

                  <div className="mt-4 space-y-3.5">
                    <div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-blue-700">
                          Classical AI · {trainUi.cHist.length} rounds · Lv {trainUi.cStage + 1}
                        </span>
                        <span
                          data-testid="best-classical"
                          className="font-mono text-base font-semibold tabular-nums text-slate-900"
                        >
                          {trainUi.bestC.toFixed(1)} s
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${(100 * trainUi.bestC) / compareMax}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-semibold text-violet-700">
                          Quantum AI · {trainUi.qHist.length} rounds · Lv {trainUi.qStage + 1}
                        </span>
                        <span
                          data-testid="best-quantum"
                          className="font-mono text-base font-semibold tabular-nums text-slate-900"
                        >
                          {trainUi.bestQ.toFixed(1)} s
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-violet-600 transition-all duration-300"
                          style={{ width: `${(100 * trainUi.bestQ) / compareMax}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Plain-English Context Card (explains what's happening right now) */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h2 className="font-display text-sm font-semibold text-slate-900">
                    What You Are Looking At
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {isTrainingRunning
                      ? `Each training round tests 20 slight variations of the AI's 6 reflexes in headless physics, keeps the top 5 survivors, and moves 70% toward their average.`
                      : quantumOn
                        ? `Quantum Mode is active: the faint purple cloud shows uncertainty σ around the real angles. Every 0.02 s, measuring the poles shrinks the cloud by half but kicks both poles randomly.`
                        : aiOn
                          ? `AI Autopilot is reading all 6 physical states 50 times per second and pushing the cart (blue force arrow) to keep both poles inside the ±30° red boundary.`
                          : `Two hinged poles balance on a sliding 1.0 kg cart. Press Start to try balancing with ← / → keys, or train the AI above for a fixed number of test rounds.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Full-Width Learning Curve & Live AI Brain Inspector */}
            <div className="mt-6 space-y-6">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      Training Curve: Seconds Balanced vs Round
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Each point averages 3 evaluation runs at the current wobble difficulty. Notice
                      temporary dips whenever the AI graduates to a harder curriculum level.
                    </p>
                  </div>
                </div>
                <TrainingChart classicalHist={trainUi.cHist} quantumHist={trainUi.qHist} />
              </div>

              <BrainInspector
                mode={activeMode}
                weights={currentModeWeights}
                trainedRounds={currentModeRounds}
                currentForce={hud.activeForce}
                aiOn={aiOn}
              />
            </div>
          </div>
        </section>

        {/* Plain-English Interactive Concept Explorer */}
        <ConceptExplorer activeTab={conceptTab} onTabChange={setConceptTab} />

        {/* 4-Step Interactive Physics Project Experiments */}
        <GuidedExperiments
          progress={expProgress}
          onStartManualExperiment={handleExpManual}
          onStartClassicalBatch={handleExpClassicalBatch}
          onStartWatchAndKick={handleExpWatchAndKick}
          onStartQuantumBatch={handleExpQuantumBatch}
        />
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="border-t border-slate-200 bg-[#F8FAFC] py-8">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:px-6">
          <div>
            <span className="font-display font-semibold text-slate-800">PendulumLab</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>
              Double Inverted Pendulum Physics Project — Original RK4 Lagrangian &amp; Evolution
              Strategy Engine
            </span>
          </div>
          <a
            href="#top"
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline underline-offset-4 whitespace-nowrap"
          >
            Back to top
          </a>
        </div>
      </footer>
    </div>
  );
}
