import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { getFirebaseFirestore } from './init';

export type CashbackWallpaperEntry = {
  id: string;
  category: string;
  percent: string;
  icon: string;
  bankName?: string;
};

export type CashbackWallpaperGroup = {
  id: string;
  bankName: string;
  items: CashbackWallpaperEntry[];
};

export type CashbackWallpaperAppearance = {
  opacity: number;
  color: string;
  scale: number;
  x: number;
  y: number;
};

export type CashbackWallpaper = {
  id: string;
  createdAt: number;
  updatedAt: number;
  backgroundDataUrl: string;
  groups: CashbackWallpaperGroup[];
  appearance: CashbackWallpaperAppearance;
};

export type CashbackWallpaperInput = Omit<CashbackWallpaper, 'id' | 'createdAt' | 'updatedAt'>;

function collectionForUser(uid: string) {
  if (!uid.trim()) throw new Error('Войдите в аккаунт, чтобы открыть сохранённые обои.');
  return collection(getFirebaseFirestore(), 'users', uid, 'cashbackWallpapers');
}

export async function listCashbackWallpapers(uid: string): Promise<CashbackWallpaper[]> {
  const snapshot = await getDocs(collectionForUser(uid));
  return snapshot.docs
    .map((entry) => ({ id: entry.id, ...(entry.data() as Omit<CashbackWallpaper, 'id'>) }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function saveCashbackWallpaper(
  uid: string,
  input: CashbackWallpaperInput,
  id?: string,
  createdAt?: number,
): Promise<CashbackWallpaper> {
  const wallpaperId = id ?? crypto.randomUUID();
  const now = Date.now();
  const wallpaper: CashbackWallpaper = {
    ...input,
    id: wallpaperId,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };

  await setDoc(doc(collectionForUser(uid), wallpaperId), {
    createdAt: wallpaper.createdAt,
    updatedAt: wallpaper.updatedAt,
    backgroundDataUrl: wallpaper.backgroundDataUrl,
    groups: wallpaper.groups,
    appearance: wallpaper.appearance,
  });
  return wallpaper;
}

export async function deleteCashbackWallpaper(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(collectionForUser(uid), id));
}
