import { CheckCircle2, Circle, ArrowUpRight } from 'lucide-react';

export interface ExperimentProgress {
  triedManual: boolean;
  trainedClassical: boolean;
  kickedAI: boolean;
  trainedQuantum: boolean;
}

interface GuidedExperimentsProps {
  progress: ExperimentProgress;
  onStartManualExperiment: () => void;
  onStartClassicalBatch: () => void;
  onStartWatchAndKick: () => void;
  onStartQuantumBatch: () => void;
}

export function GuidedExperiments({
  progress,
  onStartManualExperiment,
  onStartClassicalBatch,
  onStartWatchAndKick,
  onStartQuantumBatch,
}: GuidedExperimentsProps) {
  const completedCount = Object.values(progress).filter(Boolean).length;

  const experiments = [
    {
      id: 'manual',
      num: '01',
      title: 'Feel the Chaos Yourself',
      done: progress.triedManual,
      goal: 'Start the simulation in Manual mode and try balancing the poles using ← / → keys or the push buttons.',
      takeaway:
        'You will feel how fast two coupled inverted poles diverge — human reaction time (~200 ms) is barely fast enough.',
      cta: 'Try Manual Mode',
      onClick: onStartManualExperiment,
    },
    {
      id: 'classical',
      num: '02',
      title: 'Train Classical AI for 25 Tests',
      done: progress.trainedClassical,
      goal: 'Run a 25-round Classical training batch and watch the learning curve climb toward the 8.0 s cap.',
      takeaway:
        'Notice how the 6 reflex weights self-organize without a single human-written control rule.',
      cta: 'Run 25 Classical Rounds',
      onClick: onStartClassicalBatch,
    },
    {
      id: 'kick',
      num: '03',
      title: 'Stress-Test the AI with a Kick',
      done: progress.kickedAI,
      goal: 'Switch to Watch AI, let it stabilize upright, then press Kick to shove the cart sideways.',
      takeaway:
        'Watch the Force Vector arrow fire immediately to catch both poles and pull the cart back toward center.',
      cta: 'Watch AI & Test Kick',
      onClick: onStartWatchAndKick,
    },
    {
      id: 'quantum',
      num: '04',
      title: 'Compare Classical vs Quantum',
      done: progress.trainedQuantum,
      goal: 'Switch to Quantum Mode, train 25 rounds, and compare the Classical vs Quantum curves and best scores.',
      takeaway:
        'Constant measurement noise and back-action kicks create a physical ceiling on stability compared to classical perfection.',
      cta: 'Run 25 Quantum Rounds',
      onClick: onStartQuantumBatch,
    },
  ];

  return (
    <section id="experiments" className="scroll-mt-20 border-t border-slate-200 bg-white py-14">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-blue-700">
              Interactive Lab Notebook
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]">
              Four Hands-On Experiments to Try
            </h2>
            <p className="mt-2 text-base text-slate-600">
              Follow this 4-step presentation sequence to demonstrate the full physics project from
              manual failure to Quantum AI comparison.
            </p>
          </div>

          <div className="font-mono text-sm tabular-nums text-slate-600">
            Completed: <span className="font-semibold text-slate-900">{completedCount} / 4</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          {experiments.map((exp) => (
            <div
              key={exp.id}
              className={`flex flex-col justify-between rounded-xl border p-5 transition-colors ${
                exp.done
                  ? 'border-emerald-200 bg-emerald-50/40'
                  : 'border-slate-200 bg-[#F8FAFC]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono text-xs font-semibold text-slate-500">
                    Experiment {exp.num}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      exp.done ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {exp.done ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Circle className="h-3.5 w-3.5" aria-hidden="true" />
                        Not yet run
                      </>
                    )}
                  </span>
                </div>

                <h3 className="mt-2 font-display text-lg font-semibold text-slate-900">
                  {exp.title}
                </h3>
                <p className="mt-2 text-sm text-slate-700">{exp.goal}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  <strong className="font-semibold text-slate-700">What to observe:</strong>{' '}
                  {exp.takeaway}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={exp.onClick}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 hover:text-blue-900 transition-colors cursor-pointer whitespace-nowrap"
                >
                  {exp.cta}
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
