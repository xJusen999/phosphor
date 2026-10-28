'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { GROUPS, isEmail, OPTIONS, priceOf, type BuildConfig } from '@phosphor/shared';
import { build, offlineNote, order } from '../content/copy';
import { FULL_VERSION_URL } from '../data/fullVersion';
import { useDataClient, useRequest, type Req } from '../data/useData';
import { useBuild } from '../state/build';
import { KeyCap } from '../nav/Menu';
import { extra, Price } from './Build';
import shell from './Shells.module.css';
import s from './Product.module.css';

// Store ids are UUIDs or auto ids: show the last eight characters, like a receipt number.
const shortId = (id: string) => `PH-${id.replace(/[^a-z0-9]/gi, '').slice(-8).toUpperCase()}`;

/** An email form with its own request state: validates, calls, then shows the result in place. */
function EmailForm<T>({ id, button, req, send, success }: {
  id: string;
  button: string;
  req: Req<T>;
  send: (email: string) => void;
  success: (value: T) => string;
}) {
  const client = useDataClient();
  const [email, setEmail] = useState('');
  const [bad, setBad] = useState(false);
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = isEmail(email.trim());
    setBad(!ok);
    if (ok && client) send(email.trim());
  };
  if (req.state === 'ok') return <p className={s.ok} role="status">{success(req.value)}</p>;
  return (
    <form className={shell.waitlist} onSubmit={onSubmit} noValidate>
      <label className="sr-only" htmlFor={id}>Email</label>
      <input id={id} type="email" name="email" placeholder="you@studio.com" autoComplete="email" value={email}
        aria-invalid={bad} aria-describedby={`${id}-msg`} onChange={(e) => setEmail(e.target.value)} />
      <button type="submit" disabled={!client || req.state === 'loading'}>
        {!client ? 'Connecting…' : req.state === 'loading' ? 'Sending…' : button}
      </button>
      <p id={`${id}-msg`} className={s.msg} role="alert">
        {bad ? 'Enter a valid email, like you@studio.com.' : req.state === 'error' ? req.message : ''}
      </p>
    </form>
  );
}

/** O: the current build, its server-checked total and a pre-order; or just the waitlist. */
export function Order() {
  const client = useDataClient();
  const { config } = useBuild();
  const [placed, place, setPlaced] = useRequest<{ id: string; total: number }>();
  // A changed build is a new order: the receipt of the old one gives way to the form again.
  const buildKey = GROUPS.map((g) => config[g]).join();
  useEffect(() => setPlaced({ state: 'idle' }), [buildKey, setPlaced]);
  const [joined, join] = useRequest<{ position: number }>();
  const total = priceOf(config);
  const offline = client?.mode === 'offline';
  const where = offline ? ' (this tab only)' : '';

  return (
    <section id="order" className={shell.section} data-side="right" aria-labelledby="order-title">
      <div className={`${shell.body} ${s.orderBody}`}>
        <p className={shell.eyebrow} data-rise>
          <KeyCap k="O" /> Order
        </p>
        <h2 id="order-title" className={shell.title} data-reveal>
          {order.title}
        </h2>
        <p className={shell.copy} data-rise>{order.lead}</p>

        <div className={s.summary} data-rise>
          <p className={s.groupLabel}>{order.summary}</p>
          <dl>
            <div>
              <dt>Phosphor One</dt>
              <dd>${OPTIONS.base}</dd>
            </div>
            {GROUPS.map((g) => {
              const o = (OPTIONS[g] as Record<string, { label: string; price: number }>)[config[g]];
              return (
                <div key={g}>
                  <dt>
                    {build.groups[g].label} · {o.label}
                  </dt>
                  <dd>{extra(o.price)}</dd>
                </div>
              );
            })}
            <div className={s.sumTotal}>
              <dt>Total</dt>
              <dd>
                <Price value={total} />
              </dd>
            </div>
          </dl>
          <a className={s.link} href="#build">{order.change}</a>
        </div>

        <div data-rise>
          <EmailForm id="order-email" button={`Pre-order · $${total}`} req={placed}
            send={(email) => place(() => client!.placeOrder(config, email))}
            success={(r) => `Reserved${where}. Order ${shortId(r.id)}, $${r.total}. A concept: nothing is charged and no email is sent.`} />
        </div>

        <div className={s.wait} data-rise>
          <p className={s.groupLabel}>{order.waitlistTitle}</p>
          <p className={s.waitLead}>{order.waitlistLead}</p>
          <EmailForm id="waitlist-email" button="Join the waitlist" req={joined}
            send={(email) => join(() => client!.joinWaitlist(email))}
            success={(r) => `You’re number ${r.position} on the waitlist${where}.`} />
        </div>

        {offline && (
          <p className={s.offline} data-rise>
            {offlineNote} <a href={FULL_VERSION_URL} target="_blank" rel="noopener">Open the full version</a>
          </p>
        )}
        <p className={s.fine}>{order.concept}</p>
      </div>
    </section>
  );
}
