import { useState } from 'react';
import { SHOPPING_UNITS, type ShoppingConflictDecision, type ShoppingImportResult, type ShoppingUnit } from '@chrisasstanina/firebase';

interface Props {
  result: ShoppingImportResult;
  resolving: boolean;
  onResolve: (decisions: ShoppingConflictDecision[]) => Promise<void>;
  onClose: () => void;
}

function amount(quantity: number | null, unit: ShoppingUnit) {
  return quantity === null ? 'по вкусу' : `${quantity} ${unit}`;
}

function baseAmount(quantity: number, unit: ShoppingUnit) {
  if (unit === 'кг') return { group: 'mass', value: quantity * 1000 };
  if (unit === 'г') return { group: 'mass', value: quantity };
  if (unit === 'л') return { group: 'volume', value: quantity * 1000 };
  if (unit === 'мл') return { group: 'volume', value: quantity };
  return { group: unit, value: quantity };
}

function summedAmount(currentQuantity: number | null, currentUnit: ShoppingUnit, requestedQuantity: number | null, requestedUnit: ShoppingUnit) {
  if (currentQuantity === null || requestedQuantity === null) return null;
  const current = baseAmount(currentQuantity, currentUnit);
  const requested = baseAmount(requestedQuantity, requestedUnit);
  if (current.group !== requested.group) return null;
  const base = current.value + requested.value;
  if (currentUnit === 'кг' || currentUnit === 'л') return Math.round(base / 1000 * 1000) / 1000;
  return Math.round(base * 1000) / 1000;
}

export function ConflictModal({ result, resolving, onResolve, onClose }: Props) {
  const [decisions, setDecisions] = useState<Record<string, ShoppingConflictDecision>>(() => Object.fromEntries(
    result.conflicts.map((conflict) => [conflict.id, { conflictId: conflict.id, action: 'keep' }]),
  ));
  const [error, setError] = useState('');

  function update(conflictId: string, update: Partial<ShoppingConflictDecision>) {
    setDecisions((current) => ({ ...current, [conflictId]: { ...current[conflictId], conflictId, ...update } as ShoppingConflictDecision }));
  }

  async function submit() {
    setError('');
    try {
      await onResolve(Object.values(decisions));
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : String(resolveError));
    }
  }

  return (
    <div className="recipe-overlay conflict-layer" role="dialog" aria-modal="true" aria-label="Конфликты списка покупок">
      <section className="recipe-modal conflict-modal">
        <header className="modal-heading">
          <div><p className="eyebrow">НУЖНО УТОЧНЕНИЕ</p><h2>Количество уже отличается</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        <p className="modal-description">Новые продукты уже добавлены. Выберите итог только для позиций ниже. Если закрыть окно, текущие количества сохранятся.</p>
        <div className="conflict-list">
          {result.conflicts.map((conflict) => {
            const decision = decisions[conflict.id];
            const sum = summedAmount(conflict.currentQuantity, conflict.currentUnit, conflict.requestedQuantity, conflict.requestedUnit);
            return <article className="conflict-card" key={conflict.id}>
              <div className="conflict-title"><strong>{conflict.name}</strong><span>{amount(conflict.currentQuantity, conflict.currentUnit)} → {amount(conflict.requestedQuantity, conflict.requestedUnit)}</span></div>
              <label><input type="radio" name={conflict.id} checked={decision?.action === 'keep'} onChange={() => update(conflict.id, { action: 'keep' })} /><span><strong>Оставить {amount(conflict.currentQuantity, conflict.currentUnit)}</strong><small>Текущая запись устраивает</small></span></label>
              <label><input type="radio" name={conflict.id} checked={decision?.action === 'set'} onChange={() => update(conflict.id, { action: 'set' })} /><span><strong>Установить {amount(conflict.requestedQuantity, conflict.requestedUnit)}</strong><small>Столько всего нужно купить</small></span></label>
              <label className={sum === null ? 'disabled-option' : ''}><input type="radio" name={conflict.id} disabled={sum === null} checked={decision?.action === 'add'} onChange={() => update(conflict.id, { action: 'add' })} /><span><strong>{sum === null ? 'Нельзя сложить разные единицы' : `Увеличить до ${sum} ${conflict.currentUnit}`}</strong><small>{sum === null ? 'Выберите итоговое количество вручную' : 'Текущее было запланировано для другого блюда'}</small></span></label>
              <label><input type="radio" name={conflict.id} checked={decision?.action === 'custom'} onChange={() => update(conflict.id, { action: 'custom', quantity: conflict.requestedQuantity, unit: conflict.requestedUnit })} /><span><strong>Ввести своё количество</strong><small>Любое итоговое значение</small></span></label>
              {decision?.action === 'custom' && <div className="custom-amount"><input type="number" min="0" step="any" value={decision.quantity ?? ''} onChange={(event) => update(conflict.id, { quantity: event.target.value ? Number(event.target.value) : null })} /><select value={decision.unit ?? conflict.requestedUnit} onChange={(event) => update(conflict.id, { unit: event.target.value as ShoppingUnit })}>{SHOPPING_UNITS.map((unit) => <option key={unit}>{unit}</option>)}</select></div>}
            </article>;
          })}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Оставить как есть</button><button type="button" className="primary-button" disabled={resolving} onClick={submit}>{resolving ? 'Применяем…' : 'Применить выбранное'}</button></footer>
      </section>
    </div>
  );
}
