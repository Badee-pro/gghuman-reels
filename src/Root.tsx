import { Composition, type CalculateMetadataFunction } from 'remotion';
import { Reel } from './Reel';
import { ReelSpecSchema, type ReelSpec } from './schema';
import { buildTimeline, FPS, HEIGHT, WIDTH } from './timing';
import sample from '../specs/01-last-vote-claude-mafia.json';

type Props = { spec: ReelSpec };

const calculateMetadata: CalculateMetadataFunction<Props> = ({ props }) => {
	const spec = ReelSpecSchema.parse(props.spec);
	return { durationInFrames: buildTimeline(spec).total, props: { spec } };
};

export const RemotionRoot: React.FC = () => (
	<Composition
		id="Reel"
		component={Reel}
		fps={FPS}
		width={WIDTH}
		height={HEIGHT}
		durationInFrames={300}
		defaultProps={{ spec: ReelSpecSchema.parse(sample) }}
		calculateMetadata={calculateMetadata}
	/>
);
