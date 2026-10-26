import { describe, it, expect, vi } from 'vitest';
import { ref, get, push, update, serverTimestamp } from 'firebase/database';
import { FIREBASE_MODULE, REPO, firebaseDevice } from './harness';

// Crash reports and feedback (src/shared/services/reports.js) against the real
// rules in database.rules.json: write-only, one per device per window, every
// field capped, nothing beyond the known fields, and nobody's path but your own.

const NS = 'demo-aniguess-default-rtdb';
async function adminGet(path) {
  const res = await fetch(`http://127.0.0.1:9000/${path}.json?ns=${NS}`, { headers: { Authorization: 'Bearer owner' } });
  return res.json();
}

// The real sendReport, over one simulated device's Firebase.
async function reporter(label) {
  const fb = firebaseDevice(label);
  vi.resetModules();
  vi.doMock(FIREBASE_MODULE, () => ({
    firebaseEnabled: true,
    getFirebaseAuth: () => fb.auth,
    getFirebaseDb: () => fb.db,
    ensureSignedIn: fb.ensureSignedIn,
  }));
  const mod = await import(/* @vite-ignore */ `${REPO}/src/shared/services/reports.js`);
  const uid = await fb.ensureSignedIn();
  return { ...fb, uid, send: mod.sendReport };
}

// A hand-made write in sendReport's shape, for what the module itself would
// never send (it trims and drops on the way out).
function rawWrite(dev, kind, fields, { gate = true, uid = dev.uid } = {}) {
  const id = push(ref(dev.db, `reports/${kind}/${uid}`)).key;
  const patch = { [`reports/${kind}/${uid}/${id}`]: { ...fields, at: serverTimestamp() } };
  if (gate) patch[`reportGate/${uid}/${kind}`] = serverTimestamp();
  return update(ref(dev.db), patch);
}

describe('reports', () => {
  it('takes one crash report, then refuses another inside the window', async () => {
    const dev = await reporter('crash');
    await dev.send('crashes', { message: 'boom', stack: 'Error: boom\n at x', gameId: 'anipeek', path: '/' });
    const stored = Object.values(await adminGet(`reports/crashes/${dev.uid}`));
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ message: 'boom', gameId: 'anipeek', path: '/', build: 'dev' });
    expect(typeof stored[0].at).toBe('number');

    await expect(dev.send('crashes', { message: 'again' })).rejects.toThrow(/permission/i);
    // Feedback has its own gate, so a crash a moment ago does not block it.
    await dev.send('feedback', { text: 'The quiz is great', gameId: 'aniquiz' });
    expect(Object.values(await adminGet(`reports/feedback/${dev.uid}`))[0]).toMatchObject({ text: 'The quiz is great' });
    await expect(dev.send('feedback', { text: 'twice' })).rejects.toThrow(/permission/i);
  });

  it('refuses a report written without stamping its gate', async () => {
    const dev = await reporter('nogate');
    await expect(rawWrite(dev, 'crashes', { message: 'sneaky' }, { gate: false })).rejects.toThrow(/permission/i);
  });

  it('refuses an oversized field, an unknown field and an empty message', async () => {
    const [a, b, c] = await Promise.all([reporter('big'), reporter('extra'), reporter('empty')]);
    await expect(rawWrite(a, 'crashes', { message: 'x'.repeat(301) })).rejects.toThrow(/permission/i);
    await expect(rawWrite(b, 'feedback', { text: 'hi', email: 'me@example.com' })).rejects.toThrow(/permission/i);
    await expect(rawWrite(c, 'feedback', { text: '' })).rejects.toThrow(/permission/i);
  });

  it('refuses a write under somebody else’s uid, and every read', async () => {
    const [a, b] = await Promise.all([reporter('mine'), reporter('theirs')]);
    await expect(rawWrite(a, 'feedback', { text: 'as you' }, { uid: b.uid })).rejects.toThrow(/permission/i);
    await a.send('feedback', { text: 'mine' });
    await expect(get(ref(a.db, `reports/feedback/${a.uid}`))).rejects.toThrow(/permission/i);
    await expect(get(ref(a.db, 'reports'))).rejects.toThrow(/permission/i);
    await expect(get(ref(a.db, `reportGate/${a.uid}`))).rejects.toThrow(/permission/i);
  });
});
