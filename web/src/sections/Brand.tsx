import { brand } from '../content/copy';
import { avatarCells, AVATAR_SIZE } from '../content/avatar';
import { KeyCap } from '../nav/Menu';
import shell from './Shells.module.css';
import s from './Sections.module.css';

/** A team portrait: the name drawn as a mirrored dot matrix, lit like the keys (procedural, no photos). */
function Avatar({ name }: { name: string }) {
  const cells = avatarCells(name);
  return (
    <svg className={s.avatar} viewBox={`0 0 ${AVATAR_SIZE} ${AVATAR_SIZE}`} aria-hidden="true">
      {cells.map((c, i) => (
        <circle key={i} cx={(i % AVATAR_SIZE) + 0.5} cy={Math.floor(i / AVATAR_SIZE) + 0.5} r={c ? 0.36 : 0.12} data-v={c} />
      ))}
    </svg>
  );
}

/** P: why Phosphor exists, the three rules it designs by, and the people behind it. */
export function Brand() {
  return (
    <section id="brand" className={shell.section} data-side="left" aria-labelledby="brand-title">
      <div className={`${shell.body} ${s.wide}`}>
        <p className={shell.eyebrow} data-rise>
          <KeyCap k="P" /> Info
        </p>
        <h2 id="brand-title" className={shell.title} data-reveal>
          {brand.title}
        </h2>
        <p className={s.lead} data-rise>{brand.lead}</p>
        <p className={shell.copy} data-rise>{brand.body}</p>

        <ol className={s.principles} data-rise>
          {brand.principles.map((p) => (
            <li key={p.n}>
              <span className={s.num}>{p.n}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
            </li>
          ))}
        </ol>

        <h3 className={s.kicker} data-rise>The team</h3>
        <ul className={s.team} data-rise>
          {brand.team.map((m) => (
            <li key={m.name}>
              <Avatar name={m.name} />
              <div>
                <p className={s.name}>{m.name}</p>
                <p className={s.role}>{m.role}</p>
                <p className={s.note}>{m.note}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className={s.fine} data-rise>{brand.teamNote}</p>
      </div>
    </section>
  );
}
