const HEIC_FILE = /\.(heic|heif)$/i;

export function imageErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(error);
    } catch {
      // Fall through to the generic string representation.
    }
  }
  return String(error);
}

export function imageErrorDetails(error: unknown): string {
  const serialize = (_key: string, value: unknown) => {
    if (typeof value === 'bigint') return `${value}n`;
    return value;
  };

  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    }, serialize, 2);
  }

  try {
    return JSON.stringify(error, serialize, 2) ?? String(error);
  } catch {
    return String(error);
  }
}

export function logImageFailure(operation: string, file: File, error: unknown, extra?: Record<string, unknown>) {
  console.error(`[cashback-wallpapers] ${operation}`, {
    file: { name: file.name, type: file.type, size: file.size, lastModified: file.lastModified },
    message: imageErrorMessage(error),
    details: imageErrorDetails(error),
    error,
    ...extra,
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Браузер не смог сохранить преобразованное изображение в JPEG.'));
    }, 'image/jpeg', quality);
  });
}

async function decodeHeif(file: File): Promise<File> {
  if (file.size === 0) throw new Error('Файл пустой или ещё не скачан на устройство.');

  // Load the WASM decoder only when the user chooses HEIC/HEIF so regular uploads
  // and the rest of the micro-frontend do not pay for the decoder bundle.
  const { default: libheif } = await import('libheif-js/wasm-bundle');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const decoder = new libheif.HeifDecoder();
  const images = decoder.decode(bytes);
  try {
    const image = images.find((candidate) => candidate.is_primary()) ?? images[0];
    if (!image) throw new Error('В HEIC/HEIF файле не найдено изображение.');

    const width = image.get_width();
    const height = image.get_height();
    if (!width || !height) throw new Error(`Декодер вернул некорректный размер изображения: ${width}×${height}.`);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    try {
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Браузер не смог подготовить холст для преобразования HEIC/HEIF.');

      const imageData = context.createImageData(width, height);
      await new Promise<void>((resolve, reject) => {
        try {
          image.display(imageData, (displayData) => {
            if (!displayData) {
              reject(new Error(`libheif не смог декодировать изображение размером ${width}×${height}.`));
              return;
            }
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });

      context.putImageData(imageData, 0, 0);
      const jpeg = await canvasToJpeg(canvas, 0.92);
      return new File([jpeg], file.name.replace(HEIC_FILE, '.jpg'), {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    images.forEach((image) => image.free());
  }
}

export async function toBrowserImage(file: File): Promise<File> {
  const mimeType = file.type.toLowerCase();
  if (!HEIC_FILE.test(file.name) && !mimeType.includes('heic') && !mimeType.includes('heif')) {
    return file;
  }

  try {
    return await decodeHeif(file);
  } catch (error) {
    logImageFailure('libheif conversion failed', file, error);
    throw error;
  }
}
