import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AppModule } from '../src/app.module';

let app: INestApplication;
let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'phosphor-api-'));
  process.env.PHOSPHOR_DATA_DIR = dir;
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
  app.getHttpServer().setMaxListeners(40); // the concurrency test opens many supertest sockets
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

const http = () => request(app.getHttpServer());

describe('waitlist', () => {
  it('adds an email, repeats return the same position with 200', async () => {
    const first = await http().post('/waitlist').send({ email: 'a@b.co' }).expect(201);
    expect(first.body).toEqual({ ok: true, position: 1 });
    const again = await http().post('/waitlist').send({ email: 'a@b.co' }).expect(200);
    expect(again.body).toEqual({ ok: true, position: 1 });
  });

  it('rejects a bad email and unknown fields', async () => {
    await http().post('/waitlist').send({ email: 'bad' }).expect(400);
    await http().post('/waitlist').send({ email: 'a@b.co', extra: 1 }).expect(400);
  });

  it('keeps positions unique under concurrent requests', async () => {
    const res = await Promise.all(
      Array.from({ length: 20 }, (_, i) => http().post('/waitlist').send({ email: `u${i}@b.co` })),
    );
    const positions = res.map((r) => r.body.position).sort((a, b) => a - b);
    expect(positions).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe('orders', () => {
  const config = { caseFinish: 'clear', keycaps: 'blank', switchType: 'clicky' };

  it('recomputes the total and ignores the client value', async () => {
    const res = await http().post('/orders').send({ config, email: 'a@b.co', total: 1 }).expect(201);
    expect(res.body.total).toBe(284);
    expect(typeof res.body.id).toBe('string');
  });

  it('rejects an unknown option, a bad email or a missing config', async () => {
    await http().post('/orders').send({ config: { ...config, caseFinish: 'gold' }, email: 'a@b.co' }).expect(400);
    await http().post('/orders').send({ config, email: 'nope' }).expect(400);
    await http().post('/orders').send({ email: 'a@b.co' }).expect(400);
    await http().post('/orders').send({ config: [], email: 'a@b.co' }).expect(400);
    await http().post('/orders').send({ config: [config], email: 'a@b.co' }).expect(400);
    await http().post('/orders').send({ config: 'clear', email: 'a@b.co' }).expect(400);
  });
});

describe('scores', () => {
  it('accepts a valid score and returns its rank', async () => {
    const res = await http().post('/scores').send({ name: 'neo', wpm: 80, accuracy: 0.95 }).expect(201);
    expect(res.body).toEqual({ rank: 1 });
  });

  it('rejects out-of-range and unsafe values', async () => {
    await http().post('/scores').send({ name: 'neo', wpm: 400, accuracy: 0.95 }).expect(400);
    await http().post('/scores').send({ name: 'neo', wpm: 80, accuracy: 1.5 }).expect(400);
    await http().post('/scores').send({ name: '<b>', wpm: 80, accuracy: 0.95 }).expect(400);
    await http().post('/scores').send({ name: 'neo', wpm: '80', accuracy: 0.95 }).expect(400);
  });

  it('lists the top 10 sorted by wpm then accuracy', async () => {
    for (let i = 0; i < 12; i++) {
      await http().post('/scores').send({ name: `p${i}`, wpm: 50 + (i % 6) * 10, accuracy: 0.8 + i / 100 }).expect(201);
    }
    const res = await http().get('/scores').expect(200);
    const list = res.body as { name: string; wpm: number; accuracy: number; at: string }[];
    expect(list).toHaveLength(10);
    for (let i = 1; i < list.length; i++) {
      const [a, b] = [list[i - 1], list[i]];
      expect(a.wpm > b.wpm || (a.wpm === b.wpm && a.accuracy >= b.accuracy)).toBe(true);
    }
    expect(Object.keys(list[0]).sort()).toEqual(['accuracy', 'at', 'name', 'wpm']);
  });
});
