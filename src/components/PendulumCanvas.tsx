import { useEffect, useRef } from 'react';
import {
  L1,
  L2,
  MAX_ANGLE,
  TRACK_HALF,
  type CartpoleState,
  type QuantumState,
  type SimPlaybackStatus,
} from '../physics/cartpoleEngine';

export interface CanvasOverlayOptions {
  showForceVector: boolean;
  showAngleGuides: boolean;
  showTipTrail: boolean;
  showLabels: boolean;
}

export interface CanvasRenderSnapshot {
  state: CartpoleState;
  qState: QuantumState;
  quantumOn: boolean;
  aiOn: boolean;
  ghostZ: Array<[number, number]>;
  activeForce: number;
  tipTrail: Array<{ x: number; y: number }>;
  simStatus: SimPlaybackStatus;
}

interface PendulumCanvasProps {
  renderRef: React.MutableRefObject<CanvasRenderSnapshot>;
  overlays: CanvasOverlayOptions;
  drawSignalRef: React.MutableRefObject<(() => void) | null>;
}

const LOGICAL_W = 900;
const LOGICAL_H = 500;
const PX = 200;        // exact pixels per metre from original code
const PIVOT_Y = 340;   // screen y of the cart's top pivot
const CART_W = 90;
const CART_H = 34;

export function PendulumCanvas({
  renderRef,
  overlays,
  drawSignalRef,
}: PendulumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const toScreenX = (x: number) => LOGICAL_W / 2 + x * PX;

    const drawLine = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      color: string,
      width: number
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    const drawJoint = (x: number, y: number, radius = 6) => {
      ctx.fillStyle = '#0B111E';
      ctx.beginPath();
      ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F1F5F9';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawFrame = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(LOGICAL_W * dpr);
      const targetH = Math.round(LOGICAL_H * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const snap = renderRef.current;
      const ov = overlaysRef.current;
      const { state, qState, quantumOn, ghostZ, activeForce, tipTrail } = snap;
      const groundY = PIVOT_Y + CART_H;
      const pivotX = toScreenX(state.x);

      // Deep calibrated slate oscilloscope background
      ctx.fillStyle = '#0B111E';
      ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

      // Subtle metric coordinate grid (every 0.5 m = 100 px)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      for (let m = -2; m <= 2; m += 0.5) {
        const gx = toScreenX(m);
        ctx.beginPath();
        ctx.moveTo(gx, 24);
        ctx.lineTo(gx, groundY);
        ctx.stroke();
      }
      for (let y = PIVOT_Y - 260; y <= groundY; y += 65) {
        ctx.beginPath();
        ctx.moveTo(toScreenX(-TRACK_HALF), y);
        ctx.lineTo(toScreenX(TRACK_HALF), y);
        ctx.stroke();
      }

      // Track rail, end stops, and meter ruler labels
      drawLine(toScreenX(-TRACK_HALF), groundY, toScreenX(TRACK_HALF), groundY, '#334155', 2.5);
      drawLine(toScreenX(-TRACK_HALF), groundY - 22, toScreenX(-TRACK_HALF), groundY + 6, '#475569', 3);
      drawLine(toScreenX(TRACK_HALF), groundY - 22, toScreenX(TRACK_HALF), groundY + 6, '#475569', 3);

      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#64748B';
      ctx.textAlign = 'center';
      for (let m = -2; m <= 2; m += 0.5) {
        const tx = toScreenX(m);
        const tickH = Number.isInteger(m) ? 8 : 4;
        drawLine(tx, groundY, tx, groundY + tickH, '#334155', 1.2);
        if (Number.isInteger(m)) {
          ctx.fillText(`${m > 0 ? '+' : ''}${m} m`, tx, groundY + 24);
        }
      }

      // Optional +/- 30 degree safe-zone protractor & limit guides
      if (ov.showAngleGuides) {
        const guideLen = 270;
        const arcR = 90;

        // Safe sector tint
        ctx.fillStyle = 'rgba(96, 165, 250, 0.045)';
        ctx.beginPath();
        ctx.moveTo(pivotX, PIVOT_Y);
        ctx.arc(
          pivotX,
          PIVOT_Y,
          arcR,
          -Math.PI / 2 - MAX_ANGLE,
          -Math.PI / 2 + MAX_ANGLE
        );
        ctx.closePath();
        ctx.fill();

        // Protractor arc
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(
          pivotX,
          PIVOT_Y,
          arcR,
          -Math.PI / 2 - MAX_ANGLE,
          -Math.PI / 2 + MAX_ANGLE
        );
        ctx.stroke();

        // Vertical upright reference
        ctx.setLineDash([3, 5]);
        drawLine(pivotX, PIVOT_Y, pivotX, PIVOT_Y - guideLen, 'rgba(148, 163, 184, 0.22)', 1);

        // Dashed 30-degree reset boundary lines
        ctx.setLineDash([5, 6]);
        drawLine(
          pivotX,
          PIVOT_Y,
          pivotX - guideLen * Math.sin(MAX_ANGLE),
          PIVOT_Y - guideLen * Math.cos(MAX_ANGLE),
          'rgba(248, 113, 113, 0.42)',
          1.2
        );
        drawLine(
          pivotX,
          PIVOT_Y,
          pivotX + guideLen * Math.sin(MAX_ANGLE),
          PIVOT_Y - guideLen * Math.cos(MAX_ANGLE),
          'rgba(248, 113, 113, 0.42)',
          1.2
        );
        ctx.setLineDash([]);

        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillStyle = 'rgba(248, 113, 113, 0.78)';
        ctx.textAlign = 'right';
        ctx.fillText(
          '-30°',
          pivotX - (arcR + 10) * Math.sin(MAX_ANGLE) - 4,
          PIVOT_Y - (arcR + 10) * Math.cos(MAX_ANGLE)
        );
        ctx.textAlign = 'left';
        ctx.fillText(
          '+30°',
          pivotX + (arcR + 10) * Math.sin(MAX_ANGLE) + 4,
          PIVOT_Y - (arcR + 10) * Math.cos(MAX_ANGLE)
        );
      }

      // Optional pole 2 tip motion trail
      if (ov.showTipTrail && tipTrail.length > 1) {
        for (let i = 1; i < tipTrail.length; i++) {
          const alpha = (i / tipTrail.length) * 0.5;
          ctx.strokeStyle = `rgba(251, 146, 60, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tipTrail[i - 1].x, tipTrail[i - 1].y);
          ctx.lineTo(tipTrail[i].x, tipTrail[i].y);
          ctx.stroke();
        }
      }

      // Pole 1 & Pole 2 positions (exact original kinematics)
      const j1x = pivotX + L1 * PX * Math.sin(state.th1);
      const j1y = PIVOT_Y - L1 * PX * Math.cos(state.th1);
      const j2x = j1x + L2 * PX * Math.sin(state.th2);
      const j2y = j1y - L2 * PX * Math.cos(state.th2);

      // Quantum cloud: faint ghost copies of both poles (exact N_GHOST = 30 logic)
      if (quantumOn) {
        ctx.save();
        ctx.globalAlpha = 0.085;
        for (const [z1, z2] of ghostZ) {
          const g1 = state.th1 + z1 * qState.sigma;
          const g2 = state.th2 + z2 * qState.sigma;
          const gx = pivotX + L1 * PX * Math.sin(g1);
          const gy = PIVOT_Y - L1 * PX * Math.cos(g1);
          drawLine(pivotX, PIVOT_Y, gx, gy, '#A855F7', 7);
          drawLine(
            gx,
            gy,
            gx + L2 * PX * Math.sin(g2),
            gy - L2 * PX * Math.cos(g2),
            '#C084FC',
            7
          );
        }
        ctx.restore();
      }

      // Cart body and wheels
      ctx.fillStyle = '#1E293B';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(pivotX - CART_W / 2, PIVOT_Y, CART_W, CART_H, 6);
      ctx.fill();
      ctx.stroke();

      // Cart wheels
      ctx.fillStyle = '#64748B';
      ctx.beginPath();
      ctx.arc(pivotX - 25, groundY, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pivotX + 25, groundY, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(pivotX - 25, groundY, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pivotX + 25, groundY, 2.2, 0, Math.PI * 2);
      ctx.fill();

      // Live Force Vector Arrow on the cart
      if (ov.showForceVector && Math.abs(activeForce) > 0.3) {
        const dir = Math.sign(activeForce);
        const len = Math.min(110, Math.max(18, Math.abs(activeForce) * 3.2));
        const startX = pivotX + dir * (CART_W / 2 + 6);
        const endX = startX + dir * len;
        const fy = PIVOT_Y + CART_H / 2;

        drawLine(startX, fy, endX, fy, '#38BDF8', 3);
        ctx.fillStyle = '#38BDF8';
        ctx.beginPath();
        ctx.moveTo(endX + dir * 7, fy);
        ctx.lineTo(endX - dir * 2, fy - 5);
        ctx.lineTo(endX - dir * 2, fy + 5);
        ctx.closePath();
        ctx.fill();

        ctx.font = '600 11px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#7DD3FC';
        ctx.textAlign = dir > 0 ? 'left' : 'right';
        ctx.fillText(
          `${activeForce > 0 ? '+' : ''}${activeForce.toFixed(1)} N`,
          endX + dir * 10,
          fy + 4
        );
      }

      // Draw Pole 1 (lower) and Pole 2 (upper)
      drawLine(pivotX, PIVOT_Y, j1x, j1y, '#60A5FA', 8);
      drawLine(j1x, j1y, j2x, j2y, '#FB923C', 8);

      // Joints
      drawJoint(pivotX, PIVOT_Y, 5.5);
      drawJoint(j1x, j1y, 5.5);
      drawJoint(j2x, j2y, 5.5);

      // Optional educational callout labels directly on the diagram
      if (ov.showLabels) {
        ctx.font = '500 13px "IBM Plex Mono", monospace';
        const p1MidX = (pivotX + j1x) / 2;
        const p1MidY = (PIVOT_Y + j1y) / 2;
        const p2MidX = (j1x + j2x) / 2;
        const p2MidY = (j1y + j2y) / 2;

        ctx.textAlign = 'left';
        ctx.fillStyle = '#93C5FD';
        ctx.fillText('Pole 1 (0.6m · 0.3kg)', p1MidX + 14, p1MidY + 4);

        ctx.fillStyle = '#FDBA74';
        ctx.fillText('Pole 2 (0.5m · 0.2kg)', p2MidX + 14, p2MidY + 4);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#94A3B8';
        ctx.fillText('Cart (1.0 kg)', pivotX, groundY + 44);

        if (quantumOn) {
          ctx.textAlign = 'right';
          ctx.fillStyle = '#D8B4FE';
          ctx.fillText(
            `Quantum Cloud σ = ${((qState.sigma * 180) / Math.PI).toFixed(2)}°`,
            LOGICAL_W - 22,
            34
          );
        }
      }

      // Top-left crisp instrument state caption inside viewport
      ctx.font = '600 12.5px "IBM Plex Mono", monospace';
      ctx.textAlign = 'left';
      const statusLabel =
        snap.simStatus === 'running'
          ? snap.aiOn
            ? 'LIVE · AI AUTOPILOT'
            : 'LIVE · MANUAL CONTROL'
          : snap.simStatus === 'paused'
            ? 'PAUSED · INSPECTING FRAME'
            : 'READY · PRESS START TO BEGIN';
      ctx.fillStyle =
        snap.simStatus === 'running'
          ? '#34D399'
          : snap.simStatus === 'paused'
            ? '#FBBF24'
            : '#94A3B8';
      ctx.fillText(statusLabel, 22, 34);

      ctx.restore();
    };

    drawSignalRef.current = drawFrame;
    drawFrame();

    return () => {
      drawSignalRef.current = null;
    };
  }, [renderRef, drawSignalRef]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="pendulum-canvas"
      aria-label="Interactive Double Inverted Pendulum on a Cart simulation canvas"
      className="block w-full aspect-[9/5] rounded-xl border border-slate-800 bg-[#0B111E]"
    />
  );
}
