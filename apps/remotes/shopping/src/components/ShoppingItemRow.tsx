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
}: ShoppingItemRowProps) {
  const expandedItemId = useShoppingUiStore((state) => state.expandedItemId);
  const toggleExpandedItem = useShoppingUiStore((state) => state.toggleExpandedItem);
  const expanded = expandedItemId === item.id;

  return (
    <GlassPanel animated={false} className="border-zinc-800/90 bg-zinc-900/50">
      <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <SpringCheck
          checked={item.checked}
          onChange={(checked) => onToggle(item.id, checked)}
          label={
            <>
              {item.important && <span className="mr-1 text-amber-400">★</span>}
              {item.name}
            </>
          }
          ariaLabel={item.name}
          color="#4d179a"
          fillColor="#4d179a"
          checkColor="#0b0b0f"
          boxSize={28}
          boxRadius={6}
          fontSize={16}
          bounce={0.2}
          strikeLag={0.08}
          doneOpacity={0.44}
          strike="left"
          className="min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => toggleExpandedItem(item.id)}
          className="shrink-0 rounded-md bg-zinc-950/60 px-2 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-800/80 hover:text-zinc-200"
          aria-label="Подробнее"
        >
          {item.quantity} {item.unit}
        </button>
        <span
          className="hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs text-zinc-400 sm:flex"
          style={{ backgroundColor: `${creatorColor}22` }}
          title={`Добавил: ${creatorLabel}`}
        >
          <span>{creatorEmoji}</span>
          <span className="max-w-[80px] truncate">{creatorLabel}</span>
        </span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          className="shrink-0 rounded-lg p-1.5 text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
          aria-label="Удалить"
          title="Удалить"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
            aria-hidden
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 9.24A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-9.24.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-zinc-800/80 px-3 py-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-400">Количество</span>
              <input
                type="number"
                min={1}
                value={item.quantity}
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
              onChange={(event) => onUpdate(item.id, { note: event.target.value || undefined })}
              placeholder="Не жирный, если нет — не брать"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-zinc-400">Кто купит</span>
            <select
              value={item.assigneeUid ?? ''}
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
              onChange={(event) => onUpdate(item.id, { store: event.target.value || undefined })}
              placeholder="Пятёрочка, Ашан..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-zinc-100 outline-none focus:border-violet-500"
            />
          </label>

          <div className="flex flex-wrap gap-2">
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
          </div>
        </div>
      )}
    </GlassPanel>
  );
}
