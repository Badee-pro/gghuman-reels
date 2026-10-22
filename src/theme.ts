import { loadFont as loadFredoka } from '@remotion/google-fonts/Fredoka';
import { loadFont as loadPoppins } from '@remotion/google-fonts/Poppins';
import type { GAMES, MODELS } from './schema';

export const HAND = loadFredoka('normal', { weights: ['500', '600', '700'], subsets: ['latin'] }).fontFamily;
export const LOGO = loadPoppins('normal', { weights: ['700', '800'], subsets: ['latin'] }).fontFamily;

export const PAPER = '#efeae1';
export const CARD = '#fbf8f2';
export const INK = '#1e1e1c';
export const STROKE = 7;
export const RED = '#e5483b';
export const LOGO_GREY = '#8d8d8a';

export const HUMAN = { head: '#58b947', body: '#2f7fd8' };

export type Emblem = 'sunburst' | 'knot' | 'sparkle' | 'slash' | 'letter';

export const ROBOTS: Record<(typeof MODELS)[number], { body: string; eye: string; emblem: Emblem }> = {
	Claude: { body: '#e3876a', eye: '#f6a47f', emblem: 'sunburst' },
	GPT: { body: '#4b5452', eye: '#3fd6c6', emblem: 'knot' },
	Gemini: { body: '#8e67d8', eye: '#8fb2ff', emblem: 'sparkle' },
	Grok: { body: '#2f2f2f', eye: '#e8e8e8', emblem: 'slash' },
	DeepSeek: { body: '#4d6bfe', eye: '#9fb2ff', emblem: 'letter' },
	Kimi: { body: '#9b7be0', eye: '#d2c2ff', emblem: 'letter' },
	Qwen: { body: '#6f63e8', eye: '#b9b2ff', emblem: 'letter' },
	Mistral: { body: '#f08a3c', eye: '#ffc38f', emblem: 'letter' },
	MiniMax: { body: '#ea5f80', eye: '#ffadc0', emblem: 'letter' },
};

export const TABLES: Record<keyof typeof GAMES, { top: string; rim: string }> = {
	'last-vote': { top: '#8c4a46', rim: '#6b4a3e' },
	poker: { top: '#3f8f57', rim: '#7a5646' },
	'settler-rush': { top: '#a07a68', rim: '#7a5646' },
};

export const HEX_COLORS = ['#7cc04b', '#f2c84b', '#e07a4f', '#b5b0a6', '#3f8f57', '#f2c84b', '#7cc04b'];
