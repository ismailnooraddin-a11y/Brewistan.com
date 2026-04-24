import { readableContrast } from '@/lib/utils';

type Props = {
  cafeName: string;
  primary: string;
  secondary: string;
  watermarkOn: boolean;
  stamps: number;
  stampsRequired: number;
  rewardText: string;
  rewardsEarned?: number;
  size?: 'md' | 'lg';
};

export function LoyaltyCard({
  cafeName, primary, secondary, watermarkOn, stamps, stampsRequired, rewardText, rewardsEarned = 0, size = 'md',
}: Props) {
  const textColor = readableContrast(primary);
  const logoInitial = cafeName.charAt(0).toUpperCase();
  const clamp = Math.min(stamps, stampsRequired);

  return (
    <div
      className={size === 'lg' ? 'wallet-card' : 'loyalty-card'}
      data-watermark={watermarkOn ? cafeName : ''}
      style={{
        background: `linear-gradient(135deg, ${primary}, ${secondary})`,
        color: textColor,
      }}
    >
      <div className="loyalty-card-top">
        <div>
          <div className="loyalty-card-sub" style={{ color: `${textColor}99` }}>Brewistan card</div>
          <h4 style={{ color: textColor }}>{cafeName}</h4>
        </div>
        <div className="logo-circle" style={{ color: textColor }}>{logoInitial}</div>
      </div>
      <div
        className="dots"
        role="progressbar"
        aria-valuenow={clamp}
        aria-valuemin={0}
        aria-valuemax={stampsRequired}
        aria-label={`${clamp} of ${stampsRequired} stamps`}
      >
        {Array.from({ length: stampsRequired }).map((_, i) => (
          <span key={i} className={`dot ${i < clamp ? 'on' : ''}`} />
        ))}
      </div>
      <div className="loyalty-card-meta">
        <span>{clamp} / {stampsRequired}</span>
        <span>{rewardsEarned > 0 ? `${rewardsEarned} reward${rewardsEarned > 1 ? 's' : ''} earned` : 'No rewards yet'}</span>
      </div>
      <div className="loyalty-card-meta" style={{ marginTop: 4 }}>
        <span>Reward</span>
        <span>{rewardText}</span>
      </div>
    </div>
  );
}
