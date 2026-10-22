import type { ReelSpec } from './schema';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

const HOOK = 60;
const SETUP = 60;
const TYPING = 14;
const LIE_HOLD = 18;
const REVEAL = 126;
const PUNCHLINE = 60;
const CTA = 84;

export type ChatBeat = { start: number; typingEnd: number; end: number };

export type Timeline = {
	hook: [number, number];
	setup: [number, number];
	chat: [number, number];
	beats: ChatBeat[];
	reveal: [number, number];
	punchline: [number, number];
	cta: [number, number];
	total: number;
};

const readFrames = (text: string): number => Math.max(30, Math.round(text.length * 1.1));

export const buildTimeline = (spec: ReelSpec): Timeline => {
	let t = 0;
	const span = (len: number): [number, number] => {
		const s: [number, number] = [t, t + len];
		t += len;
		return s;
	};
	const hook = span(HOOK);
	const setup = span(SETUP);
	const chatStart = t;
	const beats = spec.chat.map((line) => {
		const start = t;
		const typingEnd = start + TYPING;
		const end = typingEnd + readFrames(line.text) + (line.lie ? LIE_HOLD : 0);
		t = end;
		return { start, typingEnd, end };
	});
	const chat: [number, number] = [chatStart, t];
	const reveal = span(REVEAL);
	const punchline = span(PUNCHLINE);
	const cta = span(CTA);
	return { hook, setup, chat, beats, reveal, punchline, cta, total: t };
};
