import { useMemo, useState } from 'react';
import {
  getFirebaseConfigFromEnv,
  importIngredientsToShopping,
  initializeFirebase,
  resolveShoppingImport,
  useCreateRecipe,
  useDeleteRecipe,
  useFamilyAppAccess,
  useFirebaseUser,
  useRecipes,
  useShoppingLists,
  useUpdateRecipe,
  type Recipe,
  type RecipeInput,
  type ShoppingConflictDecision,
  type ShoppingImportIngredient,
  type ShoppingImportResult,
} from '@chrisasstanina/firebase';
import { Aurora, BlurText, GlassPanel } from '@chrisasstanina/ui';
import { ConflictModal } from './components/ConflictModal';
import { ImportRecipeModal } from './components/ImportRecipeModal';
import { RecipeDetails } from './components/RecipeDetails';
import { RecipeEditor } from './components/RecipeEditor';

initializeFirebase(getFirebaseConfigFromEnv());

function toInput(recipe: Recipe): RecipeInput {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    sourceUrl: recipe.sourceUrl,
    favorite: recipe.favorite,
  };
}

function totalTime(recipe: Recipe) {
  const total = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return total > 0 ? `${total} мин` : 'Время не указано';
}

export default function App() {
  const user = useFirebaseUser();
  const recipesAccess = useFamilyAppAccess(user?.uid, 'recipes');
  const shoppingAccess = useFamilyAppAccess(user?.uid, 'shopping');
  const recipesFamilyId = recipesAccess.familyId ?? '';
  const shoppingFamilyId = shoppingAccess.familyId ?? '';
  const recipesQuery = useRecipes(recipesFamilyId, recipesAccess.canView);
  const { data: shoppingLists = [] } = useShoppingLists(shoppingFamilyId, shoppingAccess.canView);
  const createRecipe = useCreateRecipe(recipesFamilyId);
  const updateRecipe = useUpdateRecipe(recipesFamilyId);
  const deleteRecipe = useDeleteRecipe(recipesFamilyId);
  const [search, setSearch] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editorDraft, setEditorDraft] = useState<RecipeInput | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [listSelection, setListSelection] = useState({ familyId: '', listId: 'main' });
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendResult, setSendResult] = useState<ShoppingImportResult | null>(null);
  const [conflictResult, setConflictResult] = useState<ShoppingImportResult | null>(null);
  const [resolving, setResolving] = useState(false);

  const recipes = useMemo(() => recipesQuery.data ?? [], [recipesQuery.data]);
  const selectedRecipe = recipes.find((recipe) => recipe.id === selectedRecipeId) ?? null;
  const listStorageKey = shoppingFamilyId ? `shopping:last-list:${shoppingFamilyId}` : '';
  const rememberedListId = listStorageKey ? window.localStorage.getItem(listStorageKey) || 'main' : 'main';
  const preferredListId = listSelection.familyId === shoppingFamilyId ? listSelection.listId : rememberedListId;
  const selectedListId = shoppingLists.length > 0 && !shoppingLists.some((list) => list.id === preferredListId)
    ? 'main'
    : preferredListId;

  const filteredRecipes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('ru-RU');
    return recipes.filter((recipe) => {
      if (favoritesOnly && !recipe.favorite) return false;
      if (!needle) return true;
      return recipe.title.toLocaleLowerCase('ru-RU').includes(needle)
        || recipe.ingredients.some((ingredient) => ingredient.name.toLocaleLowerCase('ru-RU').includes(needle));
    });
  }, [favoritesOnly, recipes, search]);

  function chooseList(listId: string) {
    setListSelection({ familyId: shoppingFamilyId, listId });
    if (listStorageKey) window.localStorage.setItem(listStorageKey, listId);
  }

  function openDraft(draft: RecipeInput, recipeId: string | null = null) {
    setImportOpen(false);
    setSelectedRecipeId(null);
    setEditingId(recipeId);
    setEditorDraft(draft);
  }

  async function saveRecipe(input: RecipeInput) {
    if (!user || !recipesAccess.canEdit) throw new Error('Нет права сохранять рецепты.');
    if (editingId) await updateRecipe.mutateAsync({ recipeId: editingId, update: input });
    else await createRecipe.mutateAsync({ input, authorId: user.uid });
    setEditorDraft(null);
    setEditingId(null);
  }

  async function removeRecipe(recipe: Recipe) {
    if (!recipesAccess.canEdit || !window.confirm(`Удалить рецепт «${recipe.title}»?`)) return;
    await deleteRecipe.mutateAsync(recipe.id);
    setSelectedRecipeId(null);
  }

  async function sendToShopping(ingredients: ShoppingImportIngredient[]) {
    if (!selectedRecipe || !shoppingAccess.canEdit || !shoppingFamilyId) return;
    setSending(true);
    setSendError('');
    setSendResult(null);
    try {
      const result = await importIngredientsToShopping({
        familyId: shoppingFamilyId,
        listId: selectedListId,
        requestId: crypto.randomUUID(),
        recipeId: selectedRecipe.id,
        ingredients,
      });
      setSendResult(result);
      if (result.conflicts.length) setConflictResult(result);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error));
    } finally {
      setSending(false);
    }
  }

  async function resolveConflicts(decisions: ShoppingConflictDecision[]) {
    if (!conflictResult) return;
    setResolving(true);
    try {
      const result = await resolveShoppingImport({
        familyId: shoppingFamilyId,
        requestId: conflictResult.requestId,
        decisions,
      });
      setSendResult(result);
      setConflictResult(null);
    } finally {
      setResolving(false);
    }
  }

  if (!user || recipesAccess.isLoading) {
    return <main className="recipes-state">Проверяем доступ к рецептам…</main>;
  }
  if (!recipesAccess.canView) {
    return <main className="recipes-state"><h1>Нет доступа к рецептам</h1><p>Подключите приложение в разделе объединения или используйте личное пространство.</p><a href="/connections">Объединение приложений</a></main>;
  }

  return (
    <main className="recipes-app">
      <Aurora />
      <div className="recipes-shell">
        <header className="recipes-hero">
          <div>
            <p className="eyebrow">ДОМАШНЯЯ КУЛИНАРНАЯ КНИГА</p>
            <BlurText text="Мои рецепты" className="recipes-title" />
            <p className="hero-copy">Сохраняйте рецепты откуда угодно и отправляйте продукты в покупки одним нажатием.</p>
          </div>
          {recipesAccess.canEdit && <button className="add-recipe-button" type="button" onClick={() => setImportOpen(true)}><span>＋</span>Добавить рецепт</button>}
        </header>

        <GlassPanel className="recipes-toolbar" animated={false}>
          <label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск по названию и ингредиентам" /></label>
          <button type="button" className={favoritesOnly ? 'filter-button active' : 'filter-button'} onClick={() => setFavoritesOnly((value) => !value)}>★ Избранное</button>
        </GlassPanel>

        {recipesQuery.isLoading && <p className="loading-copy">Загружаем рецепты…</p>}
        {recipesQuery.isError && <GlassPanel className="empty-panel"><h2>Не удалось загрузить рецепты</h2><p>{recipesQuery.error instanceof Error ? recipesQuery.error.message : 'Попробуйте ещё раз.'}</p><button className="secondary-button" onClick={() => recipesQuery.refetch()}>Повторить</button></GlassPanel>}
        {!recipesQuery.isLoading && !recipesQuery.isError && filteredRecipes.length === 0 && <GlassPanel className="empty-panel"><span>♨</span><h2>{recipes.length ? 'Ничего не найдено' : 'Книга рецептов пока пуста'}</h2><p>{recipes.length ? 'Попробуйте изменить запрос или снять фильтр.' : 'Добавьте первый рецепт вручную, по ссылке, из текста или скриншота.'}</p>{recipesAccess.canEdit && !recipes.length && <button className="primary-button" onClick={() => setImportOpen(true)}>Добавить первый рецепт</button>}</GlassPanel>}

        <section className="recipe-grid" aria-label="Рецепты">
          {filteredRecipes.map((recipe, index) => (
            <GlassPanel key={recipe.id} className="recipe-card" index={index} animated={false}>
              <button type="button" className="recipe-card-main" onClick={() => { setSelectedRecipeId(recipe.id); setSendResult(null); setSendError(''); }}>
                <span className="recipe-card-icon">{['♨', '✦', '⌁', '◌'][index % 4]}</span>
                <span className="recipe-card-copy"><small>{recipe.ingredients.length} ингредиентов · {totalTime(recipe)}</small><strong>{recipe.title}</strong><span>{recipe.ingredients.slice(0, 3).map((item) => item.name).join(' · ')}</span></span>
              </button>
              <button type="button" className={recipe.favorite ? 'favorite-button active' : 'favorite-button'} disabled={!recipesAccess.canEdit || updateRecipe.isPending} onClick={() => updateRecipe.mutate({ recipeId: recipe.id, update: { favorite: !recipe.favorite } })} aria-label={recipe.favorite ? 'Убрать из избранного' : 'Добавить в избранное'}>★</button>
            </GlassPanel>
          ))}
        </section>
      </div>

      {importOpen && <ImportRecipeModal onClose={() => setImportOpen(false)} onDraft={(draft) => openDraft(draft)} />}
      {editorDraft && <RecipeEditor initial={editorDraft} saving={createRecipe.isPending || updateRecipe.isPending} onSave={saveRecipe} onCancel={() => { setEditorDraft(null); setEditingId(null); }} />}
      {selectedRecipe && <RecipeDetails
        recipe={selectedRecipe}
        lists={shoppingLists.length ? shoppingLists : [{ id: 'main', name: 'Основной', createdBy: '' }]}
        selectedListId={selectedListId}
        canSend={shoppingAccess.canEdit}
        sending={sending}
        result={sendResult}
        onListChange={chooseList}
        onSend={sendToShopping}
        onEdit={() => openDraft(toInput(selectedRecipe), selectedRecipe.id)}
        onDelete={() => void removeRecipe(selectedRecipe)}
        onClose={() => { setSelectedRecipeId(null); setSendResult(null); setSendError(''); }}
      />}
      {selectedRecipe && sendError && <div className="floating-error" role="alert">{sendError}</div>}
      {conflictResult && <ConflictModal result={conflictResult} resolving={resolving} onResolve={resolveConflicts} onClose={() => setConflictResult(null)} />}
    </main>
  );
}
