type FullscreenElement = Element & {
  webkitRequestFullscreen?: () => Promise<void>;
};

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
};

export function isNativeFullscreenSupported(): boolean {
  const element = document.documentElement as FullscreenElement;
  return Boolean(element.requestFullscreen ?? element.webkitRequestFullscreen);
}

export function isNativeFullscreenActive(): boolean {
  const doc = document as FullscreenDocument;
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

export async function enterNativeFullscreen(
  element: Element = document.documentElement,
): Promise<boolean> {
  const target = element as FullscreenElement;
  const request = target.requestFullscreen ?? target.webkitRequestFullscreen;
  if (!request) {
    return false;
  }

  try {
    await request.call(target);
    return isNativeFullscreenActive();
  } catch {
    return false;
  }
}

export async function exitNativeFullscreen(): Promise<void> {
  if (!isNativeFullscreenActive()) {
    return;
  }

  const doc = document as FullscreenDocument;
  const exit = doc.exitFullscreen ?? doc.webkitExitFullscreen;
  if (!exit) {
    return;
  }

  try {
    await exit.call(document);
  } catch {
    // Браузер мог уже выйти из fullscreen (Esc).
  }
}
