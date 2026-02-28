import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppState } from '../AppState';
import { addMonths, getDaysInMonth, pad2, toYm, weekdayIndex } from '../utils/date';

const weekdayLabels = ['日', '月', '火', '水', '木', '金', '土'];

const conditionIcons: Record<number, string> = {
  1: '😵',
  2: '😟',
  3: '😐',
  4: '🙂',
  5: '😄'
};

export function CalendarPage() {
  const { data } = useAppState();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const currentYm = params.get('month') ?? toYm(new Date());

  const cells = useMemo(() => {
    const [year, month] = currentYm.split('-').map(Number);
    const firstYmd = `${year}-${pad2(month)}-01`;
    const daysInMonth = getDaysInMonth(currentYm);
    const startOffset = weekdayIndex(firstYmd);

    const result: Array<{ ymd: string | null }> = Array.from({ length: startOffset }).map(() => ({ ymd: null }));
    for (let d = 1; d <= daysInMonth; d += 1) {
      result.push({ ymd: `${year}-${pad2(month)}-${pad2(d)}` });
    }
    while (result.length % 7 !== 0) {
      result.push({ ymd: null });
    }
    return result;
  }, [currentYm]);

  const trainedDates = new Set(data.gymVisits.map((visit) => visit.date));

  return (
    <div className="stack-lg">
      <section className="card">
        <div className="row-between">
          <h1>カレンダー</h1>
          <Link to="/dashboard" className="btn ghost">
            ダッシュボードへ
          </Link>
        </div>

        <div className="row-between">
          <button type="button" className="btn subtle" onClick={() => setParams({ month: addMonths(currentYm, -1) })}>
            前月
          </button>
          <h2>{currentYm.replace('-', ' / ')}</h2>
          <button type="button" className="btn subtle" onClick={() => setParams({ month: addMonths(currentYm, 1) })}>
            次月
          </button>
        </div>

        <div className="calendar-grid calendar-weekdays">
          {weekdayLabels.map((label) => (
            <div key={label} className="calendar-weekday">
              {label}
            </div>
          ))}
        </div>

        <div className="calendar-grid">
          {cells.map((cell, idx) => {
            if (!cell.ymd) {
              return <div className="calendar-cell empty" key={`empty-${idx}`} />;
            }
            const isTrained = trainedDates.has(cell.ymd);
            const record = data.dailyRecords[cell.ymd];
            const rating = record?.conditionRating;

            return (
              <button
                type="button"
                className={isTrained ? 'calendar-cell trained' : 'calendar-cell'}
                key={cell.ymd}
                onClick={() => navigate(`/daily/${cell.ymd}`)}
              >
                <span className="day-number">{Number(cell.ymd.slice(-2))}</span>
                {isTrained && <span className="train-dot">●</span>}
                <span className="condition-icon">{rating ? conditionIcons[rating] : '○'}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
