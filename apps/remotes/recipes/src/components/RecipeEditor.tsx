import { useState, type FormEvent } from 'react';
import { SHOPPING_UNITS, type RecipeIngredient, type RecipeInput, type ShoppingUnit } from '@chrisasstanina/firebase';

interface Props {
  initial: RecipeInput;
  saving: boolean;
  onSave: (recipe: RecipeInput) => Promise<void>;
  onCancel: () => void;
}

function ingredientId() {
  return crypto.randomUUID();
}

export function RecipeEditor({ initial, saving, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');

  function updateIngredient(index: number, update: Partial<RecipeIngredient>) {
    setDraft((current) => ({
      ...current,
      ingredients: current.ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, ...update } : item),
    }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalized = {
      ...draft,
      title: draft.title.trim(),
      ingredients: draft.ingredients.filter((item) => item.name.trim()),
      steps: draft.steps.map((step) => step.trim()).filter(Boolean),
    };
    if (!normalized.title) return setError('Укажите название рецепта.');
    if (normalized.ingredients.length === 0) return setError('Добавьте хотя бы один ингредиент.');
    if (normalized.steps.length === 0) return setError('Добавьте хотя бы один шаг приготовления.');
    setError('');
    try {
      await onSave(normalized);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    }
  }

  return (
    <div className="recipe-overlay" role="dialog" aria-modal="true" aria-label="Редактор рецепта">
      <form onSubmit={submit} className="recipe-modal recipe-editor">
        <header className="modal-heading">
          <div>
            <p className="eyebrow">ЕДИНЫЙ ЧЕРНОВИК</p>
            <h2>{initial.title ? 'Редактировать рецепт' : 'Новый рецепт'}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Закрыть">×</button>
        </header>

        <div className="editor-grid">
          <label className="field field-wide">
            <span>Название *</span>
            <input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Например, сырники" />
          </label>
          <label className="field field-wide">
            <span>Описание</span>
            <textarea rows={2} value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Короткая заметка о рецепте" />
          </label>
          <label className="field">
            <span>Порций</span>
            <input type="number" min="1" value={draft.servings ?? ''} onChange={(event) => setDraft({ ...draft, servings: event.target.value ? Number(event.target.value) : null })} placeholder="4" />
          </label>
          <label className="field">
            <span>Подготовка, мин</span>
            <input type="number" min="0" value={draft.prepMinutes ?? ''} onChange={(event) => setDraft({ ...draft, prepMinutes: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label className="field">
            <span>Готовка, мин</span>
            <input type="number" min="0" value={draft.cookMinutes ?? ''} onChange={(event) => setDraft({ ...draft, cookMinutes: event.target.value ? Number(event.target.value) : null })} />
          </label>
          <label className="field field-wide">
            <span>Источник</span>
            <input type="url" value={draft.sourceUrl ?? ''} onChange={(event) => setDraft({ ...draft, sourceUrl: event.target.value })} placeholder="https://…" />
          </label>
        </div>

        <section className="editor-section">
          <div className="section-title-row">
            <div><p className="eyebrow">СОСТАВ</p><h3>Ингредиенты</h3></div>
            <button type="button" className="secondary-button" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, { id: ingredientId(), name: '', quantity: null, unit: 'шт' }] }))}>+ Ингредиент</button>
          </div>
          <div className="ingredient-editor-list">
            {draft.ingredients.map((ingredient, index) => (
              <div className="ingredient-editor-row" key={ingredient.id}>
                <input aria-label={`Ингредиент ${index + 1}`} className="ingredient-name" value={ingredient.name} onChange={(event) => updateIngredient(index, { name: event.target.value })} placeholder="Название" />
                <input aria-label="Количество" type="number" min="0" step="any" value={ingredient.quantity ?? ''} onChange={(event) => updateIngredient(index, { quantity: event.target.value ? Number(event.target.value) : null })} placeholder="—" />
                <select aria-label="Единица" value={ingredient.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value as ShoppingUnit })}>
                  {SHOPPING_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <input aria-label="Примечание" value={ingredient.note ?? ''} onChange={(event) => updateIngredient(index, { note: event.target.value })} placeholder="мелко нарезать" />
                <button type="button" className="remove-button" onClick={() => setDraft((current) => ({ ...current, ingredients: current.ingredients.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Удалить ингредиент">×</button>
              </div>
            ))}
          </div>
        </section>

        <section className="editor-section">
          <div className="section-title-row">
            <div><p className="eyebrow">ПРИГОТОВЛЕНИЕ</p><h3>Шаги</h3></div>
            <button type="button" className="secondary-button" onClick={() => setDraft((current) => ({ ...current, steps: [...current.steps, ''] }))}>+ Шаг</button>
          </div>
          <div className="step-editor-list">
            {draft.steps.map((step, index) => (
              <div className="step-editor-row" key={`${index}-${draft.steps.length}`}>
                <span>{index + 1}</span>
                <textarea rows={2} value={step} onChange={(event) => setDraft((current) => ({ ...current, steps: current.steps.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder="Что нужно сделать" />
                <button type="button" className="remove-button" onClick={() => setDraft((current) => ({ ...current, steps: current.steps.filter((_, itemIndex) => itemIndex !== index) }))} aria-label="Удалить шаг">×</button>
              </div>
            ))}
          </div>
        </section>

        {error && <p className="form-error" role="alert">{error}</p>}
        <footer className="modal-actions">
          <button type="button" className="secondary-button" onClick={onCancel}>Отмена</button>
          <button type="submit" className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить рецепт'}</button>
        </footer>
      </form>
    </div>
  );
}
