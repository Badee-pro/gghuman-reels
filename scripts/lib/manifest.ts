import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT_DIR } from './specs';

export type ReelStatus = 'invalid-spec' | 'rendering' | 'render-failed' | 'rendered' | 'qa-passed' | 'needs-review' | 'qa-failed';

export type QaScore = { hookReadable: number; textFits: number; storyClear: number; ctaVisible: number; brandSafe: number };

export type ManifestEntry = {
	id: string;
	status: ReelStatus;
	hash?: string;
	video?: string;
	frames?: Record<string, string>;
	errors?: string[];
	attempts?: number;
	qa?: { scores: QaScore; issues: string[]; model: string };
	updatedAt: string;
};

const FILE = join(OUT_DIR, 'manifest.json');

export const readManifest = (): Record<string, ManifestEntry> => (existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : {});

export const writeManifest = (m: Record<string, ManifestEntry>): void => writeFileSync(FILE, JSON.stringify(m, null, 2));
