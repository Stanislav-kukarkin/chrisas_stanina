import { useMemo, useState } from 'react';
import {
  SHOPPING_UNITS,
  type Recipe,
  type ShoppingImportIngredient,
  type ShoppingImportResult,
  type ShoppingList,
  type ShoppingUnit,
} from '@chrisasstanina/firebase';

interface Props {
  recipe: Recipe;
  lists: ShoppingList[];
  selectedListId: string;
  canSend: boolean;
  sending: boolean;
  result: ShoppingImportResult | null;
  onListChange: (listId: string) => void;
  onSend: (ingredients: ShoppingImportIngredient[]) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function formatQuantity(value: number | null) {
  if (value === null) return '';
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100).replace('.', ',');
}

function shoppingUnit(value: string): ShoppingUnit {
  return SHOPPING_UNITS.includes(value as ShoppingUnit) ? value as ShoppingUnit : 'шт';
}

export function RecipeDetails({ recipe, lists, selectedListId, canSend, sending, result, onListChange, onSend, onEdit, onDelete, onClose }: Props) {
  const [servings, setServings] = useState(recipe.servings);
  const ratio = recipe.servings && servings ? servings / recipe.servings : 1;
  const scaled = useMemo(() => recipe.ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: ingredient.quantity === null ? null : Math.round(ingredient.quantity * ratio * 1000) / 1000,
  })), [ratio, recipe.ingredients]);

  return (
    <div className="recipe-overlay" role="dialog" aria-modal="true" aria-label={recipe.title}>
      <article className="recipe-modal recipe-details">
        <header className="modal-heading">
          <div><p className="eyebrow">МОЙ РЕЦЕПТ</p><h2>{recipe.title}</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>
        {recipe.description && <p className="recipe-description">{recipe.description}</p>}
        <div className="recipe-meta">
          {recipe.servings && <label><span>Порций</span><input type="number" min="1" value={servings ?? ''} onChange={(event) => setServings(event.target.value ? Number(event.target.value) : recipe.servings)} /></label>}
          {recipe.prepMinutes !== null && <span>Подготовка · {recipe.prepMinutes} мин</span>}
          {recipe.cookMinutes !== null && <span>Готовка · {recipe.cookMinutes} мин</span>}
          {recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer">Источник ↗</a>}
        </div>
        <div className="details-columns">
          <section><h3>Ингредиенты</h3><ul className="ingredient-list">{scaled.map((ingredient) => <li key={ingredient.id}><span>{ingredient.name}{ingredient.note && <small>{ingredient.note}</small>}</span><strong>{ingredient.quantity === null ? 'по вкусу' : `${formatQuantity(ingredient.quantity)} ${ingredient.unit}`}</strong></li>)}</ul></section>
          <section><h3>Приготовление</h3><ol className="steps-list">{recipe.steps.map((step, index) => <li key={`${index}-${step}`}><span>{index + 1}</span><p>{step}</p></li>)}</ol></section>
        </div>
        <section className="shopping-action">
          <div><strong>В список покупок</strong><small>{canSend ? 'Добавим новые продукты и уточним только отличающиеся количества' : 'Нужен доступ на редактирование «Покупок»'}</small></div>
          <div className="shopping-controls">
            {lists.length > 1 && <select aria-label="Список покупок" value={selectedListId} onChange={(event) => onListChange(event.target.value)}>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select>}
            <button type="button" className="primary-button" disabled={!canSend || sending} onClick={() => onSend(scaled.map((ingredient) => ({ ...ingredient, unit: shoppingUnit(ingredient.unit) })))}>{sending ? 'Отправляем…' : 'Добавить в список покупок'}</button>
          </div>
        </section>
        {result && result.conflicts.length === 0 && <div className="success-banner"><span>✓</span><p>Добавили {result.added} продуктов, {result.existing} уже были в списке.</p><a href="/apps/shopping">Открыть покупки →</a></div>}
        {result && result.conflicts.length > 0 && <div className="pending-banner"><span>!</span><p>Добавили {result.added} продуктов. Для {result.conflicts.length} позиций сохранено текущее количество.</p><a href="/apps/shopping">Открыть покупки →</a></div>}
        <footer className="details-footer"><button type="button" className="danger-link" onClick={onDelete}>Удалить</button><button type="button" className="secondary-button" onClick={onEdit}>Редактировать</button></footer>
      </article>
    </div>
  );
}
