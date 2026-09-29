import { useMemo } from 'react';
import {
  getFirebaseConfigFromEnv,
  initializeFirebase,
  useAddShoppingFavorite,
  useAddShoppingItem,
  useClearCheckedItems,
  useDeleteShoppingItem,
  useFamilyMembers,
  useFirebaseUser,
  useShoppingFavorites,
  useShoppingItems,
  useToggleShoppingItem,
  useUpdateShoppingItem,
  type ShoppingFavorite,
  type ShoppingItem,
  type ShoppingItemUpdate,
} from '@chrisasstanina/firebase';
import { Aurora, BlurText, FadeIn, GlassPanel } from '@chrisasstanina/ui';
import { FavoritesRow } from './components/FavoritesRow';
import { QuickAddBar } from './components/QuickAddBar';
import { ShoppingItemRow } from './components/ShoppingItemRow';

// Module Federation: remote может получить отдельную копию firebase — инициализируем с тем же .env
initializeFirebase(getFirebaseConfigFromEnv());

export default function App() {
  const user = useFirebaseUser();
  const { data: items = [], isLoading, isError, refetch } = useShoppingItems();
  const { data: favorites = [] } = useShoppingFavorites();
  const { data: members = [] } = useFamilyMembers();

  const addItem = useAddShoppingItem();
  const updateItem = useUpdateShoppingItem();
  const toggleItem = useToggleShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearChecked = useClearCheckedItems();
  const addFavorite = useAddShoppingFavorite();

  const activeItems = items.filter((item) => !item.checked);
  const checkedItems = items.filter((item) => item.checked);

  const memberMap = useMemo(() => {
    const map = new Map<string, { label: string; emoji: string; color: string }>();
    members.forEach((member) => {
      map.set(member.uid, {
        label: member.profile?.displayName ?? member.email,
        emoji: member.profile?.emoji ?? '👤',
        color: member.profile?.color ?? '#8b5cf6',
      });
    });
    return map;
  }, [members]);

  async function handleQuickAdd(name: string) {
    if (!user) {
      return;
    }
    await addItem.mutateAsync({ input: { name }, createdBy: user.uid });
  }

  async function handleFavoriteAdd(favorite: ShoppingFavorite) {
    if (!user) {
      return;
    }
    await addItem.mutateAsync({
      input: {
        name: favorite.name,
        quantity: favorite.quantity,
        unit: favorite.unit,
        category: favorite.category,
        store: favorite.store,
      },
      createdBy: user.uid,
    });
  }

  async function handleUpdate(itemId: string, update: ShoppingItemUpdate) {
    await updateItem.mutateAsync({ itemId, update });
  }

  async function handleToggle(itemId: string, checked: boolean) {
    await toggleItem.mutateAsync({ itemId, checked });
  }

  async function handleDelete(itemId: string) {
    await deleteItem.mutateAsync(itemId);
  }

  async function handleAddFavorite(item: ShoppingItem) {
    const exists = favorites.some(
      (favorite) => favorite.name.toLowerCase() === item.name.toLowerCase(),
    );
    if (exists) {
      return;
    }
    await addFavorite.mutateAsync({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      store: item.store,
    });
  }

  async function handleClearChecked() {
    await clearChecked.mutateAsync(checkedItems.map((item) => item.id));
  }

  function renderItemRow(item: ShoppingItem, index: number) {
    const creator = memberMap.get(item.createdBy) ?? {
      label: 'Участник',
      emoji: '👤',
      color: '#8b5cf6',
    };

    return (
      <FadeIn key={item.id} index={index}>
        <ShoppingItemRow
          item={item}
          members={members}
          creatorLabel={creator.label}
          creatorEmoji={creator.emoji}
          creatorColor={creator.color}
          onToggle={handleToggle}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onAddFavorite={handleAddFavorite}
        />
      </FadeIn>
    );
  }

  return (
    <section className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <Aurora />
      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
        <div className="text-center">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-400/90">Приложение</p>
          <BlurText
            text="Список покупок"
            className="mt-3 text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl"
          />
          <p className="mt-4 text-zinc-400">Общий список семьи — добавляйте, отмечайте, делитесь</p>
        </div>

        <GlassPanel className="mt-10 p-4 sm:p-5" index={0}>
          <QuickAddBar onAdd={handleQuickAdd} disabled={!user || addItem.isPending} />
        </GlassPanel>

        <GlassPanel className="mt-4 p-4 sm:p-5" index={1}>
          <h2 className="mb-3 text-sm font-medium text-zinc-400">Избранное</h2>
          <FavoritesRow
            favorites={favorites}
            onAdd={handleFavoriteAdd}
            disabled={!user || addItem.isPending}
          />
        </GlassPanel>

        {isLoading && (
          <p className="mt-10 text-center text-zinc-500">Загрузка списка...</p>
        )}

        {isError && (
          <GlassPanel className="mt-10 p-6 text-center" index={2}>
            <p className="text-red-300">Не удалось загрузить список.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-sm text-violet-400 transition hover:text-violet-300"
            >
              Повторить
            </button>
          </GlassPanel>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <GlassPanel className="mt-10 p-8 text-center" index={2}>
            <p className="text-zinc-400">Список пуст</p>
            <p className="mt-2 text-sm text-zinc-500">Добавьте первый товар в поле выше</p>
          </GlassPanel>
        )}

        {activeItems.length > 0 && (
          <section className="mt-10">
            <h2 className="mb-3 text-sm font-medium tracking-wide text-zinc-400">
              Купить · {activeItems.length}
            </h2>
            <div className="space-y-2">{activeItems.map(renderItemRow)}</div>
          </section>
        )}

        {checkedItems.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium tracking-wide text-zinc-400">
                Куплено · {checkedItems.length}
              </h2>
              <button
                type="button"
                onClick={handleClearChecked}
                disabled={clearChecked.isPending}
                className="text-sm text-zinc-500 transition hover:text-violet-400 disabled:opacity-50"
              >
                Очистить купленное
              </button>
            </div>
            <div className="space-y-2">{checkedItems.map(renderItemRow)}</div>
          </section>
        )}
      </div>
    </section>
  );
}
