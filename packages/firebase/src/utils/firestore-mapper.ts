import { Timestamp } from 'firebase/firestore';

export function mapTimestamp(value: unknown): Date | undefined {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  return undefined;
}

export function mapDoc<T extends { id: string }>(
  id: string,
  data: Record<string, unknown>,
): T {
  return { id, ...data } as T;
}
