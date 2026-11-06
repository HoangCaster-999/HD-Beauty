'use client';

import { Suspense, useEffect, useState, useMemo, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Store, Users, ArrowLeftRight, Scissors, BarChart3,
  TrendingUp, DollarSign, Calendar, Activity,
  Plus, ShieldCheck, User as UserIcon, Eye, EyeOff, Copy, Check,
  ArrowRightLeft, MapPin, Phone, Clock, CalendarDays, CalendarOff,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useRealtimeTransactions, useDashboardStats, useChartData } from '@/hooks/useTransactions';
import { useStaff } from '@/hooks/useStaff';
import { useServices } from '@/hooks/useServices';
import { createStaffAccount, resetStaffPassword, setStaffPassword } from '@/services/auth.service';
import { updateStaff, toggleStaffActive, deleteStaff, transferStaff } from '@/services/staff.service';
import { getAllShops } from '@/services/shop.service';
import { createService, updateService, deleteService, toggleServiceActive } from '@/services/service.service';
import { createTransaction, updateTransaction, deleteTransaction } from '@/services/transaction.service';
import { decryptPassword } from '@/lib/crypto';
import { Shop, StaffReport, Transaction, User, UserRole, Service } from '@/types';
import { formatCurrency, exportToExcel, exportToPDF } from '@/lib/utils';
import Image from 'next/image';
import { format, startOfMonth, endOfMonth, subDays, startOfDay, endOfDay, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import Card from '@/components/ui/Card';
import StatCard from '@/components/shared/StatCard';
import TransactionCard from '@/components/shared/TransactionCard';
import EmployeeCard from '@/components/shared/EmployeeCard';
import ServiceCard from '@/components/shared/ServiceCard';
import RevenueChart from '@/components/charts/RevenueChart';
import SearchBar from '@/components/ui/SearchBar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonCard, SkeletonList } from '@/components/ui/Loading';
import EmptyState from '@/components/ui/EmptyState';

const TABS = [
  { label: 'Tổng quan',  icon: Store },
  { label: 'Nhân viên',  icon: Users },
  { label: 'Giao dịch',  icon: ArrowLeftRight },
  { label: 'Dịch vụ',    icon: Scissors },
  { label: 'Báo cáo',    icon: BarChart3 },
];

export default function ShopDetailPage() {
  return (
    <Suspense>
      <ShopDetailContent />
    </Suspense>
  );
}

function ShopDetailContent() {
  const shopId = useSearchParams().get('shopId') ?? '';
  const [tab, setTab]   = useState(0);
  const [shop, setShop] = useState<Shop | null>(null);

  const { transactions, loading: txLoading } = useRealtimeTransactions(shopId);
  const { staff, loading: staffLoading }      = useStaff(shopId);
  const { services, loading: svcLoading }     = useServices(shopId);
  const stats    = useDashboardStats(transactions);
  const chartData = useChartData(transactions, 30);

  useEffect(() => {
    getDoc(doc(db, 'shops', shopId)).then((snap) => {
      if (snap.exists()) setShop({ id: snap.id, ...snap.data() } as Shop);
    });
  }, [shopId]);

  return (
    <div>
      {/* Back + shop header */}
      <div className="sticky top-[60px] z-20 bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/super-admin/dashboard"
            className="p-2 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-800 transition-colors flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="h-9 w-9 rounded-xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
            <Store size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
              {shop?.name ?? '…'}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {staff.length} thành viên · {services.length} dịch vụ
            </p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto no-scrollbar pb-px">
          {TABS.map((t, i) => (
            <button
              key={t.label}
              onClick={() => setTab(i)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === i
                  ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {tab === 0 && <OverviewTab stats={stats} chartData={chartData} transactions={transactions} txLoading={txLoading} staffCount={staff.length} svcCount={services.length} shop={shop} />}
        {tab === 1 && <StaffTab shopId={shopId} staff={staff} loading={staffLoading} />}
        {tab === 2 && <TransactionsTab transactions={transactions} loading={txLoading} staff={staff} shopId={shopId} />}
        {tab === 3 && <ServicesTab shopId={shopId} services={services} loading={svcLoading} />}
        {tab === 4 && <ReportsTab transactions={transactions} shopName={shop?.name ?? shopId} staff={staff} />}
      </div>
    </div>
  );
}

// ── Schedule display helpers ──────────────────────────────────────────────────
const SA_DAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
type SAStoredSchedule = {
  ranges: { fromDay: number; toDay: number; isClosed: boolean; from: string; to: string }[];
  holiday: { isClosed: boolean; from: string; to: string };
};
function saDayLabel(from: number, to: number) {
  return from === to ? SA_DAY_SHORT[from] : `${SA_DAY_SHORT[from]} – ${SA_DAY_SHORT[to]}`;
}
function ClosedBadge() {
  return <span className="text-xs font-medium text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">Đóng cửa</span>;
}
function LegacyRow({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">{icon} {label}</span>
      {value === 'Đóng cửa' ? <ClosedBadge /> : <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{value}</span>}
    </div>
  );
}
function ScheduleView({ scheduleJson, legacy }: {
  scheduleJson?: string;
  legacy?: { openingHours?: string; weekendHours?: string; holidayHours?: string };
}) {
  let parsed: SAStoredSchedule | null = null;
  if (scheduleJson) {
    try { parsed = JSON.parse(scheduleJson); } catch { /* ignore */ }
  }
  if (!parsed) {
    const hasLegacy = legacy?.openingHours || legacy?.weekendHours || legacy?.holidayHours;
    if (!hasLegacy) return <p className="text-xs text-gray-400 italic">Chưa cập nhật</p>;
    return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
        {legacy?.openingHours && <LegacyRow label="T2 – T6" value={legacy.openingHours} icon={<CalendarDays size={11} />} />}
        {legacy?.weekendHours && <LegacyRow label="T7 – CN" value={legacy.weekendHours} icon={<CalendarDays size={11} />} />}
        {legacy?.holidayHours && <LegacyRow label="Ngày lễ" value={legacy.holidayHours} icon={<CalendarOff size={11} />} />}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
      {parsed.ranges.map((r, i) => (
        <div key={i} className="flex items-center justify-between px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <CalendarDays size={11} /> {saDayLabel(r.fromDay, r.toDay)}
          </span>
          {r.isClosed
            ? <ClosedBadge />
            : <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{r.from} – {r.to}</span>
          }
        </div>
      ))}
      <div className="flex items-center justify-between px-3 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <CalendarOff size={11} /> Ngày lễ
        </span>
        {parsed.holiday.isClosed
          ? <ClosedBadge />
          : <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{parsed.holiday.from} – {parsed.holiday.to}</span>
        }
      </div>
    </div>
  );
}

// ── Tab: Tổng quan ───────────────────────────────────────────────────────────

function OverviewTab({ stats, chartData, transactions, txLoading, staffCount, svcCount, shop }: {
  stats: ReturnType<typeof useDashboardStats>;
  chartData: ReturnType<typeof useChartData>;
  transactions: Transaction[];
  txLoading: boolean;
  staffCount: number;
  svcCount: number;
  shop: Shop | null;
}) {
  const recentTx = transactions.slice(0, 8);
  return (
    <>
      {/* Shop info card */}
      <Card>
        <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Thông tin tiệm</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3 text-gray-600 dark:text-gray-400">
            <MapPin size={15} className="text-primary-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1">Địa chỉ</span>
            {shop?.address
              ? <span className="font-medium text-gray-900 dark:text-gray-100 text-right max-w-[55%]">{shop.address}</span>
              : <span className="text-gray-400 italic">Chưa cập nhật</span>}
          </div>
          <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
            <Phone size={15} className="text-primary-400 flex-shrink-0" />
            <span className="flex-1">Điện thoại</span>
            {shop?.phone
              ? <span className="font-medium text-gray-900 dark:text-gray-100">{shop.phone}</span>
              : <span className="text-gray-400 italic">Chưa cập nhật</span>}
          </div>
          <div className="pt-1">
            <div className="flex items-center gap-2 mb-2.5">
              <Clock size={15} className="text-primary-400" />
              <span className="font-medium text-gray-600 dark:text-gray-400">Giờ mở cửa</span>
            </div>
            <div className="ml-5">
              <ScheduleView scheduleJson={shop?.scheduleJson} legacy={shop ?? undefined} />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {txLoading ? (
          [1,2,3,4].map((k) => <SkeletonCard key={k} className="h-28" />)
        ) : (
          <>
            <StatCard title="DT hôm nay" value={formatCurrency(stats.todayRevenue)} icon={<DollarSign size={18} />} gradient="bg-gradient-to-br from-primary-500 to-secondary-400" delay={0} />
            <StatCard title="DT tháng" value={formatCurrency(stats.monthRevenue)} icon={<TrendingUp size={18} />} gradient="bg-gradient-to-br from-mint-400 to-emerald-400" delay={0.05} />
            <StatCard title="Khách hôm nay" value={stats.todayCustomers} subtitle="lượt" icon={<Activity size={18} />} delay={0.1} />
            <StatCard title="GD tháng" value={stats.monthCustomers} subtitle="lượt" icon={<Calendar size={18} />} delay={0.15} />
          </>
        )}
      </div>

      <Card>
        <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Doanh thu 30 ngày</p>
        <RevenueChart data={chartData} />
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{staffCount}</p>
          <p className="text-xs text-gray-400 mt-1">Thành viên</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">{svcCount}</p>
          <p className="text-xs text-gray-400 mt-1">Dịch vụ</p>
        </Card>
      </div>

      <div>
        <p className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">Giao dịch gần đây</p>
        {txLoading ? (
          <SkeletonList count={4} />
        ) : recentTx.length === 0 ? (
          <EmptyState title="Chưa có giao dịch" />
        ) : (
          <div className="space-y-2">
            {recentTx.map((t, i) => <TransactionCard key={t.id} transaction={t} index={i} />)}
          </div>
        )}
      </div>
    </>
  );
}

// ── Tab: Nhân viên ───────────────────────────────────────────────────────────

const addStaffSchema = z.object({
  name: z.string().min(2, 'Tên ít nhất 2 ký tự'),
  phone: z.string().optional(),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
  role: z.enum(['staff', 'manager']),
});
const editStaffSchema = z.object({
  name: z.string().min(2, 'Tên ít nhất 2 ký tự'),
  phone: z.string().optional(),
});
type AddStaffForm = z.infer<typeof addStaffSchema>;
type EditStaffForm = z.infer<typeof editStaffSchema>;

function StaffTab({ shopId, staff, loading }: {
  shopId: string;
  staff: ReturnType<typeof useStaff>['staff'];
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen]       = useState(false);
  const [editOpen, setEditOpen]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [selected, setSelected]     = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [pwdOpen, setPwdOpen]         = useState(false);
  const [pwdStaff, setPwdStaff]       = useState<User | null>(null);
  const [currentPwd, setCurrentPwd]   = useState('');
  const [pwdVisible, setPwdVisible]   = useState(false);
  const [pwdCopied, setPwdCopied]     = useState(false);
  const [newPwdValue, setNewPwdValue] = useState('');
  const [newPwdVisible, setNewPwdVisible] = useState(false);
  const [pwdLoading, setPwdLoading]   = useState(false);

  // Transfer state
  const [transferOpen, setTransferOpen]       = useState(false);
  const [transferTarget, setTransferTarget]   = useState<User | null>(null);
  const [allShops, setAllShops]               = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId]   = useState('');
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  const addForm  = useForm<AddStaffForm>({ resolver: zodResolver(addStaffSchema), defaultValues: { role: 'staff' } });
  const editForm = useForm<EditStaffForm>({ resolver: zodResolver(editStaffSchema) });

  const filtered   = staff.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));
  const managers   = filtered.filter((s) => s.role === 'manager');
  const staffOnly  = filtered.filter((s) => s.role === 'staff');

  const handleAdd = async (data: AddStaffForm) => {
    setSubmitting(true);
    try {
      await createStaffAccount(data.email, data.password, data.name, data.phone || '', shopId, data.role as UserRole);
      toast.success(`Thêm ${data.role === 'manager' ? 'quản lý' : 'nhân viên'} thành công!`);
      addForm.reset({ role: 'staff' });
      setAddOpen(false);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') toast.error('Email đã được sử dụng');
      else toast.error('Không thể thêm');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: EditStaffForm) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await updateStaff(selected.id, { name: data.name, phone: data.phone || '' });
      toast.success('Cập nhật thành công!');
      setEditOpen(false);
    } catch {
      toast.error('Không thể cập nhật');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await deleteStaff(selected.id);
      toast.success('Đã xóa');
      setDeleteOpen(false);
    } catch {
      toast.error('Không thể xóa');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromote = async () => {
    if (!selected) return;
    setSubmitting(true);
    const newRole: UserRole = selected.role === 'manager' ? 'staff' : 'manager';
    try {
      await updateStaff(selected.id, { role: newRole });
      toast.success(newRole === 'manager' ? `Đã phong ${selected.name} làm Quản lý!` : `Đã hạ ${selected.name} xuống Nhân viên`);
      setPromoteOpen(false);
    } catch {
      toast.error('Không thể thay đổi quyền');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (s: User) => {
    try {
      await toggleStaffActive(s.id, !s.active);
      toast.success(s.active ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản');
    } catch {
      toast.error('Không thể thực hiện');
    }
  };

  const openViewPassword = async (s: User) => {
    setPwdStaff(s);
    setCurrentPwd('');
    setNewPwdValue('');
    setPwdVisible(false);
    setPwdCopied(false);
    setPwdOpen(true);
    if (s.encryptedPassword) {
      setPwdLoading(true);
      try {
        const plain = await decryptPassword(s.encryptedPassword);
        setCurrentPwd(plain);
      } catch {
        setCurrentPwd('');
      } finally {
        setPwdLoading(false);
      }
    }
  };

  const handleSetNewPassword = async () => {
    if (!pwdStaff || !pwdStaff.encryptedPassword || newPwdValue.length < 6) return;
    setSubmitting(true);
    try {
      const newEncPwd = await setStaffPassword(pwdStaff.id, pwdStaff.email, pwdStaff.encryptedPassword, newPwdValue);
      toast.success('Đã đổi mật khẩu thành công!');
      setCurrentPwd(newPwdValue);
      setNewPwdValue('');
      setPwdStaff((prev) => prev ? { ...prev, encryptedPassword: newEncPwd } : null);
    } catch {
      toast.error('Không thể đổi mật khẩu');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (s: User) => {
    setSelected(s);
    editForm.reset({ name: s.name, phone: s.phone });
    setEditOpen(true);
  };

  const openTransfer = async (s: User) => {
    setTransferTarget(s);
    setSelectedShopId('');
    setTransferOpen(true);
    if (allShops.length === 0) {
      const shops = await getAllShops();
      setAllShops(shops);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferTarget || !selectedShopId) return;
    setSubmitting(true);
    try {
      await transferStaff(transferTarget.id, selectedShopId);
      const shopName = allShops.find((s) => s.id === selectedShopId)?.name ?? selectedShopId;
      toast.success(`Đã chuyển ${transferTarget.name} sang ${shopName}`);
      setTransferConfirmOpen(false);
      setTransferOpen(false);
      setTransferTarget(null);
    } catch {
      toast.error('Không thể chuyển tiệm');
    } finally {
      setSubmitting(false);
    }
  };

  const Section = ({ title, icon, items }: { title: string; icon: React.ReactNode; items: User[] }) => (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="font-semibold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {title} ({items.length})
        </h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 pl-6">Chưa có</p>
      ) : (
        <div className="space-y-3">
          {items.map((s, i) => (
            <EmployeeCard
              key={s.id}
              employee={s}
              index={i}
              currentUserRole="owner"
              canEdit={true}
              onEdit={() => openEdit(s)}
              onToggleActive={() => handleToggleActive(s)}
              onDelete={() => { setSelected(s); setDeleteOpen(true); }}
              onViewPassword={() => openViewPassword(s)}
              onResetPassword={() => resetStaffPassword(s.email).then(() => toast.success(`Đã gửi email tới ${s.email}`)).catch(() => toast.error('Không thể gửi email'))}
              onPromote={() => { setSelected(s); setPromoteOpen(true); }}
              onTransfer={() => openTransfer(s)}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <SearchBar placeholder="Tìm tên, email..." value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />
        <Button size="icon" onClick={() => { addForm.reset({ role: 'staff' }); setAddOpen(true); }} className="flex-shrink-0">
          <Plus size={18} />
        </Button>
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-400">
        <Users size={12} />
        <span>{staff.length} thành viên · {staff.filter((s) => s.active).length} đang hoạt động</span>
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={36} />}
          title={search ? 'Không tìm thấy' : 'Chưa có thành viên'}
          description="Thêm quản lý hoặc nhân viên để bắt đầu"
          action={!search && <Button onClick={() => setAddOpen(true)}><Plus size={16} /> Thêm thành viên</Button>}
        />
      ) : (
        <>
          <Section title="Quản lý" icon={<ShieldCheck size={16} className="text-primary-500" />} items={managers} />
          <Section title="Nhân viên" icon={<UserIcon size={16} className="text-gray-400" />} items={staffOnly} />
        </>
      )}

      {/* Add Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Thêm thành viên">
        <form onSubmit={addForm.handleSubmit(handleAdd)} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Vai trò</label>
            <div className="flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
              {(['staff', 'manager'] as const).map((r) => (
                <label key={r} className="flex-1">
                  <input type="radio" value={r} {...addForm.register('role')} className="sr-only" />
                  <span className={`block text-center py-2 text-sm font-medium rounded-xl cursor-pointer transition-all ${addForm.watch('role') === r ? 'bg-white dark:bg-gray-900 text-primary-600 shadow-sm' : 'text-gray-500'}`}>
                    {r === 'manager' ? '🛡 Quản lý' : '👤 Nhân viên'}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Input label="Họ tên" placeholder="Nguyễn Văn A" error={addForm.formState.errors.name?.message} {...addForm.register('name')} />
          <Input label="Số điện thoại" placeholder="0901234567" type="tel" {...addForm.register('phone')} />
          <Input label="Email đăng nhập" type="email" placeholder="staff@email.com" error={addForm.formState.errors.email?.message} {...addForm.register('email')} />
          <Input label="Mật khẩu" type="password" placeholder="Ít nhất 6 ký tự" error={addForm.formState.errors.password?.message} {...addForm.register('password')} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth type="button" onClick={() => setAddOpen(false)}>Hủy</Button>
            <Button fullWidth type="submit" loading={submitting}>Thêm</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Chỉnh sửa">
        <form onSubmit={editForm.handleSubmit(handleEdit)} className="space-y-4">
          <Input label="Họ tên" error={editForm.formState.errors.name?.message} {...editForm.register('name')} />
          <Input label="Số điện thoại" type="tel" {...editForm.register('phone')} />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth type="button" onClick={() => setEditOpen(false)}>Hủy</Button>
            <Button fullWidth type="submit" loading={submitting}>Lưu</Button>
          </div>
        </form>
      </Modal>

      {/* Promote/Demote Confirm */}
      <ConfirmDialog
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onConfirm={handlePromote}
        variant={selected?.role === 'manager' ? 'warning' : 'primary'}
        title={selected?.role === 'manager' ? 'Hạ xuống Nhân viên' : 'Phong làm Quản lý'}
        description={selected?.role === 'manager'
          ? `Hạ "${selected?.name}" từ Quản lý xuống Nhân viên?`
          : `Phong "${selected?.name}" làm Quản lý? Họ sẽ có quyền quản lý nhân viên và dịch vụ.`}
        confirmLabel={selected?.role === 'manager' ? 'Hạ xuống' : 'Phong chức'}
        loading={submitting}
      />

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Xóa tài khoản"
        description={`Bạn có chắc muốn xóa "${selected?.name}"? Hành động này không thể hoàn tác.`}
        confirmLabel="Xóa"
        loading={submitting}
      />

      {/* Password Modal */}
      <Modal open={pwdOpen} onClose={() => { setPwdOpen(false); setPwdStaff(null); }} title={`Mật khẩu — ${pwdStaff?.name}`}>
        <div className="space-y-5">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Mật khẩu hiện tại</p>
            {pwdLoading ? (
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : currentPwd ? (
              <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-gray-700">
                <span className="flex-1 font-mono text-sm text-gray-900 dark:text-gray-100 tracking-widest">
                  {pwdVisible ? currentPwd : '•'.repeat(currentPwd.length)}
                </span>
                <button onClick={() => setPwdVisible(!pwdVisible)} className="p-1 text-gray-400 hover:text-gray-600">
                  {pwdVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
                <button onClick={() => { navigator.clipboard.writeText(currentPwd); setPwdCopied(true); setTimeout(() => setPwdCopied(false), 2000); }} className="p-1 text-gray-400 hover:text-green-600 transition-colors">
                  {pwdCopied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Tài khoản này chưa lưu mật khẩu. Dùng &quot;Gửi email đặt lại&quot; để reset.</p>
            )}
          </div>

          {pwdStaff?.encryptedPassword && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Đặt mật khẩu mới</p>
              <div className="relative">
                <input
                  type={newPwdVisible ? 'text' : 'password'}
                  value={newPwdValue}
                  onChange={(e) => setNewPwdValue(e.target.value)}
                  placeholder="Ít nhất 6 ký tự"
                  className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 pr-10 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary-400"
                />
                <button type="button" onClick={() => setNewPwdVisible(!newPwdVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {newPwdVisible ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <Button fullWidth loading={submitting} disabled={newPwdValue.length < 6} onClick={handleSetNewPassword}>
                Cập nhật mật khẩu
              </Button>
            </div>
          )}
        </div>
      </Modal>

      {/* Transfer Modal */}
      <Modal
        open={transferOpen}
        onClose={() => setTransferOpen(false)}
        title={`Chuyển tiệm — ${transferTarget?.name}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Chọn tiệm đích. Nhân viên sẽ được chuyển sang tiệm đó ngay lập tức.
          </p>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Chọn tiệm</label>
            <select
              value={selectedShopId}
              onChange={(e) => setSelectedShopId(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-primary-400"
            >
              <option value="">-- Chọn tiệm --</option>
              {allShops
                .filter((s) => s.id !== shopId)
                .map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))
              }
            </select>
          </div>
          {selectedShopId && (
            <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
              <Store size={16} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  {allShops.find((s) => s.id === selectedShopId)?.name}
                </p>
                <p className="text-xs text-gray-400 font-mono">{selectedShopId}</p>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth onClick={() => setTransferOpen(false)}>Hủy</Button>
            <Button
              fullWidth
              disabled={!selectedShopId}
              onClick={() => { setTransferOpen(false); setTransferConfirmOpen(true); }}
            >
              <ArrowRightLeft size={15} /> Chuyển
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={transferConfirmOpen}
        onClose={() => setTransferConfirmOpen(false)}
        onConfirm={handleTransferConfirm}
        title="Xác nhận chuyển tiệm"
        description={`Chuyển "${transferTarget?.name}" sang "${allShops.find((s) => s.id === selectedShopId)?.name}"? Nhân viên sẽ không còn trong danh sách tiệm này.`}
        confirmLabel="Chuyển tiệm"
        variant="warning"
        loading={submitting}
      />
    </>
  );
}

// ── Tab: Giao dịch ───────────────────────────────────────────────────────────

type TxFilterMode = 'all' | 'month' | 'week' | 'custom';

function TransactionsTab({ transactions, loading, staff, shopId }: { transactions: Transaction[]; loading: boolean; staff: User[]; shopId: string }) {
  const [search, setSearch]           = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [filterMode, setFilterMode]   = useState<TxFilterMode>('all');
  const [customFrom, setCustomFrom]   = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [deleteTx, setDeleteTx]       = useState<Transaction | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStaffId, setAddStaffId]   = useState('');
  const [addAmount, setAddAmount]     = useState('');
  const [addDate, setAddDate]         = useState(format(new Date(), 'yyyy-MM-dd'));
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [editTarget, setEditTarget]   = useState<Transaction | null>(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editAmount, setEditAmount]   = useState('');
  const [editDate, setEditDate]       = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const staffNames = useMemo(() => {
    const map = new Map<string, string>();
    transactions.forEach((t) => map.set(t.staffId, t.staffName));
    return Array.from(map.entries());
  }, [transactions]);

  const { dateFrom, dateTo, rangeLabel, rangeFilename } = useMemo(() => {
    const today = new Date();
    if (filterMode === 'month') {
      return {
        dateFrom: startOfMonth(today),
        dateTo: endOfMonth(today),
        rangeLabel: format(today, 'MMMM yyyy', { locale: vi }),
        rangeFilename: format(today, 'yyyy-MM'),
      };
    }
    if (filterMode === 'week') {
      const from = startOfDay(subDays(today, 6));
      return {
        dateFrom: from,
        dateTo: endOfDay(today),
        rangeLabel: `${format(from, 'dd/MM')} – ${format(today, 'dd/MM/yyyy')}`,
        rangeFilename: `7ngay-${format(today, 'yyyyMMdd')}`,
      };
    }
    if (filterMode === 'custom') {
      const from = startOfDay(parseISO(customFrom));
      const to   = endOfDay(parseISO(customTo));
      return {
        dateFrom: from,
        dateTo: to,
        rangeLabel: `${format(from, 'dd/MM/yyyy')} – ${format(to, 'dd/MM/yyyy')}`,
        rangeFilename: `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`,
      };
    }
    return { dateFrom: null, dateTo: null, rangeLabel: 'Tất cả', rangeFilename: 'tat-ca' };
  }, [filterMode, customFrom, customTo]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchSearch = !search || t.staffName.toLowerCase().includes(search.toLowerCase());
      const matchStaff  = !staffFilter || t.staffId === staffFilter;
      let matchDate = true;
      if (dateFrom && dateTo) {
        const d = t.createdAt.toDate();
        matchDate = d >= dateFrom && d <= dateTo;
      }
      return matchSearch && matchStaff && matchDate;
    });
  }, [transactions, search, staffFilter, dateFrom, dateTo]);

  const total = filtered.reduce((s, t) => s + t.totalAmount, 0);

  const handleDelete = async () => {
    if (!deleteTx) return;
    setDeleting(true);
    try {
      await deleteTransaction(deleteTx.id);
      toast.success('Đã xóa giao dịch');
      setDeleteTx(null);
    } catch {
      toast.error('Không thể xóa');
    } finally {
      setDeleting(false);
    }
  };

  const openEdit = (t: Transaction) => {
    setEditTarget(t);
    setEditDate(format(t.createdAt.toDate(), 'yyyy-MM-dd'));
    setEditStaffId(t.staffId);
    setEditAmount(String(t.totalAmount));
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    const amount = parseFloat(editAmount);
    if (!editStaffId || isNaN(amount) || amount <= 0) {
      toast.error('Vui lòng chọn nhân viên và nhập số tiền hợp lệ');
      return;
    }
    setEditSubmitting(true);
    try {
      const selected = staff.find((s) => s.id === editStaffId);
      await updateTransaction(editTarget.id, {
        totalAmount: amount,
        staffId: editStaffId,
        staffName: selected?.name ?? editTarget.staffName,
        date: new Date(`${editDate}T12:00:00`),
      });
      toast.success('Đã cập nhật giao dịch');
      setEditTarget(null);
    } catch {
      toast.error('Không thể cập nhật giao dịch');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleAdd = async () => {
    const amount = parseFloat(addAmount);
    if (!addStaffId || isNaN(amount) || amount <= 0) {
      toast.error('Vui lòng chọn nhân viên và nhập số tiền hợp lệ');
      return;
    }
    setAddSubmitting(true);
    try {
      const selected = staff.find((s) => s.id === addStaffId);
      await createTransaction(
        shopId,
        addStaffId,
        selected?.name ?? '',
        { totalAmount: amount },
        new Date(`${addDate}T12:00:00`)
      );
      toast.success('Đã thêm giao dịch');
      setShowAddModal(false);
      setAddStaffId('');
      setAddAmount('');
      setAddDate(format(new Date(), 'yyyy-MM-dd'));
    } catch {
      toast.error('Không thể thêm giao dịch');
    } finally {
      setAddSubmitting(false);
    }
  };

  const staffSuffix = staffFilter
    ? `-${(staffNames.find(([id]) => id === staffFilter)?.[1] ?? staffFilter).replace(/\s+/g, '-')}`
    : '';
  const exportFilename = `giao-dich-${rangeFilename}${staffSuffix}`;
  const exportTitle    = `Giao dịch – ${rangeLabel}${staffFilter ? ` · ${staffNames.find(([id]) => id === staffFilter)?.[1] ?? ''}` : ''}`;

  const handleExportExcel = () => {
    exportToExcel(
      filtered.map((t) => ({
        'Ngày': format(t.createdAt.toDate(), 'dd/MM/yyyy HH:mm'),
        'Nhân viên': t.staffName,
        'Số tiền (€)': t.totalAmount,
      })),
      exportFilename
    );
  };

  const handleExportPDF = () => {
    exportToPDF(
      exportTitle,
      ['Ngày', 'Nhân viên', 'Số tiền'],
      filtered.map((t) => [
        format(t.createdAt.toDate(), 'dd/MM/yyyy'),
        t.staffName,
        formatCurrency(t.totalAmount),
      ]),
      exportFilename
    );
  };

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setShowAddModal(true)}>
          <Plus size={14} /> Thêm giao dịch
        </Button>
      </div>

      <SearchBar placeholder="Tìm khách, nhân viên..." value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
        {([
          { value: 'all', label: 'Tất cả' },
          { value: 'month', label: 'Tháng này' },
          { value: 'week', label: '7 ngày gần nhất' },
          { value: 'custom', label: 'Tùy chọn' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterMode(opt.value)}
            className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium transition-all ${
              filterMode === opt.value
                ? 'bg-gradient-primary text-white shadow-glass'
                : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {filterMode === 'custom' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <span className="text-gray-400 pb-2">→</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
            <input type="date" value={customTo} min={customFrom} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setCustomTo(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </div>
      )}

      {/* Staff filter */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Nhân viên</label>
        <select
          className="w-full h-9 px-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
          value={staffFilter}
          onChange={(e) => setStaffFilter(e.target.value)}
        >
          <option value="">Tất cả nhân viên</option>
          {staffNames.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>

      {/* Export */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex-1">
          <Image src="/export excel.png" alt="Excel" width={16} height={16} /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-1">
          <Image src="/export pdf.png" alt="PDF" width={16} height={16} /> PDF
        </Button>
      </div>

      {filtered.length > 0 && (
        <div className="bg-gradient-primary rounded-2xl p-4 text-white">
          <p className="text-sm text-white/80">Tổng doanh thu ({filtered.length} GD)</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(total)}</p>
        </div>
      )}

      {loading ? (
        <SkeletonList count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<ArrowLeftRight size={36} />} title="Không có giao dịch" />
      ) : (
        <div className="space-y-2">
          {filtered.map((t, i) => (
            <TransactionCard key={t.id} transaction={t} index={i} onEdit={() => openEdit(t)} onDelete={() => setDeleteTx(t)} />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTx}
        onClose={() => setDeleteTx(null)}
        onConfirm={handleDelete}
        title="Xóa giao dịch"
        description="Bạn có chắc muốn xóa giao dịch này không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa"
        loading={deleting}
      />

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Sửa giao dịch" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày *</label>
            <input
              type="date"
              value={editDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setEditDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Nhân viên *</label>
            <select
              value={editStaffId}
              onChange={(e) => setEditStaffId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Chọn nhân viên</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền (€) *</label>
            <input
              type="number"
              min="1"
              placeholder="150"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <Button onClick={handleEditSave} fullWidth loading={editSubmitting}>
            Cập nhật
          </Button>
        </div>
      </Modal>

      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title="Thêm giao dịch" size="sm">
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Ngày *</label>
            <input
              type="date"
              value={addDate}
              max={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => setAddDate(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Nhân viên *</label>
            <select
              value={addStaffId}
              onChange={(e) => setAddStaffId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
              <option value="">Chọn nhân viên</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Số tiền (€) *</label>
            <input
              type="number"
              min="1"
              placeholder="150"
              value={addAmount}
              onChange={(e) => setAddAmount(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
          </div>
          <Button onClick={handleAdd} fullWidth loading={addSubmitting}>
            Lưu giao dịch
          </Button>
        </div>
      </Modal>
    </>
  );
}

// ── Tab: Dịch vụ ─────────────────────────────────────────────────────────────

const svcSchema = z.object({
  name:   z.string().min(2, 'Tên ít nhất 2 ký tự'),
  price:  z.coerce.number().min(1, 'Giá phải lớn hơn 0'),
  active: z.boolean().default(true),
});
type SvcForm = z.infer<typeof svcSchema>;

function ServicesTab({ shopId, services, loading }: {
  shopId: string;
  services: ReturnType<typeof useServices>['services'];
  loading: boolean;
}) {
  const [search, setSearch]       = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Service | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SvcForm>({
    resolver: zodResolver(svcSchema),
    defaultValues: { active: true },
  });

  const filtered = services.filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()));

  const openAdd = () => {
    setEditTarget(null);
    reset({ name: '', price: 0, active: true });
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditTarget(s);
    reset({ name: s.name, price: s.price, active: s.active });
    setModalOpen(true);
  };

  const onSubmit = async (data: SvcForm) => {
    setSubmitting(true);
    try {
      if (editTarget) {
        await updateService(editTarget.id, data);
        toast.success('Cập nhật dịch vụ thành công!');
      } else {
        await createService(shopId, data);
        toast.success('Thêm dịch vụ thành công!');
      }
      setModalOpen(false);
    } catch {
      toast.error('Có lỗi xảy ra');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await deleteService(editTarget.id);
      toast.success('Đã xóa dịch vụ');
      setDeleteOpen(false);
    } catch {
      toast.error('Không thể xóa');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (s: Service) => {
    try {
      await toggleServiceActive(s.id, !s.active);
      toast.success(s.active ? 'Đã ẩn dịch vụ' : 'Đã hiện dịch vụ');
    } catch {
      toast.error('Không thể thực hiện');
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <SearchBar placeholder="Tìm dịch vụ..." value={search} onChange={(e) => setSearch(e.target.value)} onClear={() => setSearch('')} />
        <Button size="icon" onClick={openAdd} className="flex-shrink-0">
          <Plus size={18} />
        </Button>
      </div>

      <div className="text-xs text-gray-400">
        {services.filter((s) => s.active).length} đang hoạt động / {services.length} dịch vụ
      </div>

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Scissors size={36} />}
          title={search ? 'Không tìm thấy' : 'Chưa có dịch vụ'}
          description={search ? 'Thử tìm kiếm khác' : 'Thêm dịch vụ để nhân viên chọn khi nhập giao dịch'}
          action={!search && <Button onClick={openAdd}><Plus size={16} /> Thêm dịch vụ</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((s, i) => (
            <ServiceCard
              key={s.id}
              service={s}
              index={i}
              onEdit={() => openEdit(s)}
              onDelete={() => { setEditTarget(s); setDeleteOpen(true); }}
              onToggleActive={() => handleToggle(s)}
            />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Tên dịch vụ" placeholder="VD: Nail gel, Massage, ..." error={errors.name?.message} {...register('name')} />
          <Input label="Giá (€)" type="number" placeholder="150" error={errors.price?.message} {...register('price')} />
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="h-4 w-4 rounded accent-primary-500" {...register('active')} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hoạt động</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth type="button" onClick={() => setModalOpen(false)}>Hủy</Button>
            <Button fullWidth type="submit" loading={submitting}>{editTarget ? 'Lưu' : 'Thêm'}</Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Xóa dịch vụ"
        description={`Bạn có chắc muốn xóa dịch vụ "${editTarget?.name}"?`}
        confirmLabel="Xóa"
        loading={submitting}
      />
    </>
  );
}

// ── Tab: Báo cáo ─────────────────────────────────────────────────────────────

type RptFilterMode = 'month' | 'week' | 'custom';

function ReportsTab({ transactions, shopName, staff }: { transactions: Transaction[]; shopName: string; staff: User[] }) {
  const [filterMode, setFilterMode]       = useState<RptFilterMode>('month');
  const [customFrom, setCustomFrom]       = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customTo, setCustomTo]           = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');

  const staffNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    staff.forEach((s) => { map[s.id] = s.name; });
    return map;
  }, [staff]);

  const { dateFrom, dateTo, rangeLabel, rangeFilename } = useMemo(() => {
    const today = new Date();
    if (filterMode === 'month') {
      return {
        dateFrom: startOfMonth(today),
        dateTo: endOfMonth(today),
        rangeLabel: format(today, 'MMMM yyyy', { locale: vi }),
        rangeFilename: format(today, 'yyyy-MM'),
      };
    }
    if (filterMode === 'week') {
      const from = startOfDay(subDays(today, 6));
      return {
        dateFrom: from,
        dateTo: endOfDay(today),
        rangeLabel: `${format(from, 'dd/MM')} – ${format(today, 'dd/MM/yyyy')}`,
        rangeFilename: `7ngay-${format(today, 'yyyyMMdd')}`,
      };
    }
    const from = startOfDay(parseISO(customFrom));
    const to   = endOfDay(parseISO(customTo));
    return {
      dateFrom: from,
      dateTo: to,
      rangeLabel: `${format(from, 'dd/MM/yyyy')} – ${format(to, 'dd/MM/yyyy')}`,
      rangeFilename: `${format(from, 'yyyyMMdd')}-${format(to, 'yyyyMMdd')}`,
    };
  }, [filterMode, customFrom, customTo]);

  const staffSuffix = selectedStaffId !== 'all'
    ? `-${(staffNameMap[selectedStaffId] ?? selectedStaffId).replace(/\s+/g, '-')}`
    : '';

  const filteredTx = useMemo(() => transactions.filter((t) => {
    const d = t.createdAt.toDate();
    const inRange = d >= dateFrom && d <= dateTo;
    const inStaff = selectedStaffId === 'all' || t.staffId === selectedStaffId;
    return inRange && inStaff;
  }), [transactions, dateFrom, dateTo, selectedStaffId]);

  const staffReports = useMemo((): StaffReport[] => {
    const map: Record<string, StaffReport> = {};
    filteredTx.forEach((t) => {
      if (!map[t.staffId]) map[t.staffId] = { staffId: t.staffId, staffName: staffNameMap[t.staffId] ?? t.staffName, customerCount: 0, totalRevenue: 0, avgRevenue: 0 };
      map[t.staffId].customerCount += 1;
      map[t.staffId].totalRevenue  += t.totalAmount;
    });
    return Object.values(map).map((r) => ({ ...r, avgRevenue: r.customerCount > 0 ? r.totalRevenue / r.customerCount : 0 })).sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredTx, staffNameMap]);

  const totalRevenue = filteredTx.reduce((s, t) => s + t.totalAmount, 0);

  const reportTitle = () => {
    const staffLabel = selectedStaffId !== 'all' ? ` · ${staffNameMap[selectedStaffId] ?? ''}` : '';
    return `Báo cáo nhân viên – ${shopName} – ${rangeLabel}${staffLabel}`;
  };
  const rptFilename = `${shopName}-bao-cao-nhan-vien-${rangeFilename}${staffSuffix}`;

  const handleExportExcel = () => {
    exportToExcel(
      staffReports.map((r) => ({
        'Nhân viên': r.staffName,
        'Số GD': r.customerCount,
        'Doanh thu (€)': r.totalRevenue,
        'TB/GD (€)': Math.round(r.avgRevenue),
      })),
      rptFilename
    );
  };

  const handleExportPDF = () => {
    exportToPDF(
      reportTitle(),
      ['Nhân viên', 'Số GD', 'Doanh thu', 'TB/GD'],
      staffReports.map((r) => [r.staffName, r.customerCount, formatCurrency(r.totalRevenue), formatCurrency(r.avgRevenue)]),
      rptFilename
    );
  };

  const handlePrint = () => {
    exportToPDF(
      reportTitle(),
      ['Nhân viên', 'Số GD', 'Doanh thu', 'TB/GD'],
      staffReports.map((r) => [r.staffName, r.customerCount, formatCurrency(r.totalRevenue), formatCurrency(r.avgRevenue)]),
      rptFilename
    );
  };

  return (
    <>
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-0.5 -mx-1 px-1">
        {([
          { value: 'month', label: 'Tháng này' },
          { value: 'week', label: '7 ngày gần nhất' },
          { value: 'custom', label: 'Tùy chọn' },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilterMode(opt.value)}
            className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
              filterMode === opt.value
                ? 'bg-gradient-primary text-white shadow-sm'
                : 'bg-white dark:bg-gray-900 text-gray-500 border border-gray-200 dark:border-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {filterMode === 'custom' && (
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Từ ngày</label>
            <input type="date" value={customFrom} max={customTo} onChange={(e) => setCustomFrom(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
          <span className="text-gray-400 pb-2">→</span>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Đến ngày</label>
            <input type="date" value={customTo} min={customFrom} max={format(new Date(), 'yyyy-MM-dd')} onChange={(e) => setCustomTo(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400" />
          </div>
        </div>
      )}

      {/* Staff filter */}
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Lọc theo nhân viên</label>
        <select
          value={selectedStaffId}
          onChange={(e) => setSelectedStaffId(e.target.value)}
          className="w-full h-9 px-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-400"
        >
          <option value="all">Tất cả nhân viên</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-400 mb-1">Doanh thu</p>
          <p className="font-bold text-primary-600 text-sm">{formatCurrency(totalRevenue)}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-400 mb-1">Giao dịch</p>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{filteredTx.length}</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className="text-xs text-gray-400 mb-1">Nhân viên</p>
          <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{staffReports.length}</p>
        </Card>
      </div>

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportExcel} className="flex-1">
          <Image src="/export excel.png" alt="Excel" width={16} height={16} /> Excel
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF} className="flex-1">
          <Image src="/export pdf.png" alt="PDF" width={16} height={16} /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1">
          <Image src="/in.png" alt="In" width={16} height={16} /> In
        </Button>
      </div>

      <Card>
        {staffReports.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Không có dữ liệu</p>
        ) : (
          <div className="space-y-4">
            {staffReports.map((r, i) => (
              <div key={r.staffId}>
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-primary flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900 dark:text-gray-100">{r.staffName}</p>
                    <p className="text-xs text-gray-400">{r.customerCount} GD · TB: {formatCurrency(r.avgRevenue)}</p>
                  </div>
                  <p className="font-bold text-primary-600 dark:text-primary-400 text-sm">{formatCurrency(r.totalRevenue)}</p>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden ml-11">
                  <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${totalRevenue > 0 ? (r.totalRevenue / totalRevenue) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
