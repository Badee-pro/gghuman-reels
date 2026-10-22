import { readFileSync } from 'node:fs';
import Anthropic from '@anthropic-ai/sdk';
import { readManifest, writeManifest, type QaScore } from './lib/manifest';

const MODEL = process.env.QA_MODEL ?? 'claude-sonnet-5-5';
const PASS = 4;
const REVIEW = 3;

const RUBRIC = `You are QA for vertical Instagram reels (1080x1920). You get keyframes of one reel in order.
Score each 1-5:
- hookReadable: the hook frame is legible in under 2 seconds on a phone, nothing cut off.
- textFits: no text is clipped, overlapping, or under the bottom 360px / right 130px (Instagram UI).
- storyClear: from the frames alone a viewer understands who lied and what the truth was.
- ctaVisible: "gghuman.ai" is large and readable on the last frame.
- brandSafe: nothing offensive, misleading about real companies, or broken-looking (empty boxes, "undefined", tofu glyphs).
Reply with ONLY JSON: {"scores":{"hookReadable":n,"textFits":n,"storyClear":n,"ctaVisible":n,"brandSafe":n},"issues":["short, specific"]}`;

const main = async (): Promise<void> => {
	const client = new Anthropic();
	const manifest = readManifest();
	const targets = Object.values(manifest).filter((e) => e.status === 'rendered' || process.argv.includes('--all'));
	for (const entry of targets) {
		if (!entry.frames) continue;
		const images: Anthropic.ContentBlockParam[] = Object.entries(entry.frames).flatMap(([label, file]) => [
			{ type: 'text' as const, text: `Frame: ${label}` },
			{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/png' as const, data: readFileSync(file).toString('base64') } },
		]);
		const res = await client.messages.create({
			model: MODEL,
			max_tokens: 600,
			system: RUBRIC,
			messages: [{ role: 'user', content: [...images, { type: 'text', text: 'Score this reel.' }] }],
		});
		const text = res.content.map((c) => (c.type === 'text' ? c.text : '')).join('');
		const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { scores: QaScore; issues: string[] };
		const min = Math.min(...Object.values(parsed.scores));
		entry.status = min >= PASS ? 'qa-passed' : min >= REVIEW ? 'needs-review' : 'qa-failed';
		entry.qa = { ...parsed, model: MODEL };
		entry.updatedAt = new Date().toISOString();
		writeManifest(manifest);
		console.log(`${entry.status.padEnd(12)} ${entry.id}  ${JSON.stringify(parsed.scores)}${parsed.issues.length ? `\n    ${parsed.issues.join('\n    ')}` : ''}`);
	}
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
