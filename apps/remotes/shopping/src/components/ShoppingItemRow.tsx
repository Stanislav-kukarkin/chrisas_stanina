import {
  SHOPPING_CATEGORIES,
  SHOPPING_UNITS,
  type FamilyMemberWithProfile,
  type ShoppingItem,
  type ShoppingItemUpdate,
} from '@chrisasstanina/firebase';
import { GlassPanel, SpringCheck } from '@chrisasstanina/ui';
import { useShoppingUiStore } from '../stores/shopping-ui-store';

interface ShoppingItemRowProps {
  item: ShoppingItem;
  members: FamilyMemberWithProfile[];
  creatorLabel: string;
  creatorEmoji: string;
  creatorColor: string;
  onToggle: (itemId: string, checked: boolean) => void;
  onUpdate: (itemId: string, update: ShoppingItemUpdate) => void;
  onDelete: (itemId: string) => void;
  onAddFavorite: (item: ShoppingItem) => void;
  readOnly?: boolean;
}

export function ShoppingItemRow({
  item,
  members,
  creatorLabel,
  creatorEmoji,
  creatorColor,
  onToggle,
  onUpdate,
  onDelete,
  onAddFavorite,
  readOnly = false,
}: ShoppingItemRowProps) {
  const expandedItemId = useShoppingUiStore((state) => state.expandedItemId);
  const toggleExpandedItem = useShoppingUiStore((state) => state.toggleExpandedItem);
  const expanded = expandedItemId === item.id;

  const creatorBadge = (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs text-zinc-200"
      style={{ backgroundColor: `${creatorColor}33`, border: `1px solid ${creatorColor}55` }}
      title={`Добавил: ${creatorLabel}`}
    >
      <span aria-hidden>{creatorEmoji}</span>
      <span className="truncate">{creatorLabel}</span>
    </span>
  );

  return (
    <GlassPanel animated={false} className="border-zinc-800/90 bg-zinc-900/50">
      <div className="px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {readOnly ? (
            <span className="flex min-w-0 flex-1 items-center gap-3 text-zinc-100">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${item.checked ? 'border-violet-400 bg-violet-500 text-white' : 'border-zinc-600 bg-zinc-950'}`} aria-hidden>
                {item.checked ? '✓' : ''}
              </span>
              <span className={`min-w-0 truncate ${item.checked ? 'text-zinc-500 line-through' : ''}`}>
                {item.important && <span className="mr-1 text-amber-400">★</span>}
                {item.name}
              </span>
            </span>
          ) : <SpringCheck
            checked={item.checked}
            onChange={(checked) => onToggle(item.id, checked)}
            label={
              <>
                {item.important && <span className="mr-1 text-amber-400">★</span>}
                {item.name}
              </>
            }
            ariaLabel={item.name}
            color="#f4f4f5"
            fillColor="#8b5cf6"
            checkColor="#fafafa"
            boxSize={28}
            boxRadius={6}
            fontSize={16}
            bounce={0.2}
            strikeLag={0.08}
            doneOpacity={0.58}
            strike="left"
            className="min-w-0 flex-1"
          />}
          <span className="inline-flex shrink-0 items-center rounded-md bg-zinc-800/80 px-2 py-1.5 text-xs text-zinc-200">
            {item.quantity} {item.unit}
          </span>
          <span className="hidden shrink-0 sm:inline-flex">{creatorBadge}</span>
          <button
            type="button"
            onClick={() => toggleExpandedItem(item.id)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition ${expanded ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
            aria-label={readOnly ? 'Подробнее о товаре' : 'Редактировать товар'}
            aria-expanded={expanded}
            aria-controls={`shopping-item-details-${item.id}`}
            title={readOnly ? 'Подробнее о товаре' : 'Редактировать товар'}
          >
            {readOnly ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path fillRule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 1.5a6.5 6.5 0 110 13 6.5 6.5 0 010-13zM10 8a.75.75 0 01.75.75v4a.75.75 0 01-1.5 0v-4A.75.75 0 0110 8zm0-2a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden>
                <path d="M13.586 3.586a2 2 0 012.828 2.828l-8.5 8.5a2 2 0 01-.878.513l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.513-.878l8.185-8.185zM12.525 5.707L5.46 12.772a.5.5 0 00-.128.22l-.5 1.75 1.75-.5a.5.5 0 00.22-.128l7.065-7.065-1.343-1.342zM14.646 4.646l1.06 1.06a.5.5 0 000-.707l-.353-.353a.5.5 0 00-.707 0z" />
              </svg>
            )}
          </button>
          {!readOnly && <button
            type="button"
            onClick={() => onDelete(item.id)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-red-500/10 hover:text-red-400"
            aria-label="Удалить"
            title="Удалить"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-5 w-5"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 9.24A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-9.24.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                clipRule="evenodd"
              />
            </svg>
          </button>}
        </div>
        <div className="mt-1.5 pl-10 sm:hidden">{creatorBadge}</div>
      </div>

      {expanded && (
        <div id={`shopping-item-details-${item.id}`} className="space-y-3 border-t border-zinc-800/80 px-3 py-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-400">Количество</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
                disabled={readOnly}
                onChange={(event) =>
                  onUpdate(item.id, { quantity: Number(event.target.value) || 1 })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-400">Единица</span>
              <select
                value={item.unit}
                disabled={readOnly}
                onChange={(event) =>
                  onUpdate(item.id, { unit: event.target.value as ShoppingItem['unit'] })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
              >
                {SHOPPING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Категория</span>
            <select
              value={item.category ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                onUpdate(item.id, { category: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            >
              <option value="">Без категории</option>
              {SHOPPING_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Заметка</span>
            <input
              value={item.note ?? ''}
              disabled={readOnly}
              onChange={(event) => onUpdate(item.id, { note: event.target.value || undefined })}
              placeholder="Не жирный, если нет — не брать"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Кто купит</span>
            <select
              value={item.assigneeUid ?? ''}
              disabled={readOnly}
              onChange={(event) =>
                onUpdate(item.id, { assigneeUid: event.target.value || undefined })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            >
              <option value="">Не назначено</option>
              {members.map((member) => (
                <option key={member.uid} value={member.uid}>
                  {member.profile?.emoji} {member.profile?.displayName ?? member.email}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Магазин</span>
            <input
              value={item.store ?? ''}
              disabled={readOnly}
              onChange={(event) => onUpdate(item.id, { store: event.target.value || undefined })}
              placeholder="Пятёрочка, Ашан..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            />
          </label>

          {!readOnly && <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onUpdate(item.id, { important: !item.important })}
              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                item.important
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {item.important ? '★ Важно' : '☆ Отметить важным'}
            </button>
            <button
              type="button"
              onClick={() => onAddFavorite(item)}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-violet-500/50 hover:text-violet-300"
            >
              В избранное
            </button>
            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 transition hover:bg-red-500/10"
            >
              Удалить
            </button>
          </div>}
        </div>
      )}
    </GlassPanel>
  );
}
