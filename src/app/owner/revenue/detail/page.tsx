'use client';

import { Suspense, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Plus, Wallet } from 'lucide-react';
import { startOfDay, endOfDay, format, parseISO } from 'date-fns';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/hooks/useStaff';
import { useStaffTransactions } from '@/hooks/useTransactions';
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
} from '@/services/transaction.service';
import Header from '@/components/layout/Header';
import TransactionCard from '@/components/shared/TransactionCard';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { SkeletonList } from '@/components/ui/Loading';
import { formatCurrency, getInitials } from '@/lib/utils';
import { Transaction } from '@/types';

export default function OwnerStaffRevenuePage() {
  return (
    <Suspense>
      <OwnerStaffRevenueContent />
    </Suspense>
  );
}

function OwnerStaffRevenueContent() {
  const router = useRouter();
  const staffId = useSearchParams().get('staffId') ?? '';

  const { user } = useAuth();
  const { staff, loading: staffLoading } = useStaff(user?.shopId);
  const { transactions, loading: txLoading } = useStaffTransactions(user?.shopId, staffId);

  const member = staff.find((s) => s.id === staffId);

  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [addOpen, setAddOpen] = useState(false);
  const [addAmount, setAddAmount] = useState('');
  const [addDate, setAddDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Giao dịch của nhân viên trong ngày được chọn
  const dayTransactions = useMemo(() => {
    const from = startOfDay(parseISO(selectedDate));
    const to = endOfDay(parseISO(selectedDate));
    return transactions.filter((t) => {
      const d = t.createdAt.toDate();
      return d >= from && d <= to;
    });
  }, [transactions, selectedDate]);

  const dayTotal = dayTransactions.reduce((s, t) => s + t.totalAmount, 0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = selectedDate === todayStr;

  // Mở modal ghi giao dịch — mặc định ngày = ngày đang xem
  const openAdd = () => {
    setAddAmount('');
    setAddDate(selectedDate);
    setAddOpen(true);
  };

  const handleAdd = async () => {
    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Nhập số tiền hợp lệ');
      return;
    }
    if (!user?.shopId || !member) return;
    setAddSubmitting(true);
    try {
      // Ngày giao dịch = ngày được chọn trong modal; nếu là hôm nay dùng giờ hiện tại, ngày cũ dùng 12:00
      const date = addDate === todayStr ? new Date() : new Date(`${addDate}T12:00:00`);
      await createTransaction(
        user.shopId,
        member.id,
        member.name,
        { totalAmount: amount },
        date
      );
      toast.success('Đã ghi doanh thu');
      setAddOpen(false);
      setAddAmount('');
    } catch {
      toast.error('Không thể ghi doanh thu');
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (t: Transaction) => {
    setEditTarget(t);
    setEditAmount(String(t.totalAmount));
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Nhập số tiền hợp lệ');
      return;
    }
    setEditSubmitting(true);
    try {
      await updateTransaction(editTarget.id, { totalAmount: amount });
      toast.success('Đã cập nhật');
      setEditTarget(null);
    } catch {
      toast.error('Không thể cập nhật');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTarget.id);
      toast.success('Đã xóa giao dịch');
      setDeleteTarget(null);
    } catch {
      toast.error('Không thể xóa');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <Header
        title={member?.name ?? 'Nhân viên'}
        subtitle="Ghi doanh thu"
        rightAction={
          <Button size="icon" onClick={openAdd} disabled={!member}>
            <Plus size={18} />
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        {/* Nút quay lại */}
        <button
          onClick={() => router.push('/owner/revenue')}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          <ArrowLeft size={16} /> Danh sách nhân viên
        </button>

        {/* Thẻ nhân viên */}
        {member && (
          <div className="flex items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-card">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-secondary-300 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {getInitials(member.name)}
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
              <p className="text-xs text-gray-400 truncate">
                {member.role === 'manager' ? 'Quản lý' : 'Nhân viên'} · {member.email}
              </p>
            </div>
          </div>
        )}

        {/* Chọn ngày làm việc */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày làm việc</label>
          <input
            type="date"
            value={selectedDate}
            max={format(new Date(), 'yyyy-MM-dd')}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full h-11 px-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
        </div>

        {/* Tổng doanh thu trong ngày */}
        <div className="bg-gradient-primary rounded-2xl p-4 text-white">
          <p className="text-sm text-white/80">
            Doanh thu {isToday ? 'hôm nay' : `ngày ${format(parseISO(selectedDate), 'dd/MM/yyyy')}`}
          </p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(dayTotal)}</p>
          <p className="text-xs text-white/60 mt-1">{dayTransactions.length} giao dịch</p>
        </div>

        <Button fullWidth onClick={openAdd} disabled={!member}>
          <Plus size={18} /> Ghi giao dịch mới
        </Button>

        {/* Danh sách giao dịch trong ngày */}
        {staffLoading || txLoading ? (
          <SkeletonList count={3} />
        ) : dayTransactions.length === 0 ? (
          <EmptyState
            icon={<Wallet size={36} />}
            title="Chưa có giao dịch"
            description="Chưa có doanh thu nào cho nhân viên này trong ngày đã chọn"
          />
        ) : (
          <div className="space-y-3">
            {dayTransactions.map((t, i) => (
              <TransactionCard
                key={t.id}
                transaction={t}
                index={i}
                onEdit={() => openEdit(t)}
                onDelete={() => setDeleteTarget(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal thêm giao dịch */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Ghi giao dịch mới" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày giao dịch *</label>
            <input
              type="date"
              value={addDate}
              max={todayStr}
              onChange={(e) => setAddDate(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền (€) *</label>
            <input
              type="number"
              min="1"
              placeholder="150"
              value={addAmount}
              autoFocus
              onChange={(e) => setAddAmount(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <Button onClick={handleAdd} fullWidth loading={addSubmitting}>
            Lưu giao dịch
          </Button>
        </div>
      </Modal>

      {/* Modal sửa giao dịch */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Sửa giao dịch" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền (€) *</label>
            <input
              type="number"
              min="1"
              placeholder="150"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="w-full h-11 px-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <Button onClick={handleEdit} fullWidth loading={editSubmitting}>
            Cập nhật
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa giao dịch"
        description="Bạn có chắc muốn xóa giao dịch này không?"
        confirmLabel="Xóa"
        loading={deleting}
      />
    </div>
  );
}
