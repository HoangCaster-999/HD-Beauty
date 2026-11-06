'use client';

import { useEffect, useMemo, useState } from 'react';
import { RevenueDeletionLog, Shop, Transaction } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { getAllShops } from '@/services/shop.service';
import {
  subscribeTransactions,
  subscribeRevenueDeletionLogs,
  deleteMonthRevenue,
} from '@/services/transaction.service';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SkeletonCard } from '@/components/ui/Loading';
import { formatCurrency, formatDateTime, getBerlinMonthKey } from '@/lib/utils';
import { AlertTriangle, CalendarX2, History, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PastMonth {
  key: string;        // 'YYYY-MM'
  label: string;      // 'MM/YYYY'
  transactions: Transaction[];
  total: number;
}

function monthLabel(key: string) {
  const [year, month] = key.split('-');
  return `${month}/${year}`;
}

// Gom giao dịch theo tháng (giờ Đức), bỏ tháng hiện tại — tháng đang chạy không được xóa
function groupPastMonths(transactions: Transaction[]): PastMonth[] {
  const currentKey = getBerlinMonthKey();
  const byMonth = new Map<string, PastMonth>();

  for (const t of transactions) {
    const key = getBerlinMonthKey(t.createdAt.toDate());
    if (key >= currentKey) continue;
    const month = byMonth.get(key) ?? { key, label: monthLabel(key), transactions: [], total: 0 };
    month.transactions.push(t);
    month.total += t.totalAmount;
    byMonth.set(key, month);
  }

  return Array.from(byMonth.values()).sort((a, b) => b.key.localeCompare(a.key));
}

export default function RevenueCleanupPage() {
  const { user } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState('');
  const [loadingShops, setLoadingShops] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  // Giữ nguyên danh sách đã hiển thị lúc mở hộp thoại: chỉ xóa đúng những gì đã xác nhận
  const [target, setTarget] = useState<PastMonth | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [logs, setLogs] = useState<RevenueDeletionLog[]>([]);
  const [logsState, setLogsState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    return subscribeRevenueDeletionLogs(
      (list) => { setLogs(list); setLogsState('ready'); },
      (err) => { console.error('[subscribeRevenueDeletionLogs]', err); setLogsState('error'); },
    );
  }, []);

  useEffect(() => {
    getAllShops()
      .then((list) => {
        const sorted = list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
        setShops(sorted);
        setShopId(sorted[0]?.id ?? '');
      })
      .catch(() => toast.error('Không thể tải danh sách tiệm'))
      .finally(() => setLoadingShops(false));
  }, []);

  useEffect(() => {
    if (!shopId) return;
    setLoadingTx(true);
    setTransactions([]);
    return subscribeTransactions(shopId, (list) => {
      setTransactions(list);
      setLoadingTx(false);
    });
  }, [shopId]);

  const months = useMemo(() => groupPastMonths(transactions), [transactions]);
  const shopName = shops.find((s) => s.id === shopId)?.name ?? '';

  const closeDialog = () => {
    if (deleting) return;
    setTarget(null);
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (!target || !user || confirmText.trim() !== target.label) return;
    setDeleting(true);
    try {
      await deleteMonthRevenue(
        { shopId, shopName, month: target.key, deletedBy: user.id, deletedByName: user.name },
        target.transactions,
      );
      toast.success(`Đã xóa doanh thu tháng ${target.label}`);
      setTarget(null);
      setConfirmText('');
    } catch (err) {
      console.error('[deleteMonthRevenue]', err);
      toast.error('Xóa chưa hoàn tất. Vui lòng kiểm tra lại danh sách và thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Xóa doanh thu</h1>
        <p className="text-sm text-gray-400 mt-1">
          Chỉ xóa được các tháng đã qua, tính theo giờ Đức. Dữ liệu đã xóa không thể khôi phục.
        </p>
      </div>

      <div>
        <label htmlFor="shop" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
          Tiệm
        </label>
        <select
          id="shop"
          value={shopId}
          onChange={(e) => setShopId(e.target.value)}
          disabled={loadingShops || shops.length === 0}
          className="w-full sm:max-w-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
        >
          {shops.map((shop) => (
            <option key={shop.id} value={shop.id}>{shop.name}</option>
          ))}
        </select>
      </div>

      {loadingShops || loadingTx ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-20" />)}
        </div>
      ) : months.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-8 text-gray-400">
            <CalendarX2 size={28} />
            <p className="text-sm">Không có doanh thu của tháng đã qua</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {months.map((month) => (
            <Card key={month.key}>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100">Tháng {month.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{month.transactions.length} giao dịch</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <p className="font-bold text-primary-600 dark:text-primary-400">{formatCurrency(month.total)}</p>
                  <button
                    onClick={() => setTarget(month)}
                    aria-label={`Xóa doanh thu tháng ${month.label}`}
                    title="Xóa doanh thu tháng này"
                    className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <section>
        <h2 className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 mb-3">
          <History size={16} /> Lịch sử xóa (tất cả tiệm)
        </h2>
        {logsState === 'loading' ? (
          <SkeletonCard className="h-20" />
        ) : logsState === 'error' ? (
          <Card>
            <p className="text-center text-sm text-red-500 py-6">Không tải được lịch sử xóa</p>
          </Card>
        ) : logs.length === 0 ? (
          <Card>
            <p className="text-center text-sm text-gray-400 py-6">Chưa có lần xóa nào</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <Card key={log.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      Tháng {monthLabel(log.month)} · {log.shopName}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {log.deletedByName} · {formatDateTime(log.deletedAt.toDate())}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(log.totalAmount)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{log.transactionCount} giao dịch</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Modal open={!!target} onClose={closeDialog} title={`Xóa doanh thu tháng ${target?.label ?? ''}`} size="sm">
        {target && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-2xl bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <p>
                Xóa vĩnh viễn {target.transactions.length} giao dịch ({formatCurrency(target.total)}) của tiệm “{shopName}”.
                Không thể khôi phục, chỉ lưu lại một dòng trong lịch sử xóa.
              </p>
            </div>
            <div>
              <label htmlFor="confirm-month" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Gõ <span className="font-bold">{target.label}</span> để xác nhận
              </label>
              <input
                id="confirm-month"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={target.label}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" fullWidth onClick={closeDialog} disabled={deleting}>Hủy</Button>
              <Button
                variant="danger"
                fullWidth
                loading={deleting}
                disabled={confirmText.trim() !== target.label}
                onClick={handleDelete}
              >
                Xóa vĩnh viễn
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
