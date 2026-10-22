import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ReelSpecSchema, type ReelSpec } from '../../src/schema';
import { buildTimeline, FPS } from '../../src/timing';

export const ROOT = resolve(__dirname, '..', '..');
export const SPECS_DIR = join(ROOT, 'specs');
export const OUT_DIR = join(ROOT, 'out');

const MIN_SECONDS = 12;
const MAX_SECONDS = 32;

export type SpecResult = { file: string; spec?: ReelSpec; errors: string[] };

export const checkSpec = (raw: unknown, file = '<inline>'): SpecResult => {
	const parsed = ReelSpecSchema.safeParse(raw);
	if (!parsed.success) {
		return { file, errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
	}
	const seconds = buildTimeline(parsed.data).total / FPS;
	const errors: string[] = [];
	if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) errors.push(`duration ${seconds.toFixed(1)}s is outside ${MIN_SECONDS}-${MAX_SECONDS}s`);
	return { file, spec: parsed.data, errors };
};

export const loadSpecs = (filter?: string[]): SpecResult[] =>
	readdirSync(SPECS_DIR)
		.filter((f) => f.endsWith('.json'))
		.filter((f) => !filter?.length || filter.some((id) => f.startsWith(id)))
		.sort()
		.map((f) => {
			const file = join(SPECS_DIR, f);
			try {
				return checkSpec(JSON.parse(readFileSync(file, 'utf8')), file);
			} catch (e) {
				return { file, errors: [`invalid JSON: ${(e as Error).message}`] };
			}
		});
