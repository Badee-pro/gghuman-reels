import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { GAMES, MODELS } from '../src/schema';
import { checkSpec, SPECS_DIR } from './lib/specs';

const MODEL = process.env.GEN_MODEL ?? 'claude-sonnet-5-5';
const MAX_ATTEMPTS = 3;

type Seed = { game: keyof typeof GAMES; liar: (typeof MODELS)[number]; angle: string; log?: string; ref?: string };

const SYSTEM = `You write 20-second Instagram reels for gghuman.ai, where people play board games against frontier AI models that can bluff, lie and cooperate.
Format "Caught Lying": a hook, a short setup, a 4-6 line table chat in which one AI tells a believable lie, a reveal of the truth, a punchline.
Rules:
- If a game log is given, every chat line and the reveal must be supported by it. Do not invent moves. Tighten wording only.
- Without a log, write a plausible scene that obeys the game's real rules (poker hand rankings, Mafia roles, Catan resources).
- The lie must sound reasonable in the moment; other players should believe it or be split.
- Hook <= 56 chars, names the AI. Punchline <= 60 chars, dry and specific, not a pun.
- No slurs, no real people, no claims about the AI companies themselves.
Return ONLY the JSON object, matching the schema you are given.`;

const example = readFileSync(join(SPECS_DIR, readdirSync(SPECS_DIR).find((f) => f.endsWith('.json'))!), 'utf8');

const prompt = (seed: Seed): string =>
	[
		`Game: ${seed.game} (${GAMES[seed.game].subtitle}). The liar is ${seed.liar}.`,
		`Angle: ${seed.angle}`,
		seed.log ? `Game log:\n${seed.log}` : 'No log: this will be labelled a dramatization.',
		`Source must be ${seed.log ? `{"kind":"game-log","ref":"${seed.ref ?? 'unknown'}"}` : '{"kind":"dramatization"}'}.`,
		`Example of a valid spec (different game, copy the shape, not the content):\n${example}`,
	].join('\n\n');

const extractJson = (text: string): unknown => JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

const generate = async (client: Anthropic, seed: Seed, index: number): Promise<string | null> => {
	const messages: Anthropic.MessageParam[] = [{ role: 'user', content: prompt(seed) }];
	for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
		const res = await client.messages.create({ model: MODEL, max_tokens: 1500, system: SYSTEM, messages });
		const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
		let errors: string[];
		try {
			const result = checkSpec(extractJson(text));
			errors = result.errors;
			if (!errors.length && result.spec) {
				const file = join(SPECS_DIR, `${String(index).padStart(3, '0')}-${result.spec.id}.json`);
				writeFileSync(file, JSON.stringify(result.spec, null, 2));
				return file;
			}
		} catch (e) {
			errors = [`not valid JSON: ${(e as Error).message}`];
		}
		console.log(`  attempt ${attempt} rejected: ${errors.join(' | ')}`);
		messages.push({ role: 'assistant', content: text }, { role: 'user', content: `That spec failed validation:\n- ${errors.join('\n- ')}\nReturn the corrected JSON only.` });
	}
	return null;
};

const main = async (): Promise<void> => {
	const seedsFile = process.argv[2] ?? join(__dirname, '..', 'seeds', 'seeds.json');
	const seeds: Seed[] = JSON.parse(readFileSync(seedsFile, 'utf8'));
	const client = new Anthropic();
	const start = readdirSync(SPECS_DIR).filter((f) => f.endsWith('.json')).length + 1;
	let ok = 0;
	for (const [i, seed] of seeds.entries()) {
		console.log(`[${i + 1}/${seeds.length}] ${seed.game} / ${seed.liar}: ${seed.angle}`);
		const file = await generate(client, seed, start + i);
		if (file) ok++;
		console.log(file ? `  ✓ ${file}` : '  ✗ gave up, logged for a human');
	}
	console.log(`\n${ok}/${seeds.length} specs generated`);
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
