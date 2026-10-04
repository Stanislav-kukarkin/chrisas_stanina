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

const familyId = getDefaultFamilyId();
const base = familyAppCollectionPath(familyId, 'payments');
const paths = {
  groups: `${base}/groups`,
  payments: `${base}/payments`,
  completions: `${base}/completions`,
  settings: `${base}/settings/global`,
};
const key = ['payments', familyId];
const db = () => getFirebaseFirestore();
function rows<T extends { id: string }>(snap: Awaited<ReturnType<typeof getDocs>>) {
  return snap.docs.map((row) => ({ id: row.id, ...(row.data() as Record<string, unknown>) }) as T);
}
async function fetchAll() {
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
) {
  const out = await fn();
  await client.invalidateQueries({ queryKey: key });
  return out;
}
export function usePaymentsData(enabled = true) {
  return useQuery({ queryKey: key, queryFn: fetchAll, enabled });
}
export function usePaymentsActions() {
  const client = useQueryClient();
  return {
    createGroup: useMutation({
      mutationFn: (data: Omit<PaymentGroup, 'id' | 'isArchived' | 'createdOn'>) =>
        mutateAndRefresh(async () => {
          await addDoc(collection(db(), paths.groups), {
            ...data,
            isArchived: false,
            createdOn: localDateIso(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }, client),
    }),
    updateGroup: useMutation({
      mutationFn: ({ id, ...data }: Partial<PaymentGroup> & { id: string }) =>
        mutateAndRefresh(
          () => updateDoc(doc(db(), paths.groups, id), { ...data, updatedAt: serverTimestamp() }),
          client,
        ),
    }),
    archiveGroup: useMutation({
      mutationFn: (id: string) =>
        mutateAndRefresh(async () => {
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
        }, client),
    }),
    restoreGroup: useMutation({
      mutationFn: ({ id, paymentIds }: { id: string; paymentIds: string[] }) =>
        mutateAndRefresh(async () => {
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
        }, client),
    }),
    createPayment: useMutation({
      mutationFn: (data: Omit<Payment, 'id' | 'isArchived' | 'createdOn'>) =>
        mutateAndRefresh(async () => {
          await addDoc(collection(db(), paths.payments), {
            ...data,
            isArchived: false,
            createdOn: localDateIso(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }, client),
    }),
    updatePayment: useMutation({
      mutationFn: ({ id, ...data }: Partial<Payment> & { id: string }) =>
        mutateAndRefresh(
          () => updateDoc(doc(db(), paths.payments, id), { ...data, updatedAt: serverTimestamp() }),
          client,
        ),
    }),
    archivePayment: useMutation({
      mutationFn: (id: string) =>
        mutateAndRefresh(
          () =>
            updateDoc(doc(db(), paths.payments, id), {
              isArchived: true,
              updatedAt: serverTimestamp(),
            }),
          client,
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
        mutateAndRefresh(async () => {
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
        }, client),
    }),
    undoCompletion: useMutation({
      mutationFn: (id: string) =>
        mutateAndRefresh(() => deleteDoc(doc(db(), paths.completions, id)), client),
    }),
    updateCompletionBank: useMutation({
      mutationFn: ({ id, bankId }: { id: string; bankId: string | null }) =>
        mutateAndRefresh(() => updateDoc(doc(db(), paths.completions, id), { bankId }), client),
    }),
    saveSettings: useMutation({
      mutationFn: (settings: PaymentSettings) =>
        mutateAndRefresh(
          () =>
            setDoc(
              doc(db(), paths.settings),
              { ...settings, updatedAt: serverTimestamp() },
              { merge: true },
            ),
          client,
        ),
    }),
  };
}
