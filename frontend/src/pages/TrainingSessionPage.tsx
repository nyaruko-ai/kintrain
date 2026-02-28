import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState, useTodayYmd } from '../AppState';
import type { SetDetail } from '../types';
import { ymdToDisplay } from '../utils/date';
import { getLastPerformance, getPrioritizedMenuItems } from '../utils/training';

function toNumber(value: string): number | undefined {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

export function TrainingSessionPage() {
  const { data, setDraftEntry, setDraftSetDetails, clearDraft, finalizeTrainingSession } = useAppState();
  const today = useTodayYmd();
  const navigate = useNavigate();
  const [openSetDetailIds, setOpenSetDetailIds] = useState<Record<string, boolean>>({});
  const [statusText, setStatusText] = useState('');

  const draftEntries = data.trainingDraft?.entriesByItemId ?? {};
  const prioritized = useMemo(
    () =>
      getPrioritizedMenuItems({
        menuItems: data.menuItems,
        gymVisits: data.gymVisits,
        todayYmd: today,
        draftEntriesByItemId: draftEntries
      }),
    [data.menuItems, data.gymVisits, today, draftEntries]
  );

  function initSetDetails(menuItemId: string, sets: number, weightKg: number, reps: number) {
    const details: SetDetail[] = Array.from({ length: Math.max(1, sets) }).map((_, idx) => ({
      setIndex: idx + 1,
      weightKg,
      reps
    }));
    setDraftSetDetails(menuItemId, details);
  }

  return (
    <div className="stack-lg">
      <section className="card card-highlight">
        <div className="row-between">
          <div>
            <h1>トレーニング実施</h1>
            <p className="muted">{ymdToDisplay(today)} / 優先順に実施して、最後に確定保存</p>
          </div>
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              clearDraft();
              setStatusText('途中入力をクリアしました。');
            }}
          >
            下書きをクリア
          </button>
        </div>

        {data.trainingDraft ? (
          <p className="muted">下書き保存中: {data.trainingDraft.updatedAtLocal.replace('T', ' ').slice(0, 16)}</p>
        ) : (
          <p className="muted">まだ入力はありません。入力すると自動で下書き保存されます。</p>
        )}
        {statusText && <p className="status-text">{statusText}</p>}
      </section>

      <section className="stack-md">
        {prioritized.map((item, index) => {
          const draft = draftEntries[item.id];
          const last = getLastPerformance(item.id, data.gymVisits);
          const weightValue = draft?.weightKg ?? item.defaultWeightKg;
          const repsValue = draft?.reps ?? item.defaultReps;
          const setsValue = draft?.sets ?? item.defaultSets;
          const isDetailOpen = !!openSetDetailIds[item.id];

          return (
            <article className="card" key={item.id}>
              <div className="row-between align-start gap-sm">
                <div>
                  <p className="priority-chip">優先 {index + 1}</p>
                  <h2>{item.machineName}</h2>
                  <p className="muted">
                    直近: {last ? `${ymdToDisplay(last.date)} ${last.weightKg}kg x ${last.reps}回 x ${last.sets}set` : '実績なし'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    if (!last) {
                      return;
                    }
                    setDraftEntry(item.id, {
                      menuItemId: item.id,
                      weightKg: last.weightKg,
                      reps: last.reps,
                      sets: last.sets
                    });
                    setStatusText(`${item.machineName} に前回値を入力しました。`);
                  }}
                  disabled={!last}
                >
                  前回と同じ
                </button>
              </div>

              <div className="input-grid">
                <label>
                  重量 (kg)
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    value={weightValue}
                    onChange={(e) => setDraftEntry(item.id, { menuItemId: item.id, weightKg: toNumber(e.target.value) })}
                  />
                </label>
                <label>
                  回数
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={repsValue}
                    onChange={(e) => setDraftEntry(item.id, { menuItemId: item.id, reps: toNumber(e.target.value) })}
                  />
                </label>
                <label>
                  セット
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={setsValue}
                    onChange={(e) => setDraftEntry(item.id, { menuItemId: item.id, sets: toNumber(e.target.value) })}
                  />
                </label>
              </div>

              <div className="row-wrap">
                <button
                  type="button"
                  className="btn subtle"
                  onClick={() => {
                    const nowOpen = !isDetailOpen;
                    setOpenSetDetailIds((prev) => ({ ...prev, [item.id]: nowOpen }));
                    if (nowOpen && (!draft?.setDetails || draft.setDetails.length === 0)) {
                      initSetDetails(item.id, Math.max(1, setsValue), weightValue, repsValue);
                    }
                  }}
                >
                  {isDetailOpen ? 'セット詳細を閉じる' : 'セット詳細を入力'}
                </button>
              </div>

              {isDetailOpen && (
                <div className="set-detail-list">
                  {(draft?.setDetails ?? []).map((detail, detailIndex) => (
                    <div className="set-detail-row" key={detail.setIndex}>
                      <span>{detail.setIndex}set</span>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={detail.weightKg}
                        onChange={(e) => {
                          const next = [...(draft?.setDetails ?? [])];
                          next[detailIndex] = {
                            ...detail,
                            weightKg: Number(e.target.value)
                          };
                          setDraftSetDetails(item.id, next);
                        }}
                      />
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={detail.reps}
                        onChange={(e) => {
                          const next = [...(draft?.setDetails ?? [])];
                          next[detailIndex] = {
                            ...detail,
                            reps: Number(e.target.value)
                          };
                          setDraftSetDetails(item.id, next);
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="sticky-action">
        <button
          type="button"
          className="btn primary large"
          onClick={() => {
            const result = finalizeTrainingSession(today);
            if (result.savedCount === 0) {
              setStatusText('有効な入力がないため保存されませんでした。');
              return;
            }
            navigate(`/daily/${today}`);
          }}
        >
          記録して終了
        </button>
      </section>
    </div>
  );
}
