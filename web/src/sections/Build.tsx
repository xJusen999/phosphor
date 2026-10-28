'use client';

import { OPTIONS, priceOf, type BuildConfig } from '@phosphor/shared';
import { build } from '../content/copy';
import { ensureAudio, playSwitch } from '../audio/switches';
import { useBuild } from '../state/build';
import { KeyCap } from '../nav/Menu';
import shell from './Shells.module.css';
import s from './Product.module.css';

type Group = keyof BuildConfig;
const GROUPS: Group[] = ['caseFinish', 'keycaps', 'switchType'];

/** A dollar amount whose digits roll to the new value (each digit is a 0–9 strip). */
export function Price({ value, live = false, className }: { value: number; live?: boolean; className?: string }) {
  const digits = String(value).split('');
  return (
    <span className={`${s.price} ${className ?? ''}`}>
      <span className="sr-only" aria-live={live ? 'polite' : undefined}>${value}</span>
      <span aria-hidden="true" className={s.roll}>
        $
        {digits.map((d, i) => (
          // Keyed from the right, so the units digit stays the units digit when the length changes.
          <span key={digits.length - i} className={s.digit}>
            <span style={{ transform: `translateY(${-Number(d) * 10}%)`, transitionDelay: `${i * 70}ms` }}>
              {'0123456789'.split('').map((n) => (
                <i key={n}>{n}</i>
              ))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

export const extra = (price: number) => (price ? `+$${price}` : 'Included');

/** B: the configurator. Every pick restyles the 3D board; the switch is the same one Sound plays. */
export function Build() {
  const { config, setOption } = useBuild();

  const pick = <K extends Group>(group: K, id: BuildConfig[K]) => {
    setOption(group, id);
    if (group === 'switchType') {
      void ensureAudio();
      playSwitch(id as BuildConfig['switchType']);
    }
  };

  return (
    <section id="build" className={shell.section} data-side="left" aria-labelledby="build-title">
      <div className={`${shell.body} ${s.buildBody}`}>
        <p className={shell.eyebrow} data-rise>
          <KeyCap k="B" /> Build
        </p>
        <h2 id="build-title" className={shell.title} data-reveal>
          {build.title}
        </h2>
        <p className={shell.copy} data-rise>{build.lead}</p>

        {GROUPS.map((group) => {
          const opts: Record<string, { label: string; price: number }> = OPTIONS[group];
          const notes: Record<string, string> = build.groups[group].notes;
          return (
            <div key={group} className={s.group} role="group" aria-labelledby={`build-${group}`} data-rise>
              <p id={`build-${group}`} className={s.groupLabel}>{build.groups[group].label}</p>
              <div className={s.options}>
                {Object.entries(opts).map(([id, o]) => (
                  <button key={id} type="button" className={s.option} aria-pressed={config[group] === id}
                    data-group={group} data-id={id} onClick={() => pick(group, id as BuildConfig[typeof group])}>
                    <span className={s.glow} aria-hidden="true"><i /><i /><i /></span>
                    <span className={s.optTop}>
                      {group !== 'switchType' && <span className={s.swatch} aria-hidden="true" />}
                      <span className={s.optName}>{o.label}</span>
                    </span>
                    <span className={s.optNote}>{notes[id]}</span>
                    <span className={s.optPrice}>{extra(o.price)}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className={s.total} data-rise>
          <div>
            <p className={s.groupLabel}>{build.total}</p>
            <p className={s.totalSpec}>
              {GROUPS.map((g) => (OPTIONS[g] as Record<string, { label: string }>)[config[g]].label).join(' · ')}
            </p>
          </div>
          <Price value={priceOf(config)} live className={s.bigPrice} />
        </div>
        <a className={s.cta} href="#order" data-rise>
          {build.cta} <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
