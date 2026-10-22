import { basename } from 'node:path';
import { loadSpecs } from './lib/specs';
import { buildTimeline, FPS } from '../src/timing';

const results = loadSpecs(process.argv.slice(2));
let failed = 0;
for (const r of results) {
	if (r.errors.length) {
		failed++;
		console.log(`✗ ${basename(r.file)}`);
		r.errors.forEach((e) => console.log(`    ${e}`));
	} else {
		console.log(`✓ ${basename(r.file)}  ${(buildTimeline(r.spec!).total / FPS).toFixed(1)}s`);
	}
}
console.log(`\n${results.length - failed}/${results.length} specs valid`);
process.exit(failed ? 1 : 0);
