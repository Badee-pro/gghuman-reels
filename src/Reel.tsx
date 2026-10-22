import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { GAMES, type ReelSpec } from './schema';
import { CARD, HAND, HEX_COLORS, HUMAN, INK, LOGO, LOGO_GREY, PAPER, RED, ROBOTS, STROKE, TABLES, type Emblem } from './theme';
import { buildTimeline, type Timeline } from './timing';

type Player = ReelSpec['players'][number];
type Eyes = 'normal' | 'side' | 'smug';
type Mood = 'neutral' | 'happy' | 'shocked' | 'worried';

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

const TABLE = { cx: 500, cy: 1185, rx: 440, ry: 112, depth: 34 };
const ROBOT_BASE = 1172;
const HUMAN_POS = { x: 820, y: 1830, s: 0.9 };
const BUBBLE_BOTTOM = 762;

const pop = (frame: number, fps: number, delay = 0, damping = 12): number =>
	spring({ frame: frame - delay, fps, config: { damping, stiffness: 180, mass: 0.6 } });

const within = (f: number, [a, b]: [number, number]): boolean => f >= a && f < b;

const speakerColor = (p?: Player): string => (p?.model ? ROBOTS[p.model].body : HUMAN.body);

const robotLayout = (count: number): { xs: number[]; s: number } => {
	const s = count <= 2 ? 0.95 : count === 3 ? 0.88 : 0.78;
	if (count === 1) return { xs: [430], s };
	const [a, b] = count === 2 ? [250, 640] : [170, 760];
	return { xs: Array.from({ length: count }, (_, i) => a + ((b - a) * i) / (count - 1)), s };
};

const EmblemMark: React.FC<{ kind: Emblem; letter: string }> = ({ kind, letter }) => {
	if (kind === 'sunburst')
		return (
			<g stroke={CARD} strokeWidth={5} strokeLinecap="round">
				{Array.from({ length: 12 }, (_, i) => {
					const a = (i * Math.PI) / 6;
					return <line key={i} x1={Math.cos(a) * 9} y1={Math.sin(a) * 9} x2={Math.cos(a) * 30} y2={Math.sin(a) * 30} />;
				})}
			</g>
		);
	if (kind === 'knot')
		return (
			<g stroke={CARD} strokeWidth={4.5} fill="none">
				{[0, 60, 120].map((r) => (
					<ellipse key={r} rx={27} ry={11} transform={`rotate(${r})`} />
				))}
			</g>
		);
	if (kind === 'sparkle') return <path d="M0 -32 C4 -6 6 -4 32 0 C6 4 4 6 0 32 C-4 6 -6 4 -32 0 C-6 -4 -4 -6 0 -32Z" fill={CARD} />;
	if (kind === 'slash') return <line x1={-16} y1={24} x2={16} y2={-24} stroke={CARD} strokeWidth={8} strokeLinecap="round" />;
	return (
		<text textAnchor="middle" dominantBaseline="central" fontFamily={HAND} fontWeight={700} fontSize={46} fill={CARD}>
			{letter}
		</text>
	);
};

const Robot: React.FC<{ player: Player; x: number; y: number; s: number; eyes: Eyes; talk: number; frame: number }> = ({ player, x, y, s, eyes, talk, frame }) => {
	const look = ROBOTS[player.model!];
	const blink = frame % 87 < 3 && eyes === 'normal';
	const dx = eyes === 'side' ? 26 : 0;
	const eyeH = blink ? 3 : eyes === 'side' ? 9 : 13;
	return (
		<g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
			<rect x={-96} y={-196} width={192} height={260} rx={50} fill={look.body} />
			<g transform="translate(0 -140)" stroke="none">
				<EmblemMark kind={look.emblem} letter={player.model!.slice(0, 1)} />
			</g>
			<rect x={-22} y={-216} width={44} height={28} fill={look.body} />
			<path d="M0 -362 C4 -380 12 -384 9 -398" fill="none" />
			<circle cx={10} cy={-408} r={11} fill={RED} />
			<rect x={-84} y={-364} width={168} height={154} rx={24} fill={CARD} />
			<rect x={-68} y={-348} width={136} height={122} rx={16} fill="#17181b" />
			<g stroke="none" fill={look.eye}>
				{eyes === 'smug' ? (
					<>
						<path d="M-50 -290 Q-31 -302 -12 -290" stroke={look.eye} strokeWidth={8} fill="none" strokeLinecap="round" />
						<path d="M12 -290 Q31 -302 50 -290" stroke={look.eye} strokeWidth={8} fill="none" strokeLinecap="round" />
						<path d="M-24 -258 Q0 -242 24 -258" stroke={look.eye} strokeWidth={8} fill="none" strokeLinecap="round" />
					</>
				) : (
					<>
						<rect x={-48 + dx} y={-294 - eyeH / 2} width={34} height={eyeH} rx={eyeH / 2} />
						<rect x={14 + dx} y={-294 - eyeH / 2} width={34} height={eyeH} rx={eyeH / 2} />
						<rect x={-23 + dx / 2} y={-258 - talk / 2} width={46} height={8 + talk} rx={4} />
					</>
				)}
			</g>
		</g>
	);
};

const RobotArms: React.FC<{ player: Player; x: number; s: number }> = ({ player, x, s }) => {
	const body = ROBOTS[player.model!].body;
	return (
		<g>
			{[-1, 1].map((side) => {
				const sx = x + side * 86 * s;
				const sy = ROBOT_BASE - 150 * s;
				const hx = x + side * 74 * s;
				const hy = TABLE.cy - 58;
				const d = `M${sx} ${sy} Q${sx + side * 30 * s} ${(sy + hy) / 2} ${hx} ${hy}`;
				return (
					<g key={side}>
						<path d={d} stroke={INK} strokeWidth={34 * s} fill="none" strokeLinecap="round" />
						<path d={d} stroke={body} strokeWidth={20 * s} fill="none" strokeLinecap="round" />
						<circle cx={hx} cy={hy} r={15 * s} fill={CARD} stroke={INK} strokeWidth={STROKE * s} />
					</g>
				);
			})}
		</g>
	);
};

const Face: React.FC<{ mood: Mood }> = ({ mood }) => {
	const line = { stroke: INK, strokeWidth: 8, strokeLinecap: 'round' as const, fill: 'none' };
	if (mood === 'happy')
		return (
			<g {...line}>
				<path d="M-48 -428 Q-33 -446 -18 -428" />
				<path d="M18 -428 Q33 -446 48 -428" />
				<path d="M-22 -390 Q0 -374 22 -390" />
			</g>
		);
	if (mood === 'shocked')
		return (
			<g>
				<circle cx={-32} cy={-432} r={11} fill={INK} />
				<circle cx={32} cy={-432} r={11} fill={INK} />
				<ellipse cx={0} cy={-382} rx={16} ry={21} fill={INK} />
				<g {...line}>
					<path d="M-52 -468 L-16 -474" />
					<path d="M16 -474 L52 -468" />
				</g>
			</g>
		);
	if (mood === 'worried')
		return (
			<g {...line}>
				<path d="M-52 -452 L-18 -466" />
				<path d="M18 -466 L52 -452" />
				<path d="M-42 -430 L-24 -430" />
				<path d="M24 -430 L42 -430" />
				<path d="M-22 -386 Q-11 -394 0 -386 Q11 -378 22 -386" />
			</g>
		);
	return (
		<g {...line}>
			<path d="M-44 -430 L-22 -430" />
			<path d="M22 -430 L44 -430" />
			<path d="M-18 -388 L18 -388" />
		</g>
	);
};

const Human: React.FC<{ mood: Mood; bob: number; x?: number; y?: number; s?: number }> = ({ mood, bob, x = HUMAN_POS.x, y = HUMAN_POS.y, s = HUMAN_POS.s }) => {
	return (
		<g transform={`translate(${x} ${y + bob}) scale(${s})`} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round">
			<path d="M-170 200 L-170 -190 Q-170 -322 0 -322 Q170 -322 170 -190 L170 200 Z" fill={HUMAN.body} />
			{[-1, 1].map((side) => {
				const arm = `M${side * 150} -250 Q${side * 205} -150 ${side * 178} -40`;
				return (
					<g key={side}>
						<path d={arm} stroke={INK} strokeWidth={40} fill="none" strokeLinecap="round" />
						<path d={arm} stroke={HUMAN.body} strokeWidth={26} fill="none" strokeLinecap="round" />
						<circle cx={side * 178} cy={-36} r={18} fill={HUMAN.head} />
					</g>
				);
			})}
			<g fill="none" strokeLinecap="round">
				<path d="M-34 -516 L-46 -552" />
				<path d="M0 -522 L0 -560" />
				<path d="M34 -516 L46 -552" />
			</g>
			<circle cx={0} cy={-420} r={100} fill={HUMAN.head} />
			<Face mood={mood} />
		</g>
	);
};

const SvgCard: React.FC<{ card: string; x: number; y: number; w: number }> = ({ card, x, y, w }) => {
	const suit = card.slice(-1);
	const red = suit === '♥' || suit === '♦';
	return (
		<g transform={`translate(${x} ${y})`}>
			<rect x={-w / 2} y={-w * 0.7} width={w} height={w * 1.4} rx={8} fill={CARD} stroke={INK} strokeWidth={5} />
			<text textAnchor="middle" y={-w * 0.08} fontFamily={HAND} fontWeight={700} fontSize={w * 0.46} fill={red ? RED : INK}>
				{card.slice(0, -1)}
			</text>
			<text textAnchor="middle" y={w * 0.42} fontFamily={HAND} fontSize={w * 0.42} fill={red ? RED : INK}>
				{suit}
			</text>
		</g>
	);
};

const hexPoints = (cx: number, cy: number, r: number): string =>
	Array.from({ length: 6 }, (_, k) => {
		const a = ((60 * k - 90) * Math.PI) / 180;
		return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a) * 0.58}`;
	}).join(' ');

const TableProps: React.FC<{ spec: ReelSpec; xs: number[] }> = ({ spec, xs }) => {
	const { cx, cy } = TABLE;
	if (spec.game === 'settler-rush') {
		const cells: [number, number][] = [[0, 0], [-72, 0], [72, 0], [-36, -62], [36, -62], [-36, 62], [36, 62]];
		return (
			<g>
				<ellipse cx={cx} cy={cy + 6} rx={190} ry={74} fill="#4a9fd8" stroke={INK} strokeWidth={5} />
				{cells.map(([dx, dy], i) => (
					<polygon key={i} points={hexPoints(cx + dx, cy + 6 + dy * 0.58, 40)} fill={HEX_COLORS[i]} stroke={INK} strokeWidth={4} />
				))}
				<circle cx={cx} cy={cy + 6} r={9} fill={CARD} stroke={INK} strokeWidth={4} />
			</g>
		);
	}
	if (spec.game === 'poker') {
		const board = spec.reveal.kind === 'cards' ? spec.reveal.board : [];
		return (
			<g>
				{board.map((c, i) => (
					<SvgCard key={i} card={c} x={cx + (i - (board.length - 1) / 2) * 62} y={cy + 8} w={50} />
				))}
				{[-1, 1].map((side) => (
					<g key={side}>
						{[0, 1, 2, 3].map((k) => (
							<ellipse key={k} cx={cx + side * 250} cy={cy + 40 - k * 9} rx={26} ry={10} fill={k % 2 ? CARD : RED} stroke={INK} strokeWidth={4} />
						))}
					</g>
				))}
			</g>
		);
	}
	return (
		<g>
			{xs.map((x, i) => (
				<g key={i} transform={`translate(${x} ${cy - 30}) rotate(${(i % 2 ? 1 : -1) * 6})`}>
					<rect x={-22} y={-30} width={44} height={60} rx={6} fill="#3a2a4a" stroke={INK} strokeWidth={4} />
					<text textAnchor="middle" y={12} fontFamily={HAND} fontWeight={700} fontSize={32} fill={CARD}>
						?
					</text>
				</g>
			))}
		</g>
	);
};

const NamePlate: React.FC<{ name: string; x: number }> = ({ name, x }) => {
	const w = 40 + name.length * 22;
	return (
		<g transform={`translate(${x} ${TABLE.cy + TABLE.ry - 30})`}>
			<rect x={-w / 2} y={-26} width={w} height={52} rx={10} fill={CARD} stroke={INK} strokeWidth={5} />
			<text textAnchor="middle" y={12} fontFamily={HAND} fontWeight={700} fontSize={34} fill={INK}>
				{name.toUpperCase()}
			</text>
		</g>
	);
};

const Scene: React.FC<{ spec: ReelSpec; tl: Timeline }> = ({ spec, tl }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const robots = spec.players.filter((p) => p.model);
	const { xs, s } = robotLayout(robots.length);
	const { cx, cy, rx, ry, depth } = TABLE;

	const beatIndex = tl.beats.findIndex((b) => frame >= b.start && frame < b.end);
	const beat = beatIndex >= 0 ? tl.beats[beatIndex] : undefined;
	const speaker = beat ? spec.chat[beatIndex].from : undefined;
	const lieBeat = tl.beats[spec.chat.findIndex((l) => l.lie)];

	const liarEyes = (): Eyes => {
		if (frame >= tl.punchline[0]) return 'smug';
		if (frame >= lieBeat.typingEnd && frame < lieBeat.end) return 'side';
		if (frame >= tl.reveal[0] + 14) return 'side';
		return 'normal';
	};
	const talkFor = (id: string): number => (speaker === id && beat && frame >= beat.typingEnd && frame < beat.typingEnd + 40 ? 4 + 10 * Math.abs(Math.sin(frame / 2.4)) : 0);
	const bobFor = (id: string): number => (speaker === id ? -7 * Math.abs(Math.sin(frame / 4)) : 0);

	const human = spec.players.find((p) => !p.model)!;
	const humanSpoke = spec.chat.some((l, i) => l.from === human.id && frame >= tl.beats[i].typingEnd);
	const mood: Mood =
		frame >= tl.reveal[0] + 70 ? 'worried' : frame >= tl.reveal[0] + 10 ? 'shocked' : humanSpoke || speaker === human.id ? 'happy' : 'neutral';

	const tableIn = pop(frame, fps, 0, 14);
	return (
		<svg viewBox="0 0 1080 1920" width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
			{robots.map((p, i) => {
				const appear = pop(frame, fps, 4 + i * 4);
				return (
					<g key={p.id} transform={`translate(0 ${(1 - appear) * 260 + bobFor(p.id)})`}>
						<Robot player={p} x={xs[i]} y={ROBOT_BASE} s={s} eyes={p.id === spec.liar ? liarEyes() : 'normal'} talk={talkFor(p.id)} frame={frame + i * 23} />
					</g>
				);
			})}
			<g transform={`translate(0 ${(1 - tableIn) * 120})`} opacity={tableIn}>
				<ellipse cx={cx} cy={cy + depth} rx={rx} ry={ry} fill={TABLES[spec.game].rim} stroke={INK} strokeWidth={STROKE} />
				<rect x={cx - rx} y={cy} width={rx * 2} height={depth} fill={TABLES[spec.game].rim} />
				<line x1={cx - rx} y1={cy} x2={cx - rx} y2={cy + depth} stroke={INK} strokeWidth={STROKE} />
				<line x1={cx + rx} y1={cy} x2={cx + rx} y2={cy + depth} stroke={INK} strokeWidth={STROKE} />
				<ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={TABLES[spec.game].rim} stroke={INK} strokeWidth={STROKE} />
				<ellipse cx={cx} cy={cy} rx={rx - 30} ry={ry - 18} fill={TABLES[spec.game].top} stroke={INK} strokeWidth={5} />
				<TableProps spec={spec} xs={xs} />
			</g>
			{robots.map((p, i) => {
				const appear = pop(frame, fps, 4 + i * 4);
				return (
					<g key={p.id} transform={`translate(0 ${(1 - appear) * 260 + bobFor(p.id)})`} opacity={appear}>
						<RobotArms player={p} x={xs[i]} s={s} />
					</g>
				);
			})}
			{robots.map((p, i) => (
				<g key={p.id} opacity={tableIn}>
					<NamePlate name={p.name} x={xs[i]} />
				</g>
			))}
			<g transform={`translate(0 ${(1 - pop(frame, fps, 16)) * 500})`}>
				<Human mood={mood} bob={bobFor(human.id)} />
			</g>
		</svg>
	);
};

const Tail: React.FC<{ x: number }> = ({ x }) => (
	<svg width={90} height={64} style={{ position: 'absolute', bottom: -56, left: x - 45, overflow: 'visible' }}>
		<path d="M18 0 L46 58 L68 0" fill={CARD} stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
		<rect x={14} y={-10} width={58} height={10} fill={CARD} />
	</svg>
);

const Box: React.FC<{ tag?: string; tagColor?: string; children: React.ReactNode; tailX?: number; scale: number; extra?: React.ReactNode }> = ({ tag, tagColor = INK, children, tailX, scale, extra }) => (
	<div style={{ position: 'absolute', left: 64, right: 64, bottom: 1920 - BUBBLE_BOTTOM, display: 'flex', justifyContent: 'center' }}>
		<div
			style={{
				position: 'relative',
				width: '100%',
				background: CARD,
				border: `${STROKE}px solid ${INK}`,
				borderRadius: 34,
				padding: '22px 34px 26px',
				transform: `scale(${scale})`,
				transformOrigin: tailX !== undefined ? `${tailX}px 100%` : '50% 100%',
				opacity: Math.min(1, scale * 1.4),
			}}
		>
			{tag && (
				<div style={{ display: 'inline-block', background: tagColor, color: CARD, fontFamily: HAND, fontWeight: 700, fontSize: 30, letterSpacing: 1.5, padding: '4px 18px', borderRadius: 10, marginBottom: 10, textTransform: 'uppercase' }}>
					{tag}
				</div>
			)}
			{children}
			{tailX !== undefined && <Tail x={tailX} />}
			{extra}
		</div>
	</div>
);

const Dots: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<div style={{ display: 'flex', gap: 14, padding: '14px 0 6px' }}>
			{[0, 1, 2].map((i) => (
				<span key={i} style={{ width: 20, height: 20, borderRadius: 99, background: INK, opacity: 0.3 + 0.7 * Math.max(0, Math.sin((frame - i * 4) / 3)) }} />
			))}
		</div>
	);
};

const Overlay: React.FC<{ spec: ReelSpec; tl: Timeline }> = ({ spec, tl }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const robots = spec.players.filter((p) => p.model);
	const { xs } = robotLayout(robots.length);
	const byId = new Map(spec.players.map((p) => [p.id, p]));
	const game = GAMES[spec.game];
	const text = { fontFamily: HAND, fontWeight: 600, fontSize: 46, lineHeight: 1.2, color: INK } as const;
	const tailFor = (id: string): number => {
		const p = byId.get(id);
		const x = p?.model ? xs[robots.indexOf(p)] : HUMAN_POS.x - 60;
		return Math.min(880, Math.max(70, x - 64));
	};

	if (within(frame, tl.setup)) {
		return (
			<Box tag={game.label} scale={pop(frame, fps, tl.setup[0])}>
				<div style={text}>{spec.setup}</div>
			</Box>
		);
	}
	const i = tl.beats.findIndex((b) => frame >= b.start && frame < b.end);
	if (i >= 0) {
		const line = spec.chat[i];
		const p = byId.get(line.from);
		return (
			<Box tag={p?.name} tagColor={speakerColor(p)} tailX={tailFor(line.from)} scale={pop(frame, fps, tl.beats[i].start, 13)}>
				{frame < tl.beats[i].typingEnd ? <Dots /> : <div style={text}>{line.text}</div>}
			</Box>
		);
	}
	if (within(frame, tl.reveal)) {
		const local = frame - tl.reveal[0];
		if (local < 62) {
			const lie = spec.chat.find((l) => l.lie)!;
			const p = byId.get(spec.liar);
			const strike = interpolate(local, [6, 18], [0, 100], clamp);
			const stamp = pop(local, fps, 12, 9);
			return (
				<Box
					tag={p?.name}
					tagColor={speakerColor(p)}
					tailX={tailFor(spec.liar)}
					scale={1}
					extra={
						<div
							style={{
								position: 'absolute',
								right: -10,
								top: -54,
								fontFamily: HAND,
								fontWeight: 700,
								fontSize: 76,
								color: RED,
								background: CARD,
								border: `7px solid ${RED}`,
								borderRadius: 16,
								padding: '0 22px',
								transform: `rotate(8deg) scale(${2.2 - 1.2 * stamp})`,
								opacity: stamp,
							}}
						>
							LIE!
						</div>
					}
				>
					<div style={text}>
						<span style={{ backgroundImage: `linear-gradient(${RED}, ${RED})`, backgroundRepeat: 'no-repeat', backgroundPosition: '0 58%', backgroundSize: `${strike}% 7px`, WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone' }}>
							{lie.text}
						</span>
					</div>
				</Box>
			);
		}
		return (
			<Box tag="The truth" tagColor={RED} scale={pop(local, fps, 62)}>
				<div style={{ ...text, fontWeight: 700 }}>{spec.reveal.detail}</div>
			</Box>
		);
	}
	if (within(frame, tl.punchline)) {
		return (
			<Box scale={pop(frame, fps, tl.punchline[0])}>
				<div style={{ ...text, fontWeight: 700, fontSize: 58, textAlign: 'center' }}>{spec.punchline}</div>
			</Box>
		);
	}
	return null;
};

const RevealCard: React.FC<{ spec: ReelSpec; tl: Timeline }> = ({ spec, tl }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	if (frame < tl.reveal[0] || frame >= tl.punchline[1]) return null;
	const slam = pop(frame, fps, tl.reveal[0] + 20, 10);
	const r = spec.reveal;
	const liar = spec.players.find((p) => p.id === spec.liar)!;
	const title = r.kind === 'role' ? 'Secret role' : r.kind === 'cards' ? 'Hole cards' : 'Real hand';
	return (
		<div
			style={{
				position: 'absolute',
				left: 70,
				top: 820,
				width: 470,
				background: CARD,
				border: `${STROKE}px solid ${INK}`,
				borderRadius: 18,
				overflow: 'hidden',
				transform: `rotate(-4deg) scale(${1.8 - 0.8 * slam})`,
				opacity: slam,
				boxShadow: `10px 12px 0 ${INK}22`,
			}}
		>
			<div style={{ background: INK, color: CARD, fontFamily: HAND, fontWeight: 700, fontSize: 38, textAlign: 'center', padding: '10px 0', textTransform: 'uppercase', letterSpacing: 1.5 }}>
				{liar.name}'s {title}
			</div>
			<div style={{ padding: '26px 20px 30px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 22, flexWrap: 'wrap' }}>
				{r.kind === 'role' && <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 104, color: RED, textTransform: 'uppercase', lineHeight: 1 }}>{r.role}</div>}
				{r.kind === 'cards' &&
					r.cards.map((c, i) => (
						<svg key={i} width={130} height={180} viewBox="-70 -95 140 190">
							<SvgCard card={c} x={0} y={0} w={120} />
						</svg>
					))}
				{r.kind === 'resources' &&
					r.had.map((h, i) => (
						<div key={i} style={{ fontFamily: HAND, fontWeight: 700, fontSize: 44, color: INK, border: `5px solid ${INK}`, borderRadius: 14, padding: '4px 18px', background: HEX_COLORS[i % HEX_COLORS.length] }}>
							{h}
						</div>
					))}
			</div>
		</div>
	);
};

const Wordmark: React.FC<{ size: number; sub?: boolean }> = ({ size, sub = true }) => (
	<div style={{ fontFamily: LOGO, lineHeight: 1 }}>
		<div style={{ fontSize: size, fontWeight: 800, letterSpacing: -size * 0.03 }}>
			<span style={{ color: INK }}>GG</span>
			<span style={{ color: LOGO_GREY, fontWeight: 700 }}>human</span>
		</div>
		{sub && <div style={{ fontSize: size * 0.36, fontWeight: 700, color: INK, marginTop: size * 0.1 }}>Play vs AI</div>}
	</div>
);

const Pov: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	return (
		<div style={{ position: 'absolute', top: 196, left: 60, right: 60, textAlign: 'center', fontFamily: HAND, color: INK }}>
			<div style={{ fontSize: 82, fontWeight: 700, lineHeight: 1, transform: `scale(${pop(frame, fps, 0)})` }}>POV:</div>
			<div style={{ fontSize: 60, fontWeight: 600, lineHeight: 1.15, marginTop: 14 }}>
				{spec.hook.split(' ').map((w, i) => {
					const s = pop(frame, fps, 4 + i * 2);
					return (
						<span key={i} style={{ display: 'inline-block', marginRight: 15, opacity: s, transform: `translateY(${(1 - s) * 24}px)` }}>
							{w}
						</span>
					);
				})}
			</div>
		</div>
	);
};

const Cta: React.FC<{ spec: ReelSpec; tl: Timeline }> = ({ spec, tl }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const local = frame - tl.cta[0];
	if (local < 0) return null;
	const liar = spec.players.find((p) => p.id === spec.liar)!;
	return (
		<AbsoluteFill style={{ background: PAPER, opacity: interpolate(local, [0, 8], [0, 1], clamp), alignItems: 'center', justifyContent: 'center', gap: 40, textAlign: 'center' }}>
			<div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 84, color: INK, transform: `scale(${pop(local, fps, 2)})` }}>{spec.cta}</div>
			<div style={{ transform: `scale(${pop(local, fps, 10, 10)})` }}>
				<Wordmark size={170} />
			</div>
			<svg viewBox="-300 -400 600 460" width={600} height={460} style={{ opacity: pop(local, fps, 16) }}>
				<Human mood="worried" bob={0} x={-130} y={170} s={0.62} />
				<Robot player={liar} x={130} y={20} s={0.82} eyes="smug" talk={0} frame={local} />
				<ellipse cx={0} cy={40} rx={290} ry={40} fill={TABLES[spec.game].rim} stroke={INK} strokeWidth={STROKE} />
				<ellipse cx={0} cy={30} rx={290} ry={40} fill={TABLES[spec.game].top} stroke={INK} strokeWidth={STROKE} />
			</svg>
			<div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 46, color: CARD, background: INK, borderRadius: 999, padding: '12px 40px', opacity: interpolate(local, [24, 32], [0, 1], clamp) }}>
				gghuman.ai · link in bio
			</div>
		</AbsoluteFill>
	);
};

const Boil: React.FC = () => {
	const frame = useCurrentFrame();
	return (
		<svg width={0} height={0} style={{ position: 'absolute' }}>
			<filter id="boil">
				<feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves={2} seed={Math.floor(frame / 4)} />
				<feDisplacementMap in="SourceGraphic" scale={4} />
			</filter>
		</svg>
	);
};

export const Reel: React.FC<{ spec: ReelSpec }> = ({ spec }) => {
	const tl = buildTimeline(spec);
	return (
		<AbsoluteFill style={{ background: PAPER }}>
			<Boil />
			<AbsoluteFill style={{ filter: 'url(#boil)' }}>
				<Scene spec={spec} tl={tl} />
				<Pov spec={spec} />
				<Overlay spec={spec} tl={tl} />
				<RevealCard spec={spec} tl={tl} />
				<div style={{ position: 'absolute', left: 64, top: 1530 }}>
					<Wordmark size={92} />
					<div style={{ fontFamily: HAND, fontWeight: 500, fontSize: 24, color: LOGO_GREY, marginTop: 14 }}>
						{spec.source.kind === 'dramatization' ? 'Dramatization' : `Real game · ${spec.source.ref}`}
					</div>
				</div>
				<Cta spec={spec} tl={tl} />
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
