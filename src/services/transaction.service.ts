import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  writeBatch,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { RevenueDeletionLog, Transaction, TransactionFormData } from '@/types';

export async function createTransaction(
  shopId: string,
  staffId: string,
  staffName: string,
  data: TransactionFormData,
  date?: Date
): Promise<string> {
  const ref = await addDoc(collection(db, 'transactions'), {
    shopId,
    staffId,
    staffName,
    totalAmount: data.totalAmount,
    createdAt: date ? Timestamp.fromDate(date) : Timestamp.now(),
  });
  return ref.id;
}

export function subscribeTransactions(
  shopId: string,
  callback: (transactions: Transaction[]) => void,
) {
  const q = query(collection(db, 'transactions'), where('shopId', '==', shopId));
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Transaction)
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      callback(sorted);
    },
    (err) => { console.error('[subscribeTransactions]', err); callback([]); },
  );
}

export function subscribeStaffTransactions(
  shopId: string,
  staffId: string,
  callback: (transactions: Transaction[]) => void,
) {
  const q = query(
    collection(db, 'transactions'),
    where('shopId', '==', shopId),
    where('staffId', '==', staffId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const sorted = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Transaction)
        .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
      callback(sorted);
    },
    (err) => { console.error('[subscribeStaffTransactions]', err); callback([]); },
  );
}

export async function updateTransaction(
  transactionId: string,
  data: { totalAmount: number; staffId?: string; staffName?: string; date?: Date }
): Promise<void> {
  const updates: Record<string, unknown> = { totalAmount: data.totalAmount };
  if (data.staffId)   updates.staffId   = data.staffId;
  if (data.staffName) updates.staffName = data.staffName;
  if (data.date)      updates.createdAt = Timestamp.fromDate(data.date);
  await updateDoc(doc(db, 'transactions', transactionId), updates);
}

export async function deleteTransaction(transactionId: string) {
  await deleteDoc(doc(db, 'transactions', transactionId));
}

// Firestore giới hạn 500 thao tác mỗi batch
const DELETE_BATCH_SIZE = 400;

// Lịch sử được ghi trong cùng batch với thao tác xóa: nếu đứt giữa chừng,
// lịch sử vẫn khớp đúng số giao dịch đã xóa thực tế.
export async function deleteMonthRevenue(
  info: Pick<RevenueDeletionLog, 'shopId' | 'shopName' | 'month' | 'deletedBy' | 'deletedByName'>,
  transactions: Pick<Transaction, 'id' | 'totalAmount'>[],
): Promise<void> {
  const logRef = doc(collection(db, 'revenueDeletionLogs'));

  for (let i = 0; i < transactions.length; i += DELETE_BATCH_SIZE) {
    const chunk = transactions.slice(i, i + DELETE_BATCH_SIZE);
    const amount = chunk.reduce((sum, t) => sum + t.totalAmount, 0);

    const batch = writeBatch(db);
    chunk.forEach((t) => batch.delete(doc(db, 'transactions', t.id)));
    if (i === 0) {
      batch.set(logRef, {
        ...info,
        transactionCount: chunk.length,
        totalAmount: amount,
        deletedAt: serverTimestamp(),
      });
    } else {
      batch.update(logRef, {
        transactionCount: increment(chunk.length),
        totalAmount: increment(amount),
      });
    }
    await batch.commit();
  }
}

export function subscribeRevenueDeletionLogs(
  callback: (logs: RevenueDeletionLog[]) => void,
  onError: (err: Error) => void,
) {
  const q = query(collection(db, 'revenueDeletionLogs'), orderBy('deletedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(
      // 'estimate': bản ghi vừa tạo chưa có giờ từ server thì dùng giờ ước tính thay vì null
      snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) }) as RevenueDeletionLog),
    ),
    onError,
  );
}
