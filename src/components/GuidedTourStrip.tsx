import { useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface GuidedTourStripProps {
  onClose: () => void;
  onActionStartSim: () => void;
  onActionTrain20: () => void;
  onActionToggleQuantum: () => void;
}

const STEPS = [
  {
    title: '1. Nothing Runs Until You Press Start',
    body: 'Unlike demos that spin endlessly on load, this lab waits for you. Press Start to release the poles, Pause at any millisecond to freeze and explain the angles, or Continue right where you left off.',
    actionLabel: 'Start Simulation Now',
    actionKey: 'start' as const,
  },
  {
    title: '2. Why Are There Two Stacked Poles?',
    body: 'Pole 1 (blue, 0.6 m) attaches to the cart, and Pole 2 (orange, 0.5 m) hinges on top of Pole 1. You can only push the cart left or right — if either pole leans past the red ±30° lines, the run resets.',
    actionLabel: null,
    actionKey: null,
  },
  {
    title: '3. Train the AI for Any Number of Tests',
    body: 'In the AI Training panel on the right, pick how many rounds (tests) to run — for example 10, 25, or 50 — and press Start Training. It automatically stops at your target, and you can press Continue (+N) to keep improving the same brain.',
    actionLabel: 'Train 20 Classical Rounds',
    actionKey: 'train20' as const,
  },
  {
    title: '4. Watch the AI & Inspect Its 6 Reflexes',
    body: 'Once trained, click Watch AI to hand control to the computer. Scroll slightly to see the 6 reflex weights it discovered — and click Kick while it balances to test its recovery.',
    actionLabel: null,
    actionKey: null,
  },
  {
    title: '5. Flip to Quantum Mode to Compare',
    body: 'Switch Physics Mode to Quantum to see the purple uncertainty cloud (σ). Every 0.02 s, measuring the poles gives a noisy reading and kicks both poles — showing why quantum control is fundamentally harder.',
    actionLabel: 'Switch to Quantum Mode',
    actionKey: 'quantum' as const,
  },
];

export function GuidedTourStrip({
  onClose,
  onActionStartSim,
  onActionTrain20,
  onActionToggleQuantum,
}: GuidedTourStripProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const current = STEPS[stepIdx];

  const handleAction = () => {
    if (current.actionKey === 'start') onActionStartSim();
    if (current.actionKey === 'train20') onActionTrain20();
    if (current.actionKey === 'quantum') onActionToggleQuantum();
  };

  return (
    <div
      role="region"
      aria-label="Beginner guided tour"
      className="mb-6 rounded-xl border border-blue-200 bg-white p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="font-mono text-xs font-medium text-blue-700">
            Beginner Walkthrough · Step {stepIdx + 1} of {STEPS.length}
          </div>
          <h2 className="mt-1 font-display text-lg font-semibold text-slate-900">
            {current.title}
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{current.body}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close beginner walkthrough"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Previous
          </button>
          <button
            type="button"
            disabled={stepIdx === STEPS.length - 1}
            onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {current.actionLabel && (
          <button
            type="button"
            onClick={handleAction}
            className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
          >
            {current.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
