import { useState } from 'react';
import { CURRICULUM, EP_MAX, type HistoryPoint } from '../physics/cartpoleEngine';

interface TrainingChartProps {
  classicalHist: HistoryPoint[];
  quantumHist: HistoryPoint[];
}

export function TrainingChart({ classicalHist, quantumHist }: TrainingChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const W = 760;
  const H = 220;
  const pl = 46;
  const pr = 20;
  const pt = 18;
  const pb = 32;
  const innerW = W - pl - pr;
  const innerH = H - pt - pb;

  const maxRounds = Math.max(25, classicalHist.length, quantumHist.length);
  const hasData = classicalHist.length > 0 || quantumHist.length > 0;

  const xFor = (idx: number) => pl + (idx / Math.max(1, maxRounds - 1)) * innerW;
  const yFor = (score: number) =>
    H - pb - (Math.min(Math.max(score, 0), EP_MAX) / EP_MAX) * innerH;

  const buildPath = (hist: HistoryPoint[]) => {
    if (hist.length === 0) return '';
    return hist
      .map((ptVal, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(ptVal.s).toFixed(1)}`)
      .join(' ');
  };

  const cPath = buildPath(classicalHist);
  const qPath = buildPath(quantumHist);

  const maxAvailableIdx = Math.max(classicalHist.length, quantumHist.length) - 1;
  const activeIdx =
    hoverIdx !== null && hoverIdx >= 0 && hoverIdx <= maxAvailableIdx ? hoverIdx : null;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!hasData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(1, (relX - pl) / innerW));
    const idx = Math.round(frac * Math.max(1, maxRounds - 1));
    if (idx <= maxAvailableIdx) {
      setHoverIdx(idx);
    } else {
      setHoverIdx(null);
    }
  };

  const hoveredC = activeIdx !== null ? classicalHist[activeIdx] : undefined;
  const hoveredQ = activeIdx !== null ? quantumHist[activeIdx] : undefined;

  return (
    <div className="w-full">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <span className="inline-block h-0.5 w-4 bg-blue-600" aria-hidden="true" />
            Classical ({classicalHist.length} rounds)
          </span>
          <span className="inline-flex items-center gap-2 font-medium text-slate-700">
            <span className="inline-block h-0.5 w-4 bg-violet-600" aria-hidden="true" />
            Quantum ({quantumHist.length} rounds)
          </span>
        </div>

        <div className="font-mono tabular-nums text-slate-500">
          {activeIdx !== null ? (
            <span>
              Round {activeIdx + 1}
              {hoveredC
                ? ` · Classical ${hoveredC.s.toFixed(2)}s (Lv ${hoveredC.stage + 1})`
                : ''}
              {hoveredQ
                ? ` · Quantum ${hoveredQ.s.toFixed(2)}s (Lv ${hoveredQ.stage + 1})`
                : ''}
            </span>
          ) : (
            <span>Hover curve to inspect any round · Cap {EP_MAX}s</span>
          )}
        </div>
      </div>

      <div className="relative rounded-lg border border-slate-200 bg-[#F8FAFC] p-2">
        {!hasData && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="text-sm text-slate-500">
              No training rounds recorded yet. Pick a number of tests and press{' '}
              <span className="font-semibold text-slate-700">Start Training</span> to watch the AI
              improve round by round.
            </p>
          </div>
        )}

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full h-auto cursor-crosshair select-none"
          role="img"
          aria-label="Training score versus round chart for Classical and Quantum modes"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {/* Horizontal grid lines at 0s, 2s, 4s, 6s, 8s */}
          {[0, 2, 4, 6, 8].map((sec) => {
            const y = yFor(sec);
            return (
              <g key={sec}>
                <line
                  x1={pl}
                  y1={y}
                  x2={W - pr}
                  y2={y}
                  stroke={sec === 8 ? '#CBD5E1' : '#E2E8F0'}
                  strokeDasharray={sec === 8 ? '4 4' : undefined}
                  strokeWidth={1}
                />
                <text
                  x={pl - 8}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill="#64748B"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {sec}s
                </text>
              </g>
            );
          })}

          {/* X-axis labels */}
          <text
            x={pl}
            y={H - 8}
            textAnchor="start"
            fontSize={11}
            fill="#64748B"
            fontFamily="IBM Plex Mono, monospace"
          >
            Round 1
          </text>
          <text
            x={pl + innerW / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#64748B"
            fontFamily="IBM Plex Mono, monospace"
          >
            Round {Math.ceil(maxRounds / 2)}
          </text>
          <text
            x={W - pr}
            y={H - 8}
            textAnchor="end"
            fontSize={11}
            fill="#64748B"
            fontFamily="IBM Plex Mono, monospace"
          >
            Round {maxRounds}
          </text>

          {/* Classical curve */}
          {cPath && (
            <path
              d={cPath}
              fill="none"
              stroke="#2563EB"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {classicalHist.length === 1 && (
            <circle cx={xFor(0)} cy={yFor(classicalHist[0].s)} r={4} fill="#2563EB" />
          )}

          {/* Quantum curve */}
          {qPath && (
            <path
              d={qPath}
              fill="none"
              stroke="#7C3AED"
              strokeWidth={2.25}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {quantumHist.length === 1 && (
            <circle cx={xFor(0)} cy={yFor(quantumHist[0].s)} r={4} fill="#7C3AED" />
          )}

          {/* Interactive crosshair */}
          {activeIdx !== null && (
            <g>
              <line
                x1={xFor(activeIdx)}
                y1={pt}
                x2={xFor(activeIdx)}
                y2={H - pb}
                stroke="#94A3B8"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              {hoveredC && (
                <circle
                  cx={xFor(activeIdx)}
                  cy={yFor(hoveredC.s)}
                  r={4.5}
                  fill="#2563EB"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              )}
              {hoveredQ && (
                <circle
                  cx={xFor(activeIdx)}
                  cy={yFor(hoveredQ.s)}
                  r={4.5}
                  fill="#7C3AED"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                />
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Curriculum difficulty key */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>Curriculum wobble stages:</span>
        {CURRICULUM.map((rad, idx) => (
          <span key={rad} className="font-mono tabular-nums text-slate-600">
            Lv {idx + 1} (±{((rad * 180) / Math.PI).toFixed(1)}°)
          </span>
        ))}
      </div>
    </div>
  );
}
