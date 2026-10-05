import { useEffect, useMemo, useRef, useState } from 'react';
import { Aurora, BlurText, FadeIn, GlassPanel } from '@chrisasstanina/ui';
import { isFirebaseReady, subscribeToFirebaseAuth } from '@chrisasstanina/firebase';
import defaultBackground from './assets/app-background.png?inline';
import { CATEGORY_ICON_OPTIONS, createCashbackEntryData, getCategoryIcon } from './category-icon';
import { detectBankName } from './detect-bank';
import { parseCashbackText, parseCashbackWords, type OcrWord } from './parse-cashback';
import { deleteWallpaper, listWallpapers, saveWallpaper, type SavedWallpaper } from './storage';
import { imageErrorDetails, imageErrorMessage, logImageFailure, toBrowserImage } from './image-utils';

type CashbackItem = { id: string; category: string; percent: string; icon: string; bankName?: string };
type CashbackGroup = { id: string; bankName: string; items: CashbackItem[] };
type PendingRecognition = { id: string; bankName: string; category: string; percent: string; icon: string; confidence: number };
type Screen = { id: string; file: File; url: string; status?: string };
const MAX_SCREENSHOTS = 5;
const REVIEW_CONFIDENCE_THRESHOLD = 74;
const colors = ['#FFFFFF', '#111111', '#F5F5F5', '#FFD76B', '#B8F5C8', '#A8D8FF', '#FFB4B4'];
const freshItem = (): CashbackItem => ({ id: crypto.randomUUID(), ...createCashbackEntryData() });

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, w: number, h: number) {
  const scale = Math.max(w / image.width, h / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (w - width) / 2, (h - height) / 2, width, height);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение.')), type, quality);
  });
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать изображение.'));
    reader.readAsDataURL(blob);
  });
}

async function makeAccountBackground(backgroundUrl: string) {
  const image = await loadImage(backgroundUrl);
  const variants = [
    { width: 720, height: 1280 },
    { width: 540, height: 960 },
    { width: 432, height: 768 },
  ];
  const maximumBytes = 420 * 1024;

  for (const variant of variants) {
    const canvas = document.createElement('canvas');
    canvas.width = variant.width;
    canvas.height = variant.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Браузер не смог подготовить фон для сохранения.');
    drawCover(context, image, variant.width, variant.height);

    for (const quality of [0.78, 0.68, 0.58, 0.48]) {
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
      if (blob.size <= maximumBytes) return blobToDataUrl(blob);
    }
  }

  throw new Error('Не удалось сжать фон до размера, подходящего для облачного сохранения.');
}

async function renderWallpaper(
  canvas: HTMLCanvasElement,
  background: string,
  items: CashbackItem[],
  appearance: { opacity: number; color: string; scale: number; x: number; y: number },
) {
  const width = 720;
  const height = 1280;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const image = await loadImage(background);
  drawCover(ctx, image, width, height);
  const populated = items.filter((item) => item.category.trim() && item.percent.trim());
  if (!populated.length) return;
  const columns = [populated.slice(0, Math.ceil(populated.length / 2)), populated.slice(Math.ceil(populated.length / 2))];
  const cardWidth = 660 * appearance.scale;
  const colWidth = (cardWidth - 68) / 2;
  const rowHeight = 73 * appearance.scale;
  const cardHeight = 86 + Math.max(columns[0].length, columns[1].length) * rowHeight;
  const x = Math.max(18, Math.min(width - cardWidth - 18, (width - cardWidth) / 2 + appearance.x));
  const y = Math.max(18, Math.min(height - cardHeight - 18, (height - cardHeight) / 2 + appearance.y));
  ctx.fillStyle = `rgba(8, 8, 12, ${appearance.opacity})`;
  ctx.beginPath();
  ctx.roundRect(x, y, cardWidth, cardHeight, 28 * appearance.scale);
  ctx.fill();
  ctx.strokeStyle = `rgba(255,255,255,${Math.min(.38, .14 + (1 - appearance.opacity) * .18)})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textBaseline = 'middle';
  columns.forEach((column, columnIndex) => {
    const colX = x + 30 + columnIndex * (colWidth + 8);
    column.forEach((item, index) => {
      const rowY = y + 54 + index * rowHeight;
      ctx.fillStyle = appearance.color;
      ctx.textAlign = 'left';
      ctx.font = `${28 * appearance.scale}px system-ui, sans-serif`;
      ctx.fillText(item.icon || getCategoryIcon(item.category), colX, rowY + 5, 36);
      ctx.font = `500 ${19 * appearance.scale}px system-ui, sans-serif`;
      ctx.fillText(item.category, colX + 42, rowY - 5, colWidth - 102);
      ctx.globalAlpha = .68;
      ctx.font = `${13 * appearance.scale}px system-ui, sans-serif`;
      ctx.fillText(item.bankName || '', colX + 42, rowY + 18, colWidth - 106);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'right';
      ctx.font = `700 ${21 * appearance.scale}px system-ui, sans-serif`;
      ctx.fillText(item.percent.includes('%') ? item.percent : `${item.percent}%`, colX + colWidth, rowY + 1);
      ctx.strokeStyle = 'rgba(255,255,255,.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colX, rowY + 38);
      ctx.lineTo(colX + colWidth, rowY + 38);
      ctx.stroke();
    });
  });
}

function App() {
  const [page, setPage] = useState<'home' | 'builder' | 'editor' | 'saved'>('home');
  const [screens, setScreens] = useState<Screen[]>([]);
  const [background, setBackground] = useState(defaultBackground);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [groups, setGroups] = useState<CashbackGroup[]>([]);
  const [pendingRecognitions, setPendingRecognitions] = useState<PendingRecognition[]>([]);
  const [opacity, setOpacity] = useState(.45);
  const [color, setColor] = useState('#FFFFFF');
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saved, setSaved] = useState<SavedWallpaper[]>([]);
  const [savedPreviewUrls, setSavedPreviewUrls] = useState<Record<string, string>>({});
  const [accountUid, setAccountUid] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(() => isFirebaseReady());
  const [savedLoading, setSavedLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSavedId, setEditingSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [converting, setConverting] = useState(false);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [screenshotDiagnostic, setScreenshotDiagnostic] = useState('');
  const [backgroundDiagnostic, setBackgroundDiagnostic] = useState('');
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isFirebaseReady()) return;

    let requestNumber = 0;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToFirebaseAuth((user) => {
        const request = ++requestNumber;
        const uid = user?.uid ?? null;
        setAccountUid(uid);
        setAccountLoading(false);

        if (!uid) {
          setSaved([]);
          setSavedLoading(false);
          return;
        }

        setSavedLoading(true);
        void listWallpapers(uid)
          .then((wallpapers) => { if (request === requestNumber) setSaved(wallpapers); })
          .catch((error: unknown) => {
            if (request !== requestNumber) return;
            console.error('[cashback-wallpapers] account wallpapers failed to load', error);
            setNotice(`Не удалось загрузить обои из аккаунта: ${error instanceof Error ? error.message : String(error)}`);
          })
          .finally(() => { if (request === requestNumber) setSavedLoading(false); });
      });
    } catch (error) {
      console.error('[cashback-wallpapers] account session unavailable', error);
    }

    return () => {
      requestNumber += 1;
      unsubscribe?.();
    };
  }, []);
  useEffect(() => {
    if (page !== 'editor' || !previewRef.current) return;
    const rows = groups.flatMap((group) => group.items.map((item) => ({ ...item, bankName: group.bankName })));
    void renderWallpaper(previewRef.current, background, rows, { opacity, color, scale, ...offset });
  }, [page, background, groups, opacity, color, scale, offset]);
  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];
    void Promise.all(saved.map(async (wallpaper) => {
      try {
        const canvas = document.createElement('canvas');
        const items = wallpaper.groups.flatMap((group) => group.items.map((item) => ({ ...item, bankName: group.bankName })));
        await renderWallpaper(canvas, wallpaper.backgroundDataUrl, items, wallpaper.appearance);
        const preview = await canvasToBlob(canvas, 'image/jpeg', .58);
        const url = URL.createObjectURL(preview);
        objectUrls.push(url);
        return [wallpaper.id, url] as const;
      } catch (error) {
        console.error('[cashback-wallpapers] saved wallpaper preview failed', { wallpaperId: wallpaper.id, error });
        return [wallpaper.id, wallpaper.backgroundDataUrl] as const;
      }
    })).then((entries) => {
      if (cancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }
      setSavedPreviewUrls(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [saved]);
  const completedCount = useMemo(() => groups.flatMap((group) => group.items).filter((item) => item.category.trim() && item.percent.trim()).length, [groups]);

  function updateItem(groupId: string, id: string, patch: Partial<CashbackItem>) {
    setGroups((current) => current.map((group) => group.id === groupId ? { ...group, items: group.items.map((item) => item.id === id ? { ...item, ...patch } : item) } : group));
  }

  function updatePendingRecognition(id: string, patch: Partial<PendingRecognition>) {
    setPendingRecognitions((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function acceptPendingRecognition(pending: PendingRecognition) {
    const item: CashbackItem = {
      id: pending.id,
      category: pending.category,
      percent: pending.percent,
      icon: pending.icon || getCategoryIcon(pending.category),
    };
    const bankName = pending.bankName.trim() || 'Банк не распознан';

    setGroups((current) => {
      const existing = current.find((group) => group.bankName.trim().toLocaleLowerCase() === bankName.toLocaleLowerCase());
      if (!existing) return [...current, { id: crypto.randomUUID(), bankName, items: [item] }];

      const duplicate = existing.items.some((entry) => entry.category.toLocaleLowerCase() === item.category.toLocaleLowerCase() && entry.percent.replace('%', '') === item.percent.replace('%', ''));
      if (duplicate) return current;
      return current.map((group) => group.id === existing.id ? { ...group, items: [...group.items, item] } : group);
    });
    setPendingRecognitions((current) => current.filter((entry) => entry.id !== pending.id));
  }

  async function addScreens(files: FileList | null) {
    if (!files?.length) return;
    const additions = Array.from(files)
      .filter((file) => file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name))
      .slice(0, MAX_SCREENSHOTS - screens.length);
    if (!additions.length) return;
    console.info('[cashback-wallpapers] screenshot files selected', additions.map(({ name, type, size, lastModified }) => ({ name, type, size, lastModified })));
    setScreenshotDiagnostic('');
    setConverting(true);
    setNotice('Подготавливаем изображения…');
    const results = await Promise.allSettled(additions.map(toBrowserImage));
    const prepared = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    setScreens((current) => [...current, ...prepared.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file), status: 'Ожидает распознавания' }))]);
    const failures = results.flatMap((result, index) => result.status === 'rejected' ? [{ file: additions[index], reason: result.reason }] : []);
    if (failures.length) {
      failures.forEach(({ file, reason }) => logImageFailure('screenshot conversion failed', file, reason));
      setScreenshotDiagnostic(failures.map(({ file, reason }) => `${file.name}\n${imageErrorDetails(reason)}`).join('\n\n'));
      const reason = imageErrorMessage(failures[0].reason);
      setNotice(prepared.length
        ? `Добавлено изображений: ${prepared.length}. Одно или несколько изображений не удалось преобразовать: ${reason}`
        : `Не удалось преобразовать изображение: ${reason}`);
    } else {
      setNotice(`Изображения готовы к распознаванию: ${prepared.length}.`);
    }
    setConverting(false);
  }

  async function replaceBackground(file: File | undefined) {
    if (!file) return;
    console.info('[cashback-wallpapers] background file selected', { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified });
    setBackgroundDiagnostic('');
    setBackgroundBusy(true);
    try {
      const prepared = await toBrowserImage(file);
      if (backgroundFile) URL.revokeObjectURL(background);
      setBackground(URL.createObjectURL(prepared));
      setBackgroundFile(prepared);
      setNotice('Фоновое изображение обновлено.');
    } catch (error) {
      logImageFailure('background conversion failed', file, error);
      setBackgroundDiagnostic(imageErrorDetails(error));
      setNotice(`Не удалось открыть фон: ${imageErrorMessage(error)}`);
    } finally {
      setBackgroundBusy(false);
    }
  }

  async function recognize() {
    if (!screens.length) { setNotice('Сначала выберите скриншоты банка.'); return; }
    setBusy(true); setNotice('Загружаем OCR-модель для русского языка…');
    try {
      const { createWorker } = await import('tesseract.js');
      let activeFile = '';
      const worker = await createWorker('rus+eng', 1, { logger: (progress) => { if (progress.status === 'recognizing text') setNotice(`Распознаём ${activeFile}: ${Math.round((progress.progress ?? 0) * 100)}%`); } });
      const detectedGroups = new Map<string, CashbackGroup>();
      const reviewQueue: PendingRecognition[] = [];
      let processed = 0;
      try {
        for (const [index, screen] of screens.entries()) {
          activeFile = screen.file.name || `скриншот ${index + 1}`;
          setScreens((current) => current.map((entry) => entry.id === screen.id ? { ...entry, status: 'Распознаётся…' } : entry));
          setNotice(`Распознаём ${activeFile} (${index + 1}/${screens.length})…`);
          // Tesseract.js omits its word boxes by default. Request them so the
          // layout-aware parser can pair a rate with the offer in its row/card.
          const result = await worker.recognize(screen.file, {}, { blocks: true });
          const lines = result.data.text.split('\n');
          const detectedName = detectBankName(lines) || `Банк не распознан · ${index + 1}`;
          const words = result.data.blocks?.flatMap((block) =>
            block.paragraphs.flatMap((paragraph) => paragraph.lines.flatMap((line) => line.words)),
          ) ?? [];
          const layoutParsed = parseCashbackWords(words as OcrWord[]);
          // Keep recognition usable with engines/builds that do not return
          // block data; text-only candidates always go to manual review.
          const parsed = layoutParsed.length ? layoutParsed : parseCashbackText(result.data.text);
          console.info('[cashback-wallpapers] OCR parsing summary', {
            file: screen.file.name,
            blockCount: result.data.blocks?.length ?? 0,
            wordCount: words.length,
            layoutMatches: layoutParsed.length,
            usedTextFallback: layoutParsed.length === 0,
            parsedCount: parsed.length,
            confidence: parsed.map((entry) => entry.confidence),
          });
          const key = detectedName.toLocaleLowerCase();
          const certain = parsed.filter((entry) => entry.confidence >= REVIEW_CONFIDENCE_THRESHOLD);
          const uncertain = parsed.filter((entry) => entry.confidence < REVIEW_CONFIDENCE_THRESHOLD);

          if (certain.length) {
            const group = detectedGroups.get(key) ?? { id: crypto.randomUUID(), bankName: detectedName, items: [] };
            const known = new Set(group.items.map((item) => `${item.category.toLocaleLowerCase()}|${item.percent}`));
            certain.forEach((entry) => {
              const percent = entry.value.replace('%', '');
              const itemKey = `${entry.title.toLocaleLowerCase()}|${percent}`;
              if (!known.has(itemKey)) group.items.push({ id: crypto.randomUUID(), category: entry.title, percent, icon: getCategoryIcon(entry.title) });
              known.add(itemKey);
            });
            detectedGroups.set(key, group);
          }

          uncertain.forEach((entry) => {
            reviewQueue.push({
              id: crypto.randomUUID(),
              bankName: detectedName,
              category: entry.title,
              percent: entry.value.replace('%', ''),
              icon: getCategoryIcon(entry.title),
              confidence: entry.confidence,
            });
          });
          processed += 1;
          const reviewStatus = uncertain.length ? ` · проверить: ${uncertain.length}` : '';
          setScreens((current) => current.map((entry) => entry.id === screen.id ? { ...entry, status: parsed.length ? `Найдено: ${parsed.length}${reviewStatus}` : 'Категории не найдены' } : entry));
        }
      } finally {
        await worker.terminate();
      }
      const recognized = [...detectedGroups.values()];
      setGroups((current) => {
        const merged = current.map((group) => ({ ...group, items: [...group.items] }));
        recognized.forEach((group) => {
          const existing = merged.find((item) => item.bankName.toLocaleLowerCase() === group.bankName.toLocaleLowerCase());
          if (!existing) { merged.push(group); return; }
          const known = new Set(existing.items.map((item) => `${item.category.toLocaleLowerCase()}|${item.percent}`));
          group.items.forEach((item) => { const itemKey = `${item.category.toLocaleLowerCase()}|${item.percent}`; if (!known.has(itemKey)) existing.items.push(item); known.add(itemKey); });
        });
        return merged;
      });
      setPendingRecognitions((current) => {
        const next = [...current];
        const known = new Set(current.map((item) => `${item.bankName.toLocaleLowerCase()}|${item.category.toLocaleLowerCase()}|${item.percent}`));
        reviewQueue.forEach((item) => {
          const itemKey = `${item.bankName.toLocaleLowerCase()}|${item.category.toLocaleLowerCase()}|${item.percent}`;
          if (!known.has(itemKey)) next.push(item);
          known.add(itemKey);
        });
        return next;
      });
      const certainCount = recognized.reduce((sum, group) => sum + group.items.length, 0);
      const detectedCount = certainCount + reviewQueue.length;
      const bankNames = recognized.map((group) => group.bankName);
      const reviewNote = reviewQueue.length ? ` Сомнительных результатов на проверку: ${reviewQueue.length}.` : '';
      setNotice(detectedCount
        ? `Обработано скриншотов: ${processed}/${screens.length}. Найдено предложений: ${detectedCount}${bankNames.length ? ` в банках: ${bankNames.join(', ')}` : ''}.${reviewNote} Проверьте результат.`
        : `Обработано скриншотов: ${processed}/${screens.length}. Категории не найдены — добавьте их вручную.`);
      setPage('builder');
    } catch (error) {
      setNotice(`OCR не запустился: ${error instanceof Error ? error.message : String(error)}. Продолжайте вручную.`);
    } finally { setBusy(false); }
  }

  async function makeBlob() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rows = groups.flatMap((group) => group.items.map((item) => ({ ...item, bankName: group.bankName })));
    await renderWallpaper(canvas, background, rows, { opacity, color, scale, ...offset });
    return canvasToBlob(canvas, 'image/png');
  }

  async function download() {
    const blob = await makeBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `cashback-wallpaper-${new Date().toISOString().slice(0, 10)}.png`; link.click();
    URL.revokeObjectURL(url);
  }

  async function save() {
    if (!accountUid) {
      setNotice('Войдите в аккаунт, чтобы сохранить обои и редактировать их позже.');
      return;
    }

    setSaving(true);
    try {
      const canvas = canvasRef.current;
      if (!canvas) throw new Error('Не удалось подготовить изображение обоев.');
      const backgroundDataUrl = await makeAccountBackground(background);
      const wallpaperInput = {
        backgroundDataUrl,
        groups: groups.map((group) => ({
          id: group.id,
          bankName: group.bankName,
          items: group.items.map((item) => ({ ...item })),
        })),
        appearance: { opacity, color, scale, x: offset.x, y: offset.y },
      };
      const existing = saved.find((item) => item.id === editingSavedId);
      const stored = await saveWallpaper(accountUid, wallpaperInput, editingSavedId ?? undefined, existing?.createdAt);
      setSaved((current) => [stored, ...current.filter((item) => item.id !== stored.id)]
        .sort((left, right) => right.updatedAt - left.updatedAt));
      setEditingSavedId(stored.id);
      setNotice(editingSavedId ? 'Изменения сохранены в вашем аккаунте.' : 'Обои сохранены в вашем аккаунте. Их можно открыть и отредактировать позже.');
    } catch (error) {
      console.error('[cashback-wallpapers] account wallpaper save failed', error);
      setNotice(`Не удалось сохранить обои в аккаунт: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function removeSaved(id: string) {
    if (!accountUid) return;
    try {
      await deleteWallpaper(accountUid, id);
      setSaved((current) => current.filter((item) => item.id !== id));
      if (editingSavedId === id) setEditingSavedId(null);
    } catch (error) {
      console.error('[cashback-wallpapers] account wallpaper delete failed', error);
      setNotice(`Не удалось удалить обои из аккаунта: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function downloadSaved(wallpaper: SavedWallpaper) {
    try {
      const canvas = document.createElement('canvas');
      const items = wallpaper.groups.flatMap((group) => group.items.map((item) => ({ ...item, bankName: group.bankName })));
      await renderWallpaper(canvas, wallpaper.backgroundDataUrl, items, wallpaper.appearance);
      const blob = await canvasToBlob(canvas, 'image/png');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cashback-wallpaper-${new Date(wallpaper.createdAt).toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[cashback-wallpapers] saved wallpaper export failed', error);
      setNotice(`Не удалось скачать обои: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function editSaved(wallpaper: SavedWallpaper) {
    setEditingSavedId(wallpaper.id);
    setGroups(wallpaper.groups.map((group) => ({ ...group, items: group.items.map((item) => ({ ...item })) })));
    setBackground(wallpaper.backgroundDataUrl);
    setBackgroundFile(null);
    setOpacity(wallpaper.appearance.opacity);
    setColor(wallpaper.appearance.color);
    setScale(wallpaper.appearance.scale);
    setOffset({ x: wallpaper.appearance.x, y: wallpaper.appearance.y });
    setNotice('');
    setPage('editor');
  }

  function startEditor() {
    setGroups([]); setPendingRecognitions([]); setEditingSavedId(null); setNotice(''); setPage('builder');
  }

  function addBank() {
    setGroups((current) => [...current, { id: crypto.randomUUID(), bankName: '', items: [] }]);
  }

  const shellHome = import.meta.env.DEV ? `${window.location.protocol}//${window.location.hostname}:5173/` : '/';

  return (
    <main className="relative min-h-full flex-1 overflow-hidden text-white">
      <Aurora />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-16 pt-7 sm:px-7 lg:px-10">
        <header className="mb-10 flex items-center justify-between">
          <a href={shellHome} className="rounded-full border border-white/10 bg-black/25 px-4 py-2 text-sm text-white/70 hover:text-white">← Семейный Hub</a>
          <div className="text-xs tracking-[.24em] text-teal-300">CASHBACK WALLPAPERS</div>
        </header>

        {page === 'home' && <FadeIn>
          <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div className="space-y-6">
              <p className="text-xs font-semibold tracking-[.32em] text-teal-300">ОБОИ С ТВОИМИ КЭШБЭКАМИ</p>
              <BlurText text="Выгодное всегда под рукой" className="max-w-2xl text-4xl font-semibold leading-tight sm:text-6xl" />
              <p className="max-w-xl text-base leading-7 text-white/60">Собери категории из банковских скриншотов, проверь распознавание и создай персональные обои для телефона.</p>
              <div className="flex flex-wrap gap-3">
                <button className="primary hero-create-button" onClick={startEditor}>Создать обои <span>→</span></button>
                <button className="secondary" onClick={() => setPage('saved')}>Мои обои <span>{saved.length}</span></button>
              </div>
              <div className="flex gap-6 pt-3 text-sm text-white/45"><span>01 · Скриншоты</span><span>02 · Проверка</span><span>03 · Обои</span></div>
            </div>
            <GlassPanel className="overflow-hidden rounded-[2rem] border border-white/10 bg-black/25 p-3 shadow-2xl shadow-violet-950/30">
              <div className="relative mx-auto aspect-[9/16] max-h-[62vh] overflow-hidden rounded-[1.55rem] bg-cover bg-center" style={{ backgroundImage: `url(${defaultBackground})` }}>
                <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-black/55 p-5 backdrop-blur-sm">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 text-sm">
                    {[['🛒','Продукты','5%'],['☕','Кофейни','10%'],['💊','Аптеки','7%'],['✈️','Путешествия','3%'],['🍔','Рестораны','5%'],['⛽','АЗС','8%']].map(([icon, name, percent]) => <div key={name} className="flex items-center gap-2 border-b border-white/20 pb-2"><span>{icon}</span><span className="flex-1 truncate">{name}</span><b>{percent}</b></div>)}
                  </div>
                </div>
              </div>
            </GlassPanel>
          </section>
          <section className="mt-16 grid gap-4 sm:grid-cols-3">{[['01','Добавь скриншоты','До пяти изображений за один раз'],['02','Проверь категории','OCR распознаёт русский текст, всё можно изменить'],['03','Сохрани результат','Скачай PNG или вернись к обоям позже']].map(([n,t,d]) => <GlassPanel key={n} className="rounded-2xl border border-white/10 bg-white/[.035] p-5"><div className="mb-5 text-sm text-teal-300">{n}</div><h2 className="font-medium">{t}</h2><p className="mt-2 text-sm leading-6 text-white/45">{d}</p></GlassPanel>)}</section>
        </FadeIn>}

        {page === 'builder' && <section className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">НОВЫЕ ОБОИ · ШАГ 1 ИЗ 2</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Добавь данные кэшбэка</h1></div><button className="text-sm text-white/50 hover:text-white" onClick={() => setPage('home')}>← На главную</button></div>
          <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
            <GlassPanel className="cashback-form-panel rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-7">
              <div><h2 className="text-lg font-semibold">Скриншоты из банка</h2><p className="mt-1 text-sm text-white/50">PNG, JPG, HEIC или HEIF, максимум {MAX_SCREENSHOTS} снимков</p></div>
              <label className="upload-zone"><input type="file" accept="image/*,.heic,.heif" multiple disabled={converting} onChange={(event) => { void addScreens(event.target.files); event.currentTarget.value = ''; }} /><span className="text-3xl">＋</span><span>{converting ? 'Подготавливаем изображения…' : 'Выбрать скриншоты'}</span><small>{screens.length}/{MAX_SCREENSHOTS} загружено</small></label>
              {screenshotDiagnostic && <details open className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-3 text-xs text-rose-100/80"><summary className="cursor-pointer font-medium">Ошибка загрузки скриншота · технические данные</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{screenshotDiagnostic}</pre></details>}
              {screens.length > 0 && <div className="grid w-full min-w-0 grid-cols-2 gap-3 sm:grid-cols-3">{screens.map((screen, i) => <div className="relative min-w-0 aspect-[3/4] overflow-hidden rounded-xl border border-white/10" key={screen.id}><img src={screen.url} alt={screen.file.name} className="h-full w-full object-cover" /><span className="absolute bottom-2 left-2 right-2 truncate rounded bg-black/75 px-2 py-1 text-xs" title={screen.status}>{screen.status || `Скриншот ${i + 1}`}</span><button className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/70" aria-label={`Удалить скриншот ${i + 1}`} onClick={() => { URL.revokeObjectURL(screen.url); setScreens((current) => current.filter((value) => value.id !== screen.id)); }}>×</button></div>)}</div>}
              <button className="secondary w-full" disabled={!screens.length || busy} onClick={() => void recognize()}>{busy ? notice || 'Распознаём…' : 'Распознать категории ✨'}</button>
              <div className="border-t border-white/10 pt-5"><div className="flex items-center justify-between"><div><h3 className="font-medium">Фоновое изображение</h3><p className="mt-1 text-xs text-white/45">Можно загрузить JPG, PNG, HEIC или HEIF</p></div><label className={`cursor-pointer rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5 ${backgroundBusy ? 'pointer-events-none opacity-50' : ''}`}>{backgroundBusy ? 'Обработка HEIC…' : 'Заменить'}<input type="file" accept="image/*,.heic,.heif" className="hidden" disabled={backgroundBusy} onChange={(event) => { void replaceBackground(event.currentTarget.files?.[0]); event.currentTarget.value = ''; }} /></label></div><img className="mt-4 h-24 w-full rounded-xl object-cover" src={background} />{backgroundDiagnostic && <details open className="mt-3 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3 text-xs text-rose-100/80"><summary className="cursor-pointer font-medium">Ошибка загрузки фона · технические данные</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words">{backgroundDiagnostic}</pre></details>}</div>
            </GlassPanel>
            <GlassPanel className="cashback-form-panel rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-7">
              <div><h2 className="text-lg font-semibold">Список категорий</h2><p className="mt-1 text-sm text-white/50">Заполни вручную или отредактируй результат распознавания</p></div>
              {pendingRecognitions.length > 0 && <section className="space-y-4 rounded-2xl border border-amber-200/20 bg-amber-200/[.04] p-4" aria-label="Проверка распознавания">
                <div><h3 className="font-medium text-amber-100">Проверь распознавание · {pendingRecognitions.length}</h3><p className="mt-1 text-sm text-white/50">Эти совпадения распознаны неуверенно и не добавлены в обои.</p></div>
                {pendingRecognitions.map((item) => <div className="space-y-3 rounded-xl border border-white/10 bg-black/15 p-3" key={item.id}>
                  <label className="field-label">Банк<input className="field" value={item.bankName} onChange={(event) => updatePendingRecognition(item.id, { bankName: event.target.value })} /></label>
                  <div className="flex min-w-0 gap-2">
                    <input className="field min-w-0 flex-1" aria-label="Проверить категорию" placeholder="Категория" value={item.category} onChange={(event) => updatePendingRecognition(item.id, { category: event.target.value, icon: getCategoryIcon(event.target.value) })} />
                    <div className="percent-input"><input className="field w-20 text-center" aria-label="Проверить процент" inputMode="decimal" value={item.percent} onChange={(event) => updatePendingRecognition(item.id, { percent: event.target.value.replace('%', '') })} /><span>%</span></div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-amber-100/65">Уверенность: {item.confidence}%</span><div className="flex gap-2"><button className="text-sm text-white/50 hover:text-white" onClick={() => setPendingRecognitions((current) => current.filter((entry) => entry.id !== item.id))}>Пропустить</button><button className="rounded-lg bg-teal-300 px-3 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-40" disabled={!item.category.trim() || !item.percent.trim()} onClick={() => acceptPendingRecognition(item)}>Добавить</button></div></div>
                </div>)}
              </section>}
              {groups.length === 0 && <div className="rounded-2xl border border-dashed border-white/15 p-7 text-center text-sm text-white/45">После распознавания здесь появятся отдельные блоки по банкам. Можно добавить банк и категории вручную.</div>}
              <div className="space-y-4">{groups.map((group, groupIndex) => <div className="bank-group" key={group.id}>
                <div className="flex min-w-0 items-center justify-between gap-3"><span className="eyebrow min-w-0">БАНК {groupIndex + 1}</span><button className="bank-remove-button" aria-label="Удалить банк" onClick={() => setGroups((current) => current.filter((value) => value.id !== group.id))}>Удалить банк ×</button></div>
                <label className="field-label">Название банка<input className="field" placeholder="Например, Т-Банк" value={group.bankName} onChange={(event) => setGroups((current) => current.map((value) => value.id === group.id ? { ...value, bankName: event.target.value } : value))} /></label>
                {group.items.length === 0 && <p className="text-sm text-white/40">Добавь категории для этого банка.</p>}
                <div className="space-y-3">{group.items.map((item) => <div className="entry-row" key={item.id}><button className="icon-button" title="Изменить значок" onClick={() => { const index = CATEGORY_ICON_OPTIONS.indexOf(item.icon as (typeof CATEGORY_ICON_OPTIONS)[number]); updateItem(group.id, item.id, { icon: CATEGORY_ICON_OPTIONS[(index + 1) % CATEGORY_ICON_OPTIONS.length] }); }}>{item.icon}</button><input className="field min-w-0 flex-1" placeholder="Категория" value={item.category} onChange={(event) => updateItem(group.id, item.id, { category: event.target.value, icon: getCategoryIcon(event.target.value) })} /><div className="percent-input"><input className="field w-20 text-center" inputMode="decimal" placeholder="5" value={item.percent.replace('%','')} onChange={(event) => updateItem(group.id, item.id, { percent: event.target.value.replace('%','') })} /><span>%</span></div><button className="remove-button" aria-label="Удалить категорию" onClick={() => setGroups((current) => current.map((value) => value.id === group.id ? { ...value, items: value.items.filter((entry) => entry.id !== item.id) } : value))}>×</button></div>)}</div>
                <button className="add-row" onClick={() => setGroups((current) => current.map((value) => value.id === group.id ? { ...value, items: [...value.items, freshItem()] } : value))}>＋ Добавить категорию</button>
              </div>)}</div>
              <button className="add-row add-bank" onClick={addBank}>＋ Добавить банк</button>
            </GlassPanel>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4"><span className="text-sm text-white/45">Готово категорий: {completedCount}</span><button className="primary" disabled={!completedCount} onClick={() => setPage('editor')}>Настроить обои <span>→</span></button></div>
          {notice && <p className="rounded-xl border border-teal-300/15 bg-teal-300/5 px-4 py-3 text-sm text-teal-100/80">{notice}</p>}
        </section>}

        {page === 'editor' && <section className="space-y-7">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">НАСТРОЙКА · ШАГ 2 ИЗ 2</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Расставь акценты</h1></div><button className="text-sm text-white/50 hover:text-white" onClick={() => setPage('builder')}>← К категориям</button></div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
            <div className="relative mx-auto w-full max-w-[390px] touch-none overflow-hidden rounded-[2rem] border border-white/15 bg-black shadow-2xl" onPointerDown={(event) => { setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={(event) => {
              if (!dragging) return;
              const previewWidth = event.currentTarget.clientWidth;
              if (!previewWidth) return;
              const scaleFactor = 720 / previewWidth;
              const deltaX = event.movementX * scaleFactor;
              const deltaY = event.movementY * scaleFactor;
              setOffset((value) => ({ x: value.x + deltaX, y: value.y + deltaY }));
            }} onPointerUp={() => setDragging(false)}><canvas ref={previewRef} className="block h-auto w-full" /><div className="pointer-events-none absolute bottom-4 left-0 right-0 text-center text-xs text-white/60">Перетаскивай карточку, чтобы изменить положение</div></div>
            <GlassPanel className="h-fit space-y-6 rounded-3xl border border-white/10 bg-white/[.035] p-5 sm:p-6"><div><h2 className="text-lg font-semibold">Вид карточки</h2><p className="mt-1 text-sm text-white/45">Предпросмотр соответствует итоговому PNG</p></div>
              <label className="field-label">Прозрачность фона <span className="text-teal-300">{Math.round(opacity * 100)}%</span><input type="range" min="0" max="90" step="5" value={opacity * 100} onChange={(event) => setOpacity(Number(event.target.value) / 100)} /></label>
              <div><p className="mb-3 text-sm text-white/65">Цвет текста</p><div className="flex gap-3">{colors.map((value) => <button key={value} aria-label={`Цвет ${value}`} onClick={() => setColor(value)} className={`color-choice ${color === value ? 'selected' : ''}`} style={{ backgroundColor: value }} />)}</div></div>
              <div><p className="mb-3 text-sm text-white/65">Размер карточки</p><div className="flex items-center gap-3"><button className="secondary !px-4" onClick={() => setScale((value) => Math.max(.75, value - .05))}>−</button><input type="range" min="75" max="115" value={scale * 100} onChange={(event) => setScale(Number(event.target.value) / 100)} /><button className="secondary !px-4" onClick={() => setScale((value) => Math.min(1.15, value + .05))}>＋</button></div></div>
              <div className="space-y-3 border-t border-white/10 pt-5"><button className="primary w-full" onClick={() => void download()}>Скачать PNG ↓</button><button className="secondary w-full disabled:cursor-not-allowed disabled:opacity-40" disabled={!accountUid || accountLoading || saving} onClick={() => void save()}>{saving ? 'Сохраняем в аккаунт…' : editingSavedId ? 'Сохранить изменения' : 'Сохранить в «Мои обои»'}</button>{!accountLoading && !accountUid && <p className="text-xs text-white/45">Войдите в аккаунт в меню профиля, чтобы сохранять и редактировать обои на разных устройствах.</p>}<button className="text-sm text-white/45 hover:text-white" onClick={() => setPage('home')}>Завершить</button></div>
              {notice && <p className="text-sm text-teal-200">{notice}</p>}
            </GlassPanel>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </section>}

        {page === 'saved' && <section className="space-y-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</p><h1 className="mt-2 text-3xl font-semibold sm:text-4xl">Мои обои</h1></div><button className="secondary" onClick={startEditor}>＋ Создать обои</button></div><button className="text-sm text-white/50 hover:text-white" onClick={() => setPage('home')}>← На главную</button>{notice && <p className="rounded-xl border border-rose-300/15 bg-rose-300/5 px-4 py-3 text-sm text-rose-100/80">{notice}</p>}{accountLoading || savedLoading ? <GlassPanel className="rounded-3xl border border-white/10 bg-white/[.035] p-12 text-center text-sm text-white/55">Загружаем обои из аккаунта…</GlassPanel> : !accountUid ? <GlassPanel className="rounded-3xl border border-white/10 bg-white/[.035] p-12 text-center"><div className="text-5xl">👤</div><h2 className="mt-4 text-xl font-medium">Войди в аккаунт</h2><p className="mt-2 text-sm text-white/45">Сохранённые обои привязаны к аккаунту и будут доступны на других устройствах.</p></GlassPanel> : saved.length === 0 ? <GlassPanel className="rounded-3xl border border-white/10 bg-white/[.035] p-12 text-center"><div className="text-5xl">🖼️</div><h2 className="mt-4 text-xl font-medium">Здесь будут твои обои</h2><p className="mt-2 text-sm text-white/45">Сохрани готовые обои в аккаунт — их можно будет открыть и отредактировать позже.</p><button className="primary mt-6" onClick={startEditor}>Создать первые обои →</button></GlassPanel> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{saved.map((wallpaper) => <GlassPanel key={wallpaper.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><img src={savedPreviewUrls[wallpaper.id] ?? wallpaper.backgroundDataUrl} alt="Предпросмотр обоев" className="aspect-[9/16] w-full object-cover" /><div className="space-y-3 p-3"><span className="block text-xs text-white/45">Обновлено {new Date(wallpaper.updatedAt).toLocaleDateString('ru-RU')}</span><button className="primary w-full !px-3 !py-2 text-sm" onClick={() => editSaved(wallpaper)}>Редактировать категории</button><div className="flex items-center justify-between"><button onClick={() => void downloadSaved(wallpaper)} className="text-xs text-teal-300">Скачать</button><button onClick={() => void removeSaved(wallpaper.id)} className="text-xs text-rose-300">Удалить</button></div></div></GlassPanel>)}</div>}</section>}
        <footer className="mt-16 border-t border-white/10 pt-5 text-center text-xs text-white/30">В аккаунте сохраняются фон и категории. Готовые обои собираются на устройстве, скриншоты для распознавания не загружаются.</footer>
      </div>
    </main>
  );
}

export default App;
