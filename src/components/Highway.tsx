import { useEffect, useRef } from 'react';
import { FRET_COLORS_5 } from '../chart/tracks';
import { buildBeatLines } from '../chart/timeMap';
import type { InstrumentTrack, ParsedChart } from '../chart/types';

interface HighwayProps {
  chart: ParsedChart;
  track: InstrumentTrack;
  currentTick: number;
  /** How many ticks visible above the strike line */
  visibleTicks: number;
  className?: string;
}

const LANE_GAP = 0.012;
const NOTE_H = 14;

export function Highway({ chart, track, currentTick, visibleTicks, className }: HighwayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = wrap.clientWidth;
      const cssH = wrap.clientHeight;
      const w = Math.max(1, Math.floor(cssW * dpr));
      const h = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const width = cssW;
      const height = cssH;

      // Atmosphere
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0b0f14');
      bg.addColorStop(0.55, '#121820');
      bg.addColorStop(1, '#1a222c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // Perspective side rails
      const highwayLeft = width * 0.18;
      const highwayRight = width * 0.82;
      const highwayWidth = highwayRight - highwayLeft;
      const strikeY = height * 0.82;

      // Highway bed
      ctx.fillStyle = '#151b24';
      ctx.beginPath();
      ctx.moveTo(highwayLeft - 18, 0);
      ctx.lineTo(highwayRight + 18, 0);
      ctx.lineTo(highwayRight + 8, height);
      ctx.lineTo(highwayLeft - 8, height);
      ctx.closePath();
      ctx.fill();

      // Subtle asphalt grain
      ctx.fillStyle = 'rgba(255,255,255,0.015)';
      for (let i = 0; i < 40; i++) {
        const gx = highwayLeft + ((i * 97) % highwayWidth);
        const gy = ((i * 53 + currentTick * 0.02) % height);
        ctx.fillRect(gx, gy, 2, 2);
      }

      const laneCount = 5;
      const laneWidth = highwayWidth / laneCount;

      // Star power phrases behind notes
      for (const phrase of track.phrases) {
        if (phrase.type !== 2) continue;
        const start = phrase.tick;
        const end = phrase.tick + phrase.length;
        if (end < currentTick || start > currentTick + visibleTicks) continue;
        const y1 = tickToY(end, currentTick, visibleTicks, strikeY);
        const y2 = tickToY(start, currentTick, visibleTicks, strikeY);
        const top = Math.min(y1, y2);
        const bot = Math.max(y1, y2);
        const grad = ctx.createLinearGradient(0, top, 0, bot);
        grad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
        grad.addColorStop(1, 'rgba(56, 189, 248, 0.22)');
        ctx.fillStyle = grad;
        ctx.fillRect(highwayLeft, top, highwayWidth, bot - top);
      }

      // Beat / measure lines
      const beatLines = buildBeatLines(
        Math.max(track.maxTick, currentTick + visibleTicks),
        chart.timeSigs,
        chart.meta.resolution,
      );
      for (const line of beatLines) {
        if (line.tick < currentTick - chart.meta.resolution || line.tick > currentTick + visibleTicks) {
          continue;
        }
        const y = tickToY(line.tick, currentTick, visibleTicks, strikeY);
        if (y < -20 || y > height + 20) continue;
        ctx.strokeStyle = line.isMeasure ? 'rgba(232, 236, 241, 0.22)' : 'rgba(232, 236, 241, 0.08)';
        ctx.lineWidth = line.isMeasure ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(highwayLeft, y);
        ctx.lineTo(highwayRight, y);
        ctx.stroke();
      }

      // Lane dividers + glow rails
      for (let i = 0; i <= laneCount; i++) {
        const x = highwayLeft + i * laneWidth;
        ctx.strokeStyle = i === 0 || i === laneCount ? 'rgba(232,236,241,0.35)' : 'rgba(232,236,241,0.08)';
        ctx.lineWidth = i === 0 || i === laneCount ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Freeline gems at strike
      for (let i = 0; i < laneCount; i++) {
        const x = highwayLeft + (i + 0.5) * laneWidth;
        ctx.beginPath();
        ctx.arc(x, strikeY, laneWidth * 0.28, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = FRET_COLORS_5[i];
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Strike line
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(248,250,252,0.35)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(highwayLeft - 4, strikeY);
      ctx.lineTo(highwayRight + 4, strikeY);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Notes
      const notes = track.notes;
      const pad = chart.meta.resolution;
      for (const note of notes) {
        const noteEnd = note.tick + Math.max(note.sustain, 0);
        if (noteEnd < currentTick - pad || note.tick > currentTick + visibleTicks + pad) continue;

        if (note.isOpen) {
          const y = tickToY(note.tick, currentTick, visibleTicks, strikeY);
          if (y < -40 || y > height + 40) continue;
          drawOpenNote(ctx, highwayLeft, highwayRight, y, note.kind);
          if (note.sustain > 0) {
            const yEnd = tickToY(note.tick + note.sustain, currentTick, visibleTicks, strikeY);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.35)';
            ctx.fillRect(highwayLeft + 10, Math.min(y, yEnd), highwayWidth - 20, Math.abs(y - yEnd));
          }
          continue;
        }

        for (const fret of note.frets) {
          const x = highwayLeft + (fret + 0.5) * laneWidth;
          const y = tickToY(note.tick, currentTick, visibleTicks, strikeY);
          const color = FRET_COLORS_5[fret];

          if (note.sustain > 0) {
            const yEnd = tickToY(note.tick + note.sustain, currentTick, visibleTicks, strikeY);
            const top = Math.min(y, yEnd);
            const bot = Math.max(y, yEnd);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.45;
            ctx.fillRect(x - 5, top, 10, bot - top);
            ctx.globalAlpha = 1;
          }

          if (y < -40 || y > height + 40) continue;
          drawGem(ctx, x, y, laneWidth * (0.36 - LANE_GAP), color, note.kind);
        }
      }

      // Top fade
      const fade = ctx.createLinearGradient(0, 0, 0, height * 0.18);
      fade.addColorStop(0, 'rgba(11,15,20,0.9)');
      fade.addColorStop(1, 'rgba(11,15,20,0)');
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height * 0.18);
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => draw();
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [chart, track, currentTick, visibleTicks]);

  return (
    <div ref={wrapRef} className={className}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

function tickToY(tick: number, currentTick: number, visibleTicks: number, strikeY: number): number {
  const rel = tick - currentTick;
  return strikeY - (rel / visibleTicks) * strikeY;
}

function drawGem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  kind: 'strum' | 'hopo' | 'tap' | 'open',
) {
  ctx.save();
  ctx.translate(x, y);

  if (kind === 'tap') {
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.55, r * 2, r * 1.1, r * 0.35);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  } else if (kind === 'hopo') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fillStyle = '#0b0f14';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = color;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    // strum — beveled gem
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.92, -r * 0.2);
    ctx.lineTo(r * 0.7, r * 0.85);
    ctx.lineTo(-r * 0.7, r * 0.85);
    ctx.lineTo(-r * 0.92, -r * 0.2);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -r, 0, r);
    grad.addColorStop(0, shade(color, 1.25));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, 0.65));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.stroke();
  }

  ctx.restore();
}

function drawOpenNote(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
  kind: 'strum' | 'hopo' | 'tap' | 'open',
) {
  const h = kind === 'tap' ? NOTE_H * 0.85 : NOTE_H;
  ctx.fillStyle = '#a855f7';
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.roundRect(left + 8, y - h / 2, right - left - 16, h, 6);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function shade(hex: string, factor: number): string {
  const n = hex.replace('#', '');
  const num = Number.parseInt(n, 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.min(255, Math.max(0, Math.round(r * factor)));
  g = Math.min(255, Math.max(0, Math.round(g * factor)));
  b = Math.min(255, Math.max(0, Math.round(b * factor)));
  return `rgb(${r},${g},${b})`;
}
