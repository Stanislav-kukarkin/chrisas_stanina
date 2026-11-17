import { useRef, useState } from 'react';
import { parseRecipeFromUrl, type RecipeInput } from '@chrisasstanina/firebase';
import { emptyRecipe, parseIngredientLines, parseReaderRecipe, parseRecipeText } from '../domain/recipe-parser';

type Mode = 'choose' | 'text' | 'link' | 'image';

interface Props {
  onDraft: (draft: RecipeInput) => void;
  onClose: () => void;
}

function publicRecipeUrl(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Укажите обычную публичную http/https ссылку.');
  }
  const host = url.hostname.toLocaleLowerCase();
  if (host === 'localhost' || host === '::1' || host.endsWith('.local')
    || /^(?:127|10|0)\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) {
    throw new Error('Локальные адреса не поддерживаются.');
  }
  return url;
}

async function parseThroughPublicReader(value: string) {
  const url = publicRecipeUrl(value);
  const response = await fetch(`https://r.jina.ai/${url.toString()}`, {
    headers: { Accept: 'text/plain' },
  });
  if (!response.ok) throw new Error(`Страница вернула ошибку ${response.status}.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('На странице не найден текст рецепта.');
  return parseReaderRecipe(text, url.toString());
}

export function ImportRecipeModal({ onDraft, onClose }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function submitText() {
    if (!value.trim()) return setError('Вставьте текст рецепта.');
    onDraft(parseRecipeText(value));
  }

  async function submitLink() {
    if (!value.trim()) return setError('Вставьте ссылку на рецепт.');
    setBusy(true);
    setError('');
    try {
      try {
        const parsed = await parseRecipeFromUrl(value.trim());
        const fallback = parseRecipeText(parsed.rawText ?? '');
        onDraft({
          ...fallback,
          title: parsed.title?.trim() || fallback.title,
          description: parsed.description?.trim() || fallback.description,
          servings: parsed.servings ?? fallback.servings,
          prepMinutes: parsed.prepMinutes ?? fallback.prepMinutes,
          cookMinutes: parsed.cookMinutes ?? fallback.cookMinutes,
          ingredients: parsed.ingredientLines?.length ? parseIngredientLines(parsed.ingredientLines) : fallback.ingredients,
          steps: parsed.steps?.length ? parsed.steps : fallback.steps,
          sourceUrl: parsed.sourceUrl,
        });
      } catch {
        onDraft(await parseThroughPublicReader(value.trim()));
      }
    } catch (linkError) {
      const message = linkError instanceof Error ? linkError.message : String(linkError);
      setError(`${message} Можно перейти к импорту из текста или скриншота.`);
    } finally {
      setBusy(false);
    }
  }

  async function readImage(file: File) {
    setBusy(true);
    setError('');
    setProgress(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('rus+eng', undefined, {
        logger: (message: { status: string; progress: number }) => {
          if (message.status === 'recognizing text') setProgress(Math.round(message.progress * 100));
        },
      });
      const result = await worker.recognize(file);
      await worker.terminate();
      onDraft(parseRecipeText(result.data.text));
    } catch (ocrError) {
      setError(ocrError instanceof Error ? ocrError.message : 'Не удалось распознать изображение.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="recipe-overlay" role="dialog" aria-modal="true" aria-label="Добавить рецепт">
      <section className="recipe-modal import-modal">
        <header className="modal-heading">
          <div><p className="eyebrow">БЫСТРОЕ СОХРАНЕНИЕ</p><h2>Добавить рецепт</h2></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Закрыть">×</button>
        </header>

        {mode === 'choose' && <div className="import-grid">
          <button type="button" onClick={() => onDraft(emptyRecipe())}><span>✎</span><strong>Вручную</strong><small>Название, состав и шаги</small></button>
          <button type="button" onClick={() => { setMode('link'); setValue(''); }}><span>↗</span><strong>По ссылке</strong><small>Попробуем извлечь со страницы</small></button>
          <button type="button" onClick={() => { setMode('text'); setValue(''); }}><span>≡</span><strong>Из текста</strong><small>Разложим рецепт по полям</small></button>
          <button type="button" onClick={() => setMode('image')}><span>▧</span><strong>Из скриншота</strong><small>Распознаем текст локально</small></button>
        </div>}

        {mode === 'text' && <div className="import-form">
          <p>Вставьте рецепт целиком — заголовки «Ингредиенты» и «Приготовление» помогут точнее разобрать текст.</p>
          <textarea rows={13} value={value} onChange={(event) => setValue(event.target.value)} placeholder={'Сырники\n\nИнгредиенты:\n500 г творога\n...\n\nПриготовление:\n1. Смешать...'} />
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMode('choose')}>Назад</button><button className="primary-button" type="button" onClick={submitText}>Собрать черновик</button></div>
        </div>}

        {mode === 'link' && <div className="import-form">
          <p>Лучше всего работают страницы с разметкой Recipe. Источник сохранится в карточке.</p>
          <input type="url" value={value} onChange={(event) => setValue(event.target.value)} placeholder="https://example.com/recipe" />
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMode('choose')}>Назад</button><button className="primary-button" type="button" disabled={busy} onClick={submitLink}>{busy ? 'Извлекаем…' : 'Получить рецепт'}</button></div>
          {error && <div className="import-fallback"><p>{error}</p><div><button type="button" onClick={() => { setMode('text'); setValue(''); setError(''); }}>Вставить текст</button><button type="button" onClick={() => { setMode('image'); setError(''); }}>Загрузить скриншот</button></div></div>}
        </div>}

        {mode === 'image' && <div className="import-form">
          <p>Изображение не сохраняется: оно используется только для распознавания и сразу превращается в редактируемый черновик.</p>
          <input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readImage(file); }} />
          <button type="button" className="drop-zone" disabled={busy} onClick={() => fileRef.current?.click()}>
            <span>▧</span><strong>{busy ? `Распознаём… ${progress}%` : 'Выбрать фото или скриншот'}</strong><small>PNG, JPG, WEBP</small>
          </button>
          <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setMode('choose')}>Назад</button></div>
        </div>}
        {mode !== 'link' && error && <p className="form-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}
