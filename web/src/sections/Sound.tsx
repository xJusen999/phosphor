'use client';

import { useRef, useState } from 'react';
import { sound } from '../content/copy';
import { ensureAudio, playSwitch, selectSwitch, type SwitchProfile } from '../audio/switches';
import { fx } from '../three/bus';
import { KeyCap } from '../nav/Menu';
import shell from './Shells.module.css';
import s from './Sections.module.css';

type Switch = (typeof sound.switches)[number];

/** Space: three switch cards you can hear. Hover previews, a click picks the one every key press plays. */
export function Sound({ tap }: { tap: (code: string) => void }) {
  const [picked, setPicked] = useState<SwitchProfile>('linear');
  const cards = useRef<Partial<Record<SwitchProfile, HTMLButtonElement | null>>>({});

  const play = (sw: Switch) => {
    playSwitch(sw.id); // silent until a click or key press unlocked audio
    tap(sw.key); // the matching 3D key sinks
    const el = cards.current[sw.id];
    if (el) {
      el.removeAttribute('data-playing');
      void el.offsetWidth; // restart the pulse animation
      el.setAttribute('data-playing', '');
    }
  };
  const pick = (sw: Switch) => {
    void ensureAudio();
    selectSwitch(sw.id);
    setPicked(sw.id);
    play(sw);
  };
  const current = sound.switches.find((sw) => sw.id === picked)!;

  return (
    <section id="sound" className={shell.section} data-side="top" aria-labelledby="sound-title">
      <div className={`${shell.body} ${s.soundBody}`}>
        <p className={shell.eyebrow} data-rise>
          <KeyCap k="␣" sr="Space" /> Sound
        </p>
        <h2 id="sound-title" className={shell.title} data-reveal>
          {sound.title}
        </h2>
        <p className={shell.copy} data-rise>{sound.lead}</p>
        <p className={s.fine} data-rise>{sound.note}</p>

        <div className={s.cards} role="group" aria-label="Switch sound" data-rise
          onPointerEnter={() => (fx.focus = 1)} onPointerLeave={() => (fx.focus = 0)}>
          {sound.switches.map((sw) => (
            <button key={sw.id} type="button" className={s.card} data-switch aria-pressed={picked === sw.id}
              ref={(el) => void (cards.current[sw.id] = el)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && play(sw)}
              onClick={() => pick(sw)}>
              <span className={s.cardTop}>
                <span className={s.kind}>{sw.kind}</span>
                <span className={s.meter} aria-hidden="true"><i /><i /><i /><i /><i /></span>
              </span>
              <span className={s.cardName}>{sw.name}</span>
              <span className={s.cardText}>{sw.text}</span>
              <span className={s.cardSpecs}>
                <span>{sw.force}</span>
                <span>{sw.travel} travel</span>
              </span>
            </button>
          ))}
        </div>

        <label className={s.try} data-rise>
          <span>
            {sound.tryLabel}: <b>{current.name}</b>, {current.kind.toLowerCase()}
          </span>
          <input type="text" placeholder={sound.tryPlaceholder} autoComplete="off" spellCheck={false}
            onFocus={() => (fx.focus = 1)} onBlur={() => (fx.focus = 0)} />
        </label>
      </div>
    </section>
  );
}
