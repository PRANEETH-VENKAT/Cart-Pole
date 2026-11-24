import { ES_SCALE, F_MAX, type ModeKey } from '../physics/cartpoleEngine';

interface BrainInspectorProps {
  mode: ModeKey;
  weights: number[];
  trainedRounds: number;
  currentForce: number;
  aiOn: boolean;
}

const WEIGHT_META = [
  {
    symbol: 'w₁ · x',
    label: 'Cart Position',
    plain: 'Pulls the cart gently back toward the center of the track.',
  },
  {
    symbol: 'w₂ · dx',
    label: 'Cart Velocity',
    plain: 'Damps fast sideways motion so the cart does not overshoot.',
  },
  {
    symbol: 'w₃ · θ₁',
    label: 'Pole 1 Tilt',
    plain: 'Reacts when the lower pole starts leaning left or right.',
  },
  {
    symbol: 'w₄ · dθ₁',
    label: 'Pole 1 Spin',
    plain: 'Responds to how fast the lower pole is currently falling.',
  },
  {
    symbol: 'w₅ · θ₂',
    label: 'Pole 2 Tilt',
    plain: 'Reacts to the upper pole angle — usually the strongest reflex.',
  },
  {
    symbol: 'w₆ · dθ₂',
    label: 'Pole 2 Spin',
    plain: 'Anticipates the whip-like swing of the top pole before it tips.',
  },
] as const;

export function BrainInspector({
  mode,
  weights,
  trainedRounds,
  currentForce,
  aiOn,
}: BrainInspectorProps) {
  const accentBar = mode === 'q' ? 'bg-violet-600' : 'bg-blue-600';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900">
            Inside the AI Brain (6 Reflex Weights)
          </h3>
          <p className="mt-0.5 text-sm text-slate-600">
            The AI is not a black box — it multiplies 6 live measurements by these 6 numbers to
            decide how hard to push the cart.
          </p>
        </div>
        <div className="font-mono text-xs tabular-nums text-slate-500">
          {mode === 'q' ? 'Quantum policy' : 'Classical policy'} · {trainedRounds} rounds
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-[#F8FAFC] border border-slate-200/80 px-3.5 py-2.5 font-mono text-xs text-slate-700 flex flex-wrap items-center justify-between gap-2">
        <span>Force = clamp(w₁·x + w₂·dx + w₃·θ₁ + w₄·dθ₁ + w₅·θ₂ + w₆·dθ₂, −{F_MAX} N, +{F_MAX} N)</span>
        <span className="tabular-nums font-semibold text-slate-900">
          {aiOn ? `Live AI output: ${currentForce >= 0 ? '+' : ''}${currentForce.toFixed(1)} N` : 'Enable Watch AI to see live output'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {WEIGHT_META.map((item, idx) => {
          const val = weights[idx] ?? 0;
          const refScale = ES_SCALE[idx] * 2.2;
          const pct = Math.min(100, (Math.abs(val) / refScale) * 100);
          return (
            <div
              key={item.symbol}
              className="rounded-lg border border-slate-200/90 bg-[#F8FAFC] p-3"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">{item.label}</span>
                <span className="font-mono text-xs font-semibold tabular-nums text-slate-900">
                  {val >= 0 ? '+' : ''}
                  {val.toFixed(2)}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-slate-500">{item.symbol}</div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full transition-transform duration-150 origin-left ${
                    val < 0 ? 'bg-amber-600' : accentBar
                  }`}
                  style={{ width: `${pct.toFixed(1)}%` }}
                />
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{item.plain}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
