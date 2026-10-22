import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkSpec } from '../scripts/lib/specs';
import { buildTimeline } from '../src/timing';

const base = JSON.parse(readFileSync(join(__dirname, '..', 'specs', '01-last-vote-claude-mafia.json'), 'utf8'));
const variant = (patch: (s: typeof base) => void) => {
	const s = structuredClone(base);
	patch(s);
	return checkSpec(s);
};

test('sample spec is valid', () => {
	assert.deepEqual(checkSpec(base).errors, []);
});

test('rejects a hook that would overflow the layout', () => {
	const r = variant((s) => (s.hook = 'x'.repeat(57)));
	assert.ok(r.errors.some((e) => e.startsWith('hook')));
});

test('rejects a human as the liar', () => {
	const r = variant((s) => (s.liar = 'you'));
	assert.ok(r.errors.some((e) => e.includes('AI player')));
});

test('rejects a lie flagged on someone other than the liar', () => {
	const r = variant((s) => (s.chat[0].lie = true));
	assert.ok(r.errors.some((e) => e.includes('only the liar')));
});

test('rejects chat with no flagged lie', () => {
	const r = variant((s) => s.chat.forEach((l: { lie?: boolean }) => (l.lie = false)));
	assert.ok(r.errors.some((e) => e.includes('flagged as the lie')));
});

test('rejects chat from unknown players', () => {
	const r = variant((s) => (s.chat[2].from = 'ghost'));
	assert.ok(r.errors.some((e) => e.includes('unknown player')));
});

test('rejects impossible playing cards', () => {
	const r = variant((s) => (s.game = 'poker', s.reveal = { kind: 'cards', cards: ['1♠', 'Z♥'], board: [], detail: 'x' }));
	assert.ok(r.errors.some((e) => e.includes('cards look like')));
});

test('game-log sources need a reference', () => {
	const r = variant((s) => (s.source = { kind: 'game-log' }));
	assert.ok(r.errors.some((e) => e.startsWith('source.ref')));
});

test('rejects reels that run too long', () => {
	const r = variant((s) => {
		s.chat = Array.from({ length: 7 }, (_, i) => ({ from: i % 2 ? 'claude' : 'gpt', text: 'y'.repeat(110), lie: i === 1 }));
	});
	assert.ok(r.errors.some((e) => e.includes('duration')));
});

test('timeline is contiguous and longer text reads longer', () => {
	const spec = checkSpec(base).spec!;
	const tl = buildTimeline(spec);
	assert.equal(tl.hook[1], tl.setup[0]);
	assert.equal(tl.setup[1], tl.chat[0]);
	assert.equal(tl.chat[1], tl.reveal[0]);
	assert.equal(tl.cta[1], tl.total);
	tl.beats.forEach((b, i) => i && assert.equal(b.start, tl.beats[i - 1].end));
	const short = buildTimeline({ ...spec, chat: spec.chat.map((l) => ({ ...l, text: 'ok' })) });
	assert.ok(tl.total > short.total);
});
