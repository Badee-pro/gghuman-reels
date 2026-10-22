# GGhuman reels: "Caught Lying"

A pipeline that turns one moment from a GGhuman game into a 23–25 second vertical reel for [@gghumanai](https://www.instagram.com/gghumanai/). In each reel an AI tells a convincing lie at the table, the truth is revealed, and the reel ends on a call to action for gghuman.ai.

## Why this format

gghuman.ai's pitch is *AI that bluffs, lies or works with you, like a human*. The account's existing posts are single "POV:" doodle frames: a cream background, robots with monitor heads and bodies coloured by model, the green-headed human in blue, and the GGhuman wordmark at the bottom-left. This format **keeps that exact look and turns it into a short story**, so it sits naturally in the grid but holds attention for 20+ seconds:

1. **POV hook (0–2s):** "POV: Claude swears it's the Detective". It names the model, because model rivalry is what makes people stop scrolling. The caption stays at the top for the whole reel, like their posts.
2. **Setup:** the AIs sit at the game's table (felt, cards, or a hex board), with name plates on the rim, and the POV human in front.
3. **Table talk:** hand-drawn speech bubbles with typing dots. The speaker bobs and its screen-mouth moves. During the lie, the liar's eyes slide sideways.
4. **The truth:** the lie bubble gets struck out and a red "LIE!" stamp lands on it. A "PRIVATE"-style sign slams in with the real role, cards or hand, and the human's face drops.
5. **Punchline:** one dry line while the liar's screen shows a smug face.
6. **CTA:** "Could you catch it?" over the GGhuman / Play vs AI wordmark, then "gghuman.ai · link in bio".

Style details copied from the account: Fredoka (rounded, hand-lettered) for captions, a heavy geometric wordmark (Poppins) with "GG" in black and "human" in grey, thick 7px ink outlines, and a constant "line boil" (an SVG turbulence filter reseeded every 4 frames) so the drawings wobble like hand animation.

The same skeleton works for Mafia, Poker and Settler Rush, and for any new game GGhuman ships. That is what makes 100 videos realistic.

## How it works

```
seed or real game log ──► Claude writes a JSON spec ──► schema + rule validation ──┐
                                 ▲            (errors fed back, max 3 tries)        │
                                 └───────────────────────────────────────────────────┘
spec ──► Remotion (React) template ──► MP4 + 7 key frames ──► probe (size/duration/codec)
                                                          └─► Claude vision QA (rubric) ──► pass / review / fail
everything ──► out/manifest.json   (idempotent: unchanged spec + template = skip)
```

**The key decision:** the AI never draws the video. Claude does the creative part, which is the scene, the lie and the punchline. Its output is a small typed JSON spec (`src/schema.ts`). Deterministic code turns that spec into pixels, so layout, fonts, timing, brand colours and Instagram safe zones can't drift between video 1 and video 100. Creative variety comes from the content. Visual consistency comes from the code.

| Step | File | What it does |
|---|---|---|
| Spec schema | `src/schema.ts` | zod schema with character limits sized to the layout. Cross-field rules: the liar must be an AI player, exactly who told the lie is flagged, poker cards must be real cards (`A♠`), and a real game log needs a reference. |
| Timing | `src/timing.ts` | Scene lengths are derived from the text (reading speed), so a long message stays on screen longer. Total length must be 12–32 s. |
| Template | `src/Reel.tsx`, `src/theme.ts` | 1080×1920 at 30fps. Doodle characters drawn as SVG components: `Robot` (body colour and emblem per model; normal, side-eye or smug faces; talking mouth), `Human` (neutral, happy, shocked or worried), a table for each game, speech bubbles, the reveal sign, and the line-boil filter. |
| Generate | `scripts/generate.ts` | Seed or game log → Claude → validate → feed exact errors back → retry (max 3). |
| Render | `scripts/batch.ts` | Bundles once, renders every spec, writes 7 labelled key frames, probes the MP4, retries failures, writes the manifest. |
| QA | `scripts/qa.ts` | Sends the key frames to Claude vision with a 5-point rubric and sets each reel's status. |

```bash
npm install
npm test                  # 10 unit tests: schema rules + timeline maths
npm run validate          # schema + duration check for every spec in specs/
npm run studio            # live preview / tweak the template
npm run render            # render everything that changed (add --force or ids)
npm run render -- --stills  # key frames only, for fast template iteration
npm run generate          # seeds/seeds.json -> new specs (needs ANTHROPIC_API_KEY)
npm run qa                # vision QA on rendered reels (needs ANTHROPIC_API_KEY)
```

## The 3 videos

| | Game | Liar | The lie | The truth |
|---|---|---|---|---|
| `01-last-vote-claude-mafia` | Last Vote (Mafia) | Claude | POV: Claude swears it's the Detective | Claude was the Mafia, and the town voted out an innocent player. |
| `02-poker-gpt-bluff` | Poker | GPT | POV: GPT shoves all-in and says it has the flush | GPT held seven-two offsuit with no pair. |
| `03-settler-rush-gemini-trade` | Settler Rush | Gemini | POV: Gemini swears it has zero wood | Gemini had three wood, took the ore, and built Longest Road. |

These three were written by Claude against the same schema and are labelled on screen as **dramatizations**. In production the input would be real GGhuman game logs: `generate.ts` takes a `log` and `ref`, and its system prompt forbids inventing moves. The reel then says "Real GGhuman game · #ref" instead. Real logs are the best content source, because the AI really did lie, and they are the honest one.

## Checking quality

The checks are layered from cheap to expensive, and each catches a different kind of failure:

1. **Schema (instant, free).** Overflowing text, missing liar, nonsense cards, invalid JSON. Most LLM failures stop here, before anything is rendered.
2. **Game-logic rules (instant).** The flagged lie must belong to the liar, the liar must be an AI, and so on. A story that doesn't make sense won't validate.
3. **Render probe.** Resolution, codec and exact expected duration. This catches a crashed or truncated render.
4. **Vision QA (about a cent per reel).** Claude looks at 7 key frames (hook, setup, the lie, end of chat, reveal, punchline, CTA) and scores *hook readable, text fits, story clear, CTA visible, brand safe* from 1 to 5. All scores ≥4 → `qa-passed`. A lowest score of 3 → `needs-review`. Anything lower → `qa-failed`.
5. **Human spot-check.** Watch everything in `needs-review`, plus a random 10% of passes. Disagreements become new rubric lines or schema limits, so the automated checks get stricter over time.

**What QA caught on this batch:** the first render of video 1 passed every automated check (schema, probe). Reviewing the key frames still found three template bugs:
- the chat camera push-in clipped the avatars at the left edge
- names were doubled ("GPT · GPT")
- the LIE stamp covered the quote, and its strikethrough only crossed one line

I fixed the template once and re-rendered all three.

Restyling to the account's doodle look worked the same way. A `--stills` pass across all three specs caught three more problems before any full render:
- the human's reaching arm covered a name plate
- the end-card human was drawn off-canvas
- the DeepSeek emblem sat behind the table That's why the template hash is part of the skip key: any template fix re-renders the whole batch. It's also the argument for keeping vision QA, because these were layout bugs the probe could never see.

After posting, the real quality signal is **3-second hold rate and link-in-bio clicks** for each reel. Hook, game, liar model and lie type are all fields in the spec, so it's a single join to learn, for example, that "Grok + poker" hooks beat "Claude + Mafia". The best performers are fed back into the generator prompt as examples.

## Handling failures

| Failure | What happens |
|---|---|
| LLM returns bad or invalid JSON | The exact validator errors go back to Claude ("hook: max 56 chars"). It retries up to 3 times, then the seed is logged for a human. |
| Render crash or timeout | Retried up to 3 times per reel. Other reels keep going, and the error is kept in the manifest. |
| Output doesn't match the spec | The probe fails, the render is retried, and the reel is marked `render-failed` if it still fails. |
| Looks wrong (overflow, unreadable) | Vision QA sends it to `needs-review` or `qa-failed`. It never auto-posts. |
| Re-running after a crash | The manifest stores a hash of the spec plus the template. Finished reels are skipped, so the batch resumes where it stopped. |

## Producing 100

1. **Content source:** export about 150 candidate moments from GGhuman's own game logs. A good moment is one where the AI's message contradicts its hidden role or hand, which a simple query over logs can find. Write them to `seeds.json` with `log` and `ref`. About a third will be weak, which is why the batch is oversized.
2. `npm run generate`: about 150 specs. Specs that still fail after retries are dropped automatically.
3. `npm run validate && npm run render`: this is CPU-bound. Locally it takes about 1–2 minutes per reel. For 100 reels in a few minutes, swap `renderMedia` for `@remotion/lambda` (same template, render runs in parallel across Lambdas).
4. `npm run qa`: then a human spends about 15 minutes on the `needs-review` pile and picks the best 100.
5. Schedule two a day, matching the current cadence. Pick by `status === 'qa-passed'` from the manifest, and use the caption and hashtags from a small extra Claude call.

**Diversity controls** so 100 videos don't feel like one: rotate game × liar model × lie type (fake role, bluff, broken promise, hidden resource). Reject a new spec if its hook is too close to an existing one (simple n-gram overlap check). Add a second template (for example "Model vs Model" head-to-head) once this one plateaus.

## What I'd add next

- **Voiceover and sound:** ElevenLabs TTS per chat line (each model gets its own voice), plus a typing sound effect. The spec doesn't change, it's just another layer in the template.
- **Trending audio** gets added in the Instagram app at posting time. This is the remaining 5% that's manual.
- **Posting:** use the Instagram Graph API to auto-publish `qa-passed` reels on a schedule.
