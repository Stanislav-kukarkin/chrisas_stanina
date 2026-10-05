import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  getDefaultFamilyId,
  getFirebaseFirestore,
  familyAppCollectionPath,
} from '@chrisasstanina/firebase';
import type {
  Payment,
  PaymentBank,
  PaymentCompletion,
  PaymentGroup,
  PaymentSettings,
} from './domain';
import { completionId, localDateIso } from './domain';

function pathsFor(familyId: string) {
  const base = familyAppCollectionPath(familyId, 'payments');
  return {
    groups: `${base}/groups`,
    payments: `${base}/payments`,
    completions: `${base}/completions`,
    settings: `${base}/settings/global`,
  };
}
const queryKeyFor = (familyId: string) => ['payments', familyId];
const db = () => getFirebaseFirestore();
function rows<T extends { id: string }>(snap: Awaited<ReturnType<typeof getDocs>>) {
  return snap.docs.map((row) => ({ id: row.id, ...(row.data() as Record<string, unknown>) }) as T);
}
async function fetchAll(familyId: string) {
  const paths = pathsFor(familyId);
  const [groups, payments, completions, settingsDoc] = await Promise.all([
    getDocs(collection(db(), paths.groups)),
    getDocs(collection(db(), paths.payments)),
    getDocs(collection(db(), paths.completions)),
    getDoc(doc(db(), paths.settings)),
  ]);
  const raw = settingsDoc.data();
  return {
    groups: rows<PaymentGroup>(groups),
    payments: rows<Payment>(payments),
    completions: rows<PaymentCompletion>(completions),
    settings: {
      banks: (raw?.banks ?? []) as PaymentBank[],
      defaultBankId: (raw?.defaultBankId ?? null) as string | null,
    } as PaymentSettings,
  };
}
async function mutateAndRefresh<T>(
  fn: () => Promise<T>,
  client: ReturnType<typeof useQueryClient>,
  familyId: string,
) {
  const out = await fn();
  await client.invalidateQueries({ queryKey: queryKeyFor(familyId) });
  return out;
}
export function usePaymentsData(enabled = true, familyId = getDefaultFamilyId()) {
  return useQuery({ queryKey: queryKeyFor(familyId), queryFn: () => fetchAll(familyId), enabled });
}
export function usePaymentsActions(familyId = getDefaultFamilyId()) {
  const client = useQueryClient();
  const paths = pathsFor(familyId);
  const run = (fn: () => Promise<unknown>) => mutateAndRefresh(fn, client, familyId);
  return {
    createGroup: useMutation({
      mutationFn: (data: Omit<PaymentGroup, 'id' | 'isArchived' | 'createdOn'>) =>
        run(async () => {
          await addDoc(collection(db(), paths.groups), {
            ...data,
            isArchived: false,
            createdOn: localDateIso(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }),
    }),
    updateGroup: useMutation({
      mutationFn: ({ id, ...data }: Partial<PaymentGroup> & { id: string }) =>
        run(
          () => updateDoc(doc(db(), paths.groups, id), { ...data, updatedAt: serverTimestamp() }),
        ),
    }),
    archiveGroup: useMutation({
      mutationFn: (id: string) =>
        run(async () => {
          const batch = writeBatch(db());
          batch.update(doc(db(), paths.groups, id), {
            isArchived: true,
            updatedAt: serverTimestamp(),
          });
          const all = await getDocs(collection(db(), paths.payments));
          all.docs
            .filter((p) => p.data().groupId === id && !p.data().isArchived)
            .forEach((p) =>
              batch.update(p.ref, { isArchived: true, updatedAt: serverTimestamp() }),
            );
          await batch.commit();
        }),
    }),
    restoreGroup: useMutation({
      mutationFn: ({ id, paymentIds }: { id: string; paymentIds: string[] }) =>
        run(async () => {
          const batch = writeBatch(db());
          batch.update(doc(db(), paths.groups, id), {
            isArchived: false,
            updatedAt: serverTimestamp(),
          });
          paymentIds.forEach((paymentId) =>
            batch.update(doc(db(), paths.payments, paymentId), {
              isArchived: false,
              updatedAt: serverTimestamp(),
            }),
          );
          await batch.commit();
        }),
    }),
    createPayment: useMutation({
      mutationFn: (data: Omit<Payment, 'id' | 'isArchived' | 'createdOn'>) =>
        run(async () => {
          await addDoc(collection(db(), paths.payments), {
            ...data,
            isArchived: false,
            createdOn: localDateIso(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }),
    }),
    updatePayment: useMutation({
      mutationFn: ({ id, ...data }: Partial<Payment> & { id: string }) =>
        run(
          () => updateDoc(doc(db(), paths.payments, id), { ...data, updatedAt: serverTimestamp() }),
        ),
    }),
    archivePayment: useMutation({
      mutationFn: (id: string) =>
        run(
          () =>
            updateDoc(doc(db(), paths.payments, id), {
              isArchived: true,
              updatedAt: serverTimestamp(),
            }),
        ),
    }),
    completePayment: useMutation({
      mutationFn: ({
        paymentId,
        groupId,
        month,
        bankId,
        scheduledDate,
      }: {
        paymentId: string;
        groupId: string;
        month: string;
        bankId: string | null;
        scheduledDate: string;
      }) =>
        run(async () => {
          const [year, monthNumber] = month.split('-').map(Number);
          const id = completionId(paymentId, month);
          await setDoc(doc(db(), paths.completions, id), {
            paymentId,
            groupId,
            year,
            month: monthNumber,
            paidOn: localDateIso(),
            scheduledDate,
            bankId,
            createdAt: serverTimestamp(),
          });
        }),
    }),
    undoCompletion: useMutation({
      mutationFn: (id: string) =>
        run(() => deleteDoc(doc(db(), paths.completions, id))),
    }),
    updateCompletionBank: useMutation({
      mutationFn: ({ id, bankId }: { id: string; bankId: string | null }) =>
        run(() => updateDoc(doc(db(), paths.completions, id), { bankId })),
    }),
    saveSettings: useMutation({
      mutationFn: (settings: PaymentSettings) =>
        run(
          () =>
            setDoc(
              doc(db(), paths.settings),
              { ...settings, updatedAt: serverTimestamp() },
              { merge: true },
            ),
        ),
    }),
  };
}
