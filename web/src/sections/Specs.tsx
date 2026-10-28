'use client';

import { useEffect, useRef } from 'react';
import { specs } from '../content/copy';
import { fx } from '../three/bus';
import { KeyCap } from '../nav/Menu';
import shell from './Shells.module.css';
import s from './Sections.module.css';

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(Math.max((v - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * S: the exploded board. The keyboard (Keyboard.tsx) projects one anchor per layer every frame; this draws a
 * leader line from each anchor to its row in the parts list, drawn in as the board comes apart.
 */
export function Specs() {
  const svg = useRef<SVGSVGElement>(null);
  const rows = useRef<(HTMLElement | null)[]>([]);
  const lines = useRef<(SVGPolylineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);
  const nums = useRef<(SVGTextElement | null)[]>([]);

  useEffect(() => {
    let shown = -1;
    // Each row number's left edge and middle in page coordinates, measured once per layout change
    // (offsets ignore the rows' rise transforms, so a mid-animation measure is still right).
    let rowAt: number[][] | null = null;
    const ro = new ResizeObserver(() => (rowAt = null));
    ro.observe(document.body);
    const measure = () =>
      rows.current.map((row) => {
        const num = row!.firstElementChild as HTMLElement;
        let x = 0, y = 0;
        for (let e: HTMLElement | null = num; e; e = e.offsetParent as HTMLElement | null) {
          x += e.offsetLeft;
          y += e.offsetTop;
        }
        return [x, y + num.offsetHeight / 2];
      });
    fx.leaders = (pts, explode) => {
      const k = smooth(0.5, 0.95, explode);
      if (k !== shown) svg.current!.style.opacity = String(k);
      shown = k;
      if (k <= 0) return;
      const n = rows.current.length;
      let right = 0;
      for (let i = 0; i < n; i++) right = Math.max(right, pts[i * 2]);
      rowAt ??= measure();
      const ends = rowAt.map(([x, y]) => [x - 12 - scrollX, y - scrollY]);
      // Orthogonal routing: out to its own column, along to the row's height, in to the row. Columns are
      // staggered so the lines never cross (lower parts turn first while the rows sit below the parts).
      const down = ends[0][1] > pts[1];
      rows.current.forEach((_, i) => {
        const x = pts[i * 2], y = pts[i * 2 + 1];
        const [ex, ey] = ends[i];
        const col = Math.min(right + 18 + (down ? n - 1 - i : i) * 9, ex - 16);
        lines.current[i]!.setAttribute('points', `${x},${y} ${col},${y} ${col},${ey} ${ex},${ey}`);
        lines.current[i]!.style.strokeDashoffset = String(1 - k);
        dots.current[i]!.setAttribute('cx', String(x));
        dots.current[i]!.setAttribute('cy', String(y));
        nums.current[i]!.setAttribute('x', String(x + 10));
        nums.current[i]!.setAttribute('y', String(y - 8));
      });
    };
    return () => {
      ro.disconnect();
      fx.leaders = null;
    };
  }, []);

  const hot = (i: number, on: boolean) => lines.current[i]?.parentElement?.classList.toggle(s.hot, on);

  return (
    <section id="specs" className={shell.section} data-side="right" aria-labelledby="specs-title">
      <svg ref={svg} className={s.leaders} aria-hidden="true" style={{ opacity: 0 }}>
        {specs.layers.map((l, i) => (
          <g key={l.id}>
            <polyline ref={(el) => void (lines.current[i] = el)} pathLength={1} />
            <circle ref={(el) => void (dots.current[i] = el)} r={3.5} />
            <text ref={(el) => void (nums.current[i] = el)}>{l.n}</text>
          </g>
        ))}
      </svg>
      <div className={shell.body}>
        <p className={shell.eyebrow} data-rise>
          <KeyCap k="S" /> Specs
        </p>
        <h2 id="specs-title" className={shell.title} data-reveal>
          {specs.title}
        </h2>
        <p className={shell.copy} data-rise>{specs.lead}</p>

        <ol className={s.layers} data-rise aria-label="Layers, top to bottom">
          {specs.layers.map((l, i) => (
            <li key={l.id} ref={(el) => void (rows.current[i] = el)} onPointerEnter={() => hot(i, true)} onPointerLeave={() => hot(i, false)}>
              <span className={s.num}>{l.n}</span>
              <span className={s.layerName}>{l.name}</span>
              <span className={s.layerDetail}>{l.detail}</span>
            </li>
          ))}
        </ol>

        <dl className={s.figures} data-rise>
          {specs.figures.map((f) => (
            <div key={f.k}>
              <dt>{f.k}</dt>
              <dd>
                <b>{f.v}</b>
                <span>{f.sub}</span>
              </dd>
            </div>
          ))}
        </dl>
        <p className={s.fine} data-rise>{specs.concept}</p>
      </div>
    </section>
  );
}
