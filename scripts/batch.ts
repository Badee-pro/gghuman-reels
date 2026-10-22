import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { bundle } from '@remotion/bundler';
import { getVideoMetadata, renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { buildTimeline, FPS, HEIGHT, WIDTH } from '../src/timing';
import type { ReelSpec } from '../src/schema';
import { loadSpecs, OUT_DIR, ROOT } from './lib/specs';
import { readManifest, writeManifest, type ManifestEntry } from './lib/manifest';

const MAX_ATTEMPTS = 3;
const args = process.argv.slice(2);
const force = args.includes('--force');
const stillsOnly = args.includes('--stills');
const ids = args.filter((a) => !a.startsWith('--'));

const templateHash = (): string => {
	const h = createHash('sha256');
	for (const f of readdirSync(join(ROOT, 'src')).sort()) h.update(readFileSync(join(ROOT, 'src', f)));
	return h.digest('hex');
};

const keyFrames = (spec: ReelSpec): Record<string, number> => {
	const tl = buildTimeline(spec);
	const lie = tl.beats[spec.chat.findIndex((l) => l.lie)];
	return {
		hook: tl.hook[1] - 12,
		setup: tl.setup[1] - 10,
		lie: lie.end - 4,
		chat_end: tl.chat[1] - 4,
		reveal: tl.reveal[1] - 10,
		punchline: tl.punchline[1] - 10,
		cta: tl.total - 6,
	};
};

const probe = async (file: string, spec: ReelSpec): Promise<string[]> => {
	const meta = await getVideoMetadata(file);
	const expected = buildTimeline(spec).total / FPS;
	const problems: string[] = [];
	if (meta.width !== WIDTH || meta.height !== HEIGHT) problems.push(`size ${meta.width}x${meta.height}`);
	if (Math.abs((meta.durationInSeconds ?? 0) - expected) > 0.25) problems.push(`duration ${meta.durationInSeconds}s, expected ${expected.toFixed(2)}s`);
	if (meta.codec !== 'h264') problems.push(`codec ${meta.codec}`);
	return problems;
};

const main = async (): Promise<void> => {
	mkdirSync(OUT_DIR, { recursive: true });
	const manifest = readManifest();
	const results = loadSpecs(ids);
	const tHash = templateHash();

	console.log('Bundling template…');
	const serveUrl = await bundle({ entryPoint: join(ROOT, 'src', 'index.ts') });

	for (const r of results) {
		const name = basename(r.file, '.json');
		if (!r.spec || r.errors.length) {
			manifest[name] = { id: name, status: 'invalid-spec', errors: r.errors, updatedAt: new Date().toISOString() };
			console.log(`✗ ${name}: invalid spec`);
			continue;
		}
		const spec = r.spec;
		const hash = createHash('sha256').update(JSON.stringify(spec)).update(tHash).digest('hex').slice(0, 16);
		const video = join(OUT_DIR, `${name}.mp4`);
		const prev = manifest[name];
		if (!force && !stillsOnly && prev?.hash === hash && prev.status !== 'render-failed' && existsSync(video)) {
			console.log(`= ${name}: unchanged, skipping`);
			continue;
		}

		const entry: ManifestEntry = { id: name, hash, status: 'rendering', video, frames: {}, errors: [], attempts: 0, updatedAt: '' };
		for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
			entry.attempts = attempt;
			try {
				const inputProps = { spec };
				const composition = await selectComposition({ serveUrl, id: 'Reel', inputProps });
				let last = -1;
				if (!stillsOnly) await renderMedia({
					composition,
					serveUrl,
					codec: 'h264',
					crf: 18,
					pixelFormat: 'yuv420p',
					outputLocation: video,
					inputProps,
					onProgress: ({ progress }) => {
						const pct = Math.floor(progress * 10) * 10;
						if (pct !== last) process.stdout.write(`\r  ${name}: ${(last = pct)}%   `);
					},
				});
				process.stdout.write('\n');
				const frameDir = join(OUT_DIR, name);
				mkdirSync(frameDir, { recursive: true });
				for (const [label, frame] of Object.entries(keyFrames(spec))) {
					const output = join(frameDir, `${label}.png`);
					await renderStill({ composition, serveUrl, frame, output, inputProps });
					entry.frames![label] = output;
				}
				if (stillsOnly) {
					console.log(`  stills only: ${frameDir}`);
					break;
				}
				const problems = await probe(video, spec);
				if (problems.length) throw new Error(`probe failed: ${problems.join('; ')}`);
				entry.status = 'rendered';
				entry.errors = [];
				break;
			} catch (e) {
				entry.errors!.push(`attempt ${attempt}: ${(e as Error).message}`);
				entry.status = 'render-failed';
				console.log(`\n  ! ${name} attempt ${attempt} failed: ${(e as Error).message}`);
			}
		}
		if (stillsOnly) continue;
		entry.updatedAt = new Date().toISOString();
		manifest[name] = entry;
		writeManifest(manifest);
		console.log(`${entry.status === 'rendered' ? '✓' : '✗'} ${name}: ${entry.status}`);
	}
	writeManifest(manifest);
	const counts = Object.values(manifest).reduce<Record<string, number>>((a, e) => ({ ...a, [e.status]: (a[e.status] ?? 0) + 1 }), {});
	console.log('\nManifest:', counts);
};

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
