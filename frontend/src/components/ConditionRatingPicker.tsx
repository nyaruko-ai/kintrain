import type { ConditionRating } from '../types';

const icons: Record<ConditionRating, string> = {
  1: '😵',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '😄'
};

const labels: Record<ConditionRating, string> = {
  1: '最悪',
  2: '不調',
  3: '普通',
  4: '良い',
  5: '最高'
};

export function ConditionRatingPicker({
  value,
  onChange,
  compact = false
}: {
  value?: ConditionRating;
  onChange: (value: ConditionRating) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'rating-picker compact' : 'rating-picker'}>
      {[1, 2, 3, 4, 5].map((n) => {
        const rating = n as ConditionRating;
        const selected = value === rating;
        return (
          <button
            type="button"
            key={rating}
            className={selected ? 'rating-button selected' : 'rating-button'}
            onClick={() => onChange(rating)}
            title={`${rating}: ${labels[rating]}`}
          >
            <span>{icons[rating]}</span>
            {!compact && <small>{labels[rating]}</small>}
          </button>
        );
      })}
    </div>
  );
}
