import { z } from 'zod';

export const GAMES = {
	'last-vote': { label: 'LAST VOTE', subtitle: 'Mafia vs frontier AI', accent: '#ff3b5c', felt: '#1a0b12' },
	poker: { label: 'POKER', subtitle: "No-limit hold'em vs frontier AI", accent: '#2ee59d', felt: '#071a13' },
	'settler-rush': { label: 'SETTLER RUSH', subtitle: 'Catan-style trading vs frontier AI', accent: '#ffb547', felt: '#1a1206' },
} as const;

export const MODELS = ['Claude', 'GPT', 'Gemini', 'Grok', 'DeepSeek', 'Kimi', 'Qwen', 'Mistral', 'MiniMax'] as const;

const card = z.string().regex(/^(10|[2-9JQKA])[♠♥♦♣]$/, 'cards look like "A♠" or "10♥"');

export const PlayerSchema = z.object({
	id: z.string().min(1).max(12),
	name: z.string().min(1).max(14),
	model: z.enum(MODELS).optional(),
});

export const ChatLineSchema = z.object({
	from: z.string(),
	text: z.string().min(1).max(110),
	lie: z.boolean().default(false),
});

export const RevealSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('role'), role: z.string().max(16), detail: z.string().max(90) }),
	z.object({ kind: z.literal('cards'), cards: z.array(card).min(2).max(2), board: z.array(card).max(5).default([]), detail: z.string().max(90) }),
	z.object({ kind: z.literal('resources'), had: z.array(z.string().max(14)).min(1).max(4), detail: z.string().max(90) }),
]);

export const ReelSpecSchema = z
	.object({
		id: z.string().regex(/^[a-z0-9-]{3,48}$/),
		game: z.enum(Object.keys(GAMES) as [keyof typeof GAMES, ...(keyof typeof GAMES)[]]),
		liar: z.string(),
		source: z.object({ kind: z.enum(['game-log', 'dramatization']), ref: z.string().optional() }),
		hook: z.string().min(8).max(56),
		setup: z.string().min(8).max(80),
		players: z.array(PlayerSchema).min(2).max(5),
		chat: z.array(ChatLineSchema).min(3).max(7),
		reveal: RevealSchema,
		punchline: z.string().min(4).max(60),
		cta: z.string().min(4).max(40).default('Could you catch it?'),
	})
	.superRefine((s, ctx) => {
		const ids = new Set(s.players.map((p) => p.id));
		if (s.players.filter((p) => !p.model).length !== 1) ctx.addIssue({ code: 'custom', path: ['players'], message: 'exactly one human player (the POV) is required' });
		if (s.players.filter((p) => p.model).length > 4) ctx.addIssue({ code: 'custom', path: ['players'], message: 'at most 4 AI players fit at the table' });
		if (/^pov\b/i.test(s.hook)) ctx.addIssue({ code: 'custom', path: ['hook'], message: 'do not start with "POV" — the template adds it' });
		const liar = s.players.find((p) => p.id === s.liar);
		if (!liar) ctx.addIssue({ code: 'custom', path: ['liar'], message: `liar "${s.liar}" is not a player` });
		else if (!liar.model) ctx.addIssue({ code: 'custom', path: ['liar'], message: 'liar must be an AI player (needs a model)' });
		s.chat.forEach((line, i) => {
			if (!ids.has(line.from)) ctx.addIssue({ code: 'custom', path: ['chat', i, 'from'], message: `unknown player "${line.from}"` });
			if (line.lie && line.from !== s.liar) ctx.addIssue({ code: 'custom', path: ['chat', i, 'lie'], message: 'only the liar can tell the flagged lie' });
		});
		if (!s.chat.some((l) => l.lie)) ctx.addIssue({ code: 'custom', path: ['chat'], message: 'at least one chat line must be flagged as the lie' });
		if (!s.chat.some((l) => l.from !== s.liar)) ctx.addIssue({ code: 'custom', path: ['chat'], message: 'chat needs at least one other player' });
		if (s.source.kind === 'game-log' && !s.source.ref) ctx.addIssue({ code: 'custom', path: ['source', 'ref'], message: 'game-log sources need a ref' });
	});

export type ReelSpec = z.infer<typeof ReelSpecSchema>;
export type ChatLine = z.infer<typeof ChatLineSchema>;
