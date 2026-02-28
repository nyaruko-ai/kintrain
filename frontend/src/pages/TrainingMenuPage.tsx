import { Link } from 'react-router-dom';
import { useAppState } from '../AppState';
import type { TrainingMenuItem } from '../types';

export function TrainingMenuPage() {
  const { data, addMenuItem, updateMenuItem, deleteMenuItem, moveMenuItem } = useAppState();
  const sorted = [...data.menuItems].sort((a, b) => a.order - b.order);

  function onAdd(formData: FormData) {
    const machineName = String(formData.get('machineName') ?? '').trim();
    if (!machineName) {
      return;
    }
    addMenuItem({
      machineName,
      defaultWeightKg: Number(formData.get('defaultWeightKg') ?? 0),
      defaultReps: Number(formData.get('defaultReps') ?? 0),
      defaultSets: Number(formData.get('defaultSets') ?? 0)
    });
  }

  return (
    <div className="stack-lg">
      <section className="card">
        <div className="row-between">
          <h1>トレーニングメニュー</h1>
          <Link to="/training-menu/ai-generate" className="btn ghost">
            AIでメニュー生成
          </Link>
        </div>
        <p className="muted">追加・更新・削除・並び替え。並び順は優先順位同点時の基準として使います。</p>
      </section>

      <section className="card">
        <h2>新規追加</h2>
        <form
          className="input-grid menu-add"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            onAdd(new FormData(form));
            form.reset();
          }}
        >
          <label>
            マシン名
            <input name="machineName" required />
          </label>
          <label>
            重量
            <input name="defaultWeightKg" type="number" step="0.5" min="0" required />
          </label>
          <label>
            回数
            <input name="defaultReps" type="number" step="1" min="1" required />
          </label>
          <label>
            セット
            <input name="defaultSets" type="number" step="1" min="1" required />
          </label>
          <button className="btn primary" type="submit">
            追加
          </button>
        </form>
      </section>

      <section className="stack-md">
        {sorted.map((item) => (
          <MenuItemCard
            key={item.id}
            item={item}
            onUpdate={(patch) => updateMenuItem(item.id, patch)}
            onDelete={() => deleteMenuItem(item.id)}
            onMoveUp={() => moveMenuItem(item.id, -1)}
            onMoveDown={() => moveMenuItem(item.id, 1)}
          />
        ))}
      </section>
    </div>
  );
}

function MenuItemCard({
  item,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown
}: {
  item: TrainingMenuItem;
  onUpdate: (patch: Partial<TrainingMenuItem>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <article className="card">
      <div className="row-between align-start gap-sm">
        <div>
          <p className="priority-chip">順序 {item.order}</p>
          <h2>{item.machineName}</h2>
        </div>
        <div className="row-wrap">
          <button type="button" className="btn subtle" onClick={onMoveUp}>
            ↑
          </button>
          <button type="button" className="btn subtle" onClick={onMoveDown}>
            ↓
          </button>
          <button type="button" className="btn danger" onClick={onDelete}>
            削除
          </button>
        </div>
      </div>

      <div className="input-grid menu-item-grid">
        <label>
          マシン名
          <input value={item.machineName} onChange={(e) => onUpdate({ machineName: e.target.value })} />
        </label>
        <label>
          既定重量
          <input
            type="number"
            min={0}
            step={0.5}
            value={item.defaultWeightKg}
            onChange={(e) => onUpdate({ defaultWeightKg: Number(e.target.value) })}
          />
        </label>
        <label>
          既定回数
          <input
            type="number"
            min={1}
            step={1}
            value={item.defaultReps}
            onChange={(e) => onUpdate({ defaultReps: Number(e.target.value) })}
          />
        </label>
        <label>
          既定セット
          <input
            type="number"
            min={1}
            step={1}
            value={item.defaultSets}
            onChange={(e) => onUpdate({ defaultSets: Number(e.target.value) })}
          />
        </label>
      </div>
    </article>
  );
}
