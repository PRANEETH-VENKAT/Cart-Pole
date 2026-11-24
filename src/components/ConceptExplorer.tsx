import {
  CTRL_DT,
  CURRICULUM,
  DT,
  EP_MAX,
  ES_ELITE,
  ES_LR,
  ES_PAIRS,
  ES_STARTS,
  F_MAX,
  G,
  KEY_FORCE,
  KICK_FORCE,
  L1,
  L2,
  M1,
  M2,
  MC,
  Q_FLOOR,
  Q_GROW,
  Q_KICK,
  Q_SHRINK,
  TRACK_HALF,
} from '../physics/cartpoleEngine';

export type ConceptTabId = 'challenge' | 'physics' | 'ai' | 'quantum';

const TABS: Array<{ id: ConceptTabId; num: string; title: string }> = [
  { id: 'challenge', num: '01', title: 'What You Are Seeing' },
  { id: 'physics', num: '02', title: 'Physics & Equations' },
  { id: 'ai', num: '03', title: 'How the AI Learns' },
  { id: 'quantum', num: '04', title: 'Classical vs Quantum' },
];

interface ConceptExplorerProps {
  activeTab: ConceptTabId;
  onTabChange: (tab: ConceptTabId) => void;
}

export function ConceptExplorer({ activeTab, onTabChange }: ConceptExplorerProps) {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-slate-200 py-14">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-700">
            Plain-English Guide
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl [text-wrap:balance]">
            How This Physics &amp; AI Experiment Works
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Never studied control theory or Lagrangian mechanics? No problem. Pick any chapter
            below to see exactly what the simulator is calculating behind the scenes.
          </p>
        </div>

        {/* Interactive Chapter Tabs */}
        <div
          role="tablist"
          aria-label="Concept explanation chapters"
          className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-baseline gap-2.5 rounded-xl border px-4 py-3.5 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`font-mono text-xs font-semibold ${
                    isActive ? 'text-blue-300' : 'text-slate-400'
                  }`}
                >
                  {tab.num}
                </span>
                <span className="text-sm font-semibold whitespace-nowrap truncate">
                  {tab.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chapter Content */}
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          {activeTab === 'challenge' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Imagine balancing a broom on your hand — then stacking a second broom on top
                </h3>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  Everyone has tried balancing a single stick upright on their palm. You watch
                  which way the top leans and quickly slide your hand underneath it. Now imagine
                  attaching a <strong className="font-semibold text-slate-900">second hinged stick</strong>{' '}
                  to the tip of the first one, and restricting your hand to a straight 4-meter
                  track.
                </p>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  That is a <strong className="font-semibold text-slate-900">Double Inverted Pendulum on a Cart</strong>.
                  Because the two poles tug on each other through the middle hinge, pushing the
                  cart right can make the lower pole swing left while whipping the upper pole even
                  faster to the right. It is a classic benchmark of{' '}
                  <strong className="font-semibold text-slate-900">unstable, chaotic dynamics</strong>:
                  a tiny 2-degree lean turns into a complete collapse in under half a second unless
                  controlled continuously.
                </p>

                <div className="pt-2">
                  <h4 className="text-sm font-semibold text-slate-900">
                    The rules of every test run
                  </h4>
                  <ul className="mt-2.5 space-y-2 text-sm text-slate-600">
                    <li>
                      <strong className="text-slate-800">Start position:</strong> Both poles begin
                      nearly upright with a small random wobble (about ±3° in live runs).
                    </li>
                    <li>
                      <strong className="text-slate-800">Only one control:</strong> You (or the AI)
                      can only push the cart left or right along the track — you cannot touch the
                      poles directly.
                    </li>
                    <li>
                      <strong className="text-slate-800">Fail boundaries:</strong> If either pole
                      tilts past <span className="font-mono text-slate-900">±30°</span> or the cart
                      hits the track wall at{' '}
                      <span className="font-mono text-slate-900">±{TRACK_HALF} m</span>, the run
                      resets.
                    </li>
                    <li>
                      <strong className="text-slate-800">Victory cap:</strong> Keeping both poles
                      upright for a full <span className="font-mono text-slate-900">{EP_MAX}.0 seconds</span>{' '}
                      achieves the maximum score.
                    </li>
                  </ul>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-xl bg-[#F8FAFC] border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-900">
                  The 6 Numbers That Describe Everything
                </h4>
                <p className="mt-1 text-xs text-slate-600">
                  At every instant, the simulator tracks just six numbers — the complete physical
                  state vector:
                </p>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ['x', 'Cart position', 'Distance from center of track (meters, −2 to +2).'],
                    ['dx', 'Cart velocity', 'How fast the cart is sliding left or right (m/s).'],
                    ['θ₁', 'Pole 1 angle', 'Tilt of the blue lower pole from straight up (radians).'],
                    ['dθ₁', 'Pole 1 spin', 'How fast the lower pole is rotating (rad/s).'],
                    ['θ₂', 'Pole 2 angle', 'Tilt of the orange upper pole from straight up (radians).'],
                    ['dθ₂', 'Pole 2 spin', 'How fast the upper pole is rotating (rad/s).'],
                  ].map(([sym, name, desc]) => (
                    <div
                      key={sym}
                      className="flex items-start gap-3 border-b border-slate-200/70 pb-2.5 last:border-b-0 last:pb-0"
                    >
                      <dt className="w-10 shrink-0 font-mono text-xs font-semibold text-blue-700 pt-0.5">
                        {sym}
                      </dt>
                      <dd>
                        <div className="font-medium text-slate-900 text-xs">{name}</div>
                        <div className="text-xs text-slate-600 mt-0.5">{desc}</div>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          )}

          {activeTab === 'physics' && (
            <div id="physics-math" className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Real Newtonian &amp; Lagrangian Mechanics — 500 Steps Every Second
                </h3>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  Instead of fake animations, this simulation derives exact equations of motion
                  from the <strong className="font-semibold text-slate-900">Euler–Lagrange equation</strong>{' '}
                  (Kinetic Energy minus Potential Energy). Because the cart and two hinged rods
                  accelerate together, their motions are coupled in a{' '}
                  <span className="font-mono text-slate-900">3×3</span> matrix system:
                </p>

                <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] p-4 font-mono text-sm text-slate-900 overflow-x-auto">
                  <div>M(q) · q̈ = Q − bias(q, q̇)</div>
                  <div className="mt-2 text-xs text-slate-600">
                    where q = [x, θ₁, θ₂]ᵀ · M(q) is the 3×3 angle-dependent mass matrix · Q = [Force, 0, 0]ᵀ
                  </div>
                </div>

                <div className="space-y-3 pt-1 text-sm leading-relaxed text-slate-600">
                  <p>
                    <strong className="font-semibold text-slate-900">1. Gaussian Elimination (solve3):</strong>{' '}
                    At each micro-step, the code solves <span className="font-mono">M · acc = rhs</span>{' '}
                    with partial pivoting to find the exact instantaneous accelerations{' '}
                    <span className="font-mono">[ẍ, θ̈₁, θ̈₂]</span> of the cart and both poles.
                  </p>
                  <p>
                    <strong className="font-semibold text-slate-900">2. Runge-Kutta 4th Order (RK4):</strong>{' '}
                    Simple physics loops drift and lose energy quickly. Instead, RK4 peeks ahead
                    four times (<span className="font-mono">k₁, k₂, k₃, k₄</span>) across every{' '}
                    <span className="font-mono">{(DT * 1000).toFixed(0)} ms</span> step and blends
                    them with weights <span className="font-mono">(1, 2, 2, 1)/6</span> for high
                    numerical accuracy.
                  </p>
                  <p>
                    <strong className="font-semibold text-slate-900">3. Coupling Terms:</strong>{' '}
                    Notice how gravity pulls both poles outward (<span className="font-mono">g·Kₐ·sin θ₁</span>),
                    while spinning terms (<span className="font-mono">sin(θ₁ − θ₂)·dθ²</span>) create
                    the nonlinear whip effect between Pole 1 and Pole 2.
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-xl bg-[#F8FAFC] border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-900">
                  Exact Physical Parameters (Unchanged Core)
                </h4>
                <table className="mt-3 w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-200/80">
                    {[
                      ['Gravity (g)', `${G} m/s²`],
                      ['Cart mass (m_c)', `${MC.toFixed(1)} kg`],
                      ['Pole 1 length & mass', `${L1} m · ${M1} kg`],
                      ['Pole 2 length & mass', `${L2} m · ${M2} kg`],
                      ['Physics step (dt)', `${DT} s (500 Hz)`],
                      ['Control / AI tick', `${CTRL_DT} s (50 Hz)`],
                      ['Manual push / Kick', `±${KEY_FORCE} N / ±${KICK_FORCE} N`],
                      ['AI force limit', `±${F_MAX} N`],
                      ['Track length', `−${TRACK_HALF} m to +${TRACK_HALF} m`],
                    ].map(([label, val]) => (
                      <tr key={label}>
                        <td className="py-2 text-slate-600">{label}</td>
                        <td className="py-2 text-right font-mono font-medium tabular-nums text-slate-900">
                          {val}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="max-w-3xl">
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Evolution Strategy: Learning by Fast Trial-and-Error (No Deep Neural Net Needed!)
                </h3>
                <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
                  When people hear &ldquo;AI&rdquo;, they often picture giant neural networks. Here,
                  the AI is astonishingly clean and transparent: it has only{' '}
                  <strong className="font-semibold text-slate-900">6 reflex weights</strong>. At the
                  start, all 6 weights are zero (so it does nothing and falls immediately). Each
                  training round follows four simple evolutionary steps:
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    step: 'Step 1 · Mutate',
                    stat: `${ES_PAIRS * 2} candidates`,
                    body: `Creates ${ES_PAIRS} random mirrored pairs (+δ and −δ) around the current 6 weights to explore better reflexes in both directions.`,
                  },
                  {
                    step: 'Step 2 · Test Run',
                    stat: `${ES_STARTS} rollouts each`,
                    body: `Simulates each candidate in fast headless physics (up to ${EP_MAX}s). Candidates score higher for staying alive longer AND staying closer to straight upright.`,
                  },
                  {
                    step: 'Step 3 · Keep Elites',
                    stat: `Top ${ES_ELITE} winners`,
                    body: `Sorts all ${ES_PAIRS * 2} candidates, averages the top ${ES_ELITE} survivors, and shifts the brain ${(ES_LR * 100).toFixed(0)}% toward their average.`,
                  },
                  {
                    step: 'Step 4 · Level Up',
                    stat: `${CURRICULUM.length} stages`,
                    body: `Starts with tiny ±${((CURRICULUM[0] * 180) / Math.PI).toFixed(1)}° wobbles. Once the AI averages ≥90% of the ${EP_MAX}s cap, it graduates to wider starting angles up to ±${((CURRICULUM[CURRICULUM.length - 1] * 180) / Math.PI).toFixed(1)}°.`,
                  },
                ].map((card) => (
                  <div
                    key={card.step}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4"
                  >
                    <div className="text-xs font-semibold text-blue-700">{card.step}</div>
                    <div className="mt-1 font-mono text-lg font-semibold text-slate-900">
                      {card.stat}
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-600">{card.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'quantum' && (
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-4">
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Why Is Quantum Mode Harder? The Measurement Back-Action Trade-Off
                </h3>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  In <strong className="font-semibold text-slate-900">Classical Mode</strong>, the AI
                  reads the exact angle of both poles without disturbing them. In{' '}
                  <strong className="font-semibold text-slate-900">Quantum Mode</strong>, the
                  simulator models a fundamental principle inspired by the Heisenberg uncertainty
                  principle: <strong className="font-semibold text-slate-900">looking at a system changes it</strong>.
                </p>
                <p className="text-[15px] leading-relaxed text-slate-600">
                  Between measurements, our certainty about where the poles are spreads out — shown
                  on screen as a purple cloud of 30 faint ghost pendulums with spread{' '}
                  <span className="font-mono text-slate-900">σ</span>. Every{' '}
                  <span className="font-mono text-slate-900">{CTRL_DT} s</span>, the controller takes
                  a measurement: it gets a <strong className="text-slate-900">noisy angle reading</strong>{' '}
                  proportional to <span className="font-mono">σ</span>, the cloud collapses to half
                  its width, and both poles suffer an unavoidable{' '}
                  <strong className="text-slate-900">random momentum kick (back-action)</strong>.
                </p>
                <p className="text-sm text-slate-600">
                  <strong className="text-slate-900">Warm-Start Transfer:</strong> If you train
                  Classical Mode first and then train Quantum Mode, the code copies your Classical
                  weights as a starting head-start — then adapts them to survive constant quantum
                  kicks and sensor noise!
                </p>
              </div>

              <div className="lg:col-span-5 rounded-xl bg-[#F8FAFC] border border-slate-200 p-5">
                <h4 className="text-sm font-semibold text-slate-900">
                  Side-by-Side Comparison
                </h4>
                <div className="mt-4 space-y-3 text-xs">
                  <div className="rounded-lg border border-blue-200 bg-white p-3.5">
                    <div className="font-semibold text-blue-700">Classical Physics Mode</div>
                    <ul className="mt-1.5 space-y-1 text-slate-600">
                      <li>Exact pole angles θ₁, θ₂ read with zero noise.</li>
                      <li>No disturbance when observing the poles.</li>
                      <li>Deterministic response — smooth, calm balance.</li>
                    </ul>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-white p-3.5">
                    <div className="font-semibold text-violet-700">Quantum Measurement Mode</div>
                    <ul className="mt-1.5 space-y-1 text-slate-600">
                      <li>
                        Cloud variance grows at <span className="font-mono">{Q_GROW} rad²/s</span>{' '}
                        between ticks.
                      </li>
                      <li>
                        Reading adds Gaussian noise <span className="font-mono">N(0, σ)</span> to
                        both angles.
                      </li>
                      <li>
                        Back-action adds random spin kick{' '}
                        <span className="font-mono">±{Q_KICK} rad/s</span> to both poles.
                      </li>
                      <li>
                        Cloud shrinks by <span className="font-mono">{Q_SHRINK * 100}%</span> after
                        measurement (floor <span className="font-mono">{Q_FLOOR} rad</span>).
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
