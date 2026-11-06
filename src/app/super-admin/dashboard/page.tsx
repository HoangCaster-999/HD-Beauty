'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { collection, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Shop, User, Transaction } from '@/types';
import { createOwnerWithShop } from '@/services/auth.service';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { SkeletonCard } from '@/components/ui/Loading';
import { formatCurrency, formatDate } from '@/lib/utils';
import Link from 'next/link';
import {
  Store, Users, ArrowLeftRight, TrendingUp, RefreshCw, Plus,
  Eye, EyeOff, Pencil, Trash2, AlertCircle, ChevronRight,
} from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

interface ShopStats {
  shop: Shop;
  memberCount: number;
  monthRevenue: number;
  monthTransactions: number;
  owner: User | null;
}

const createSchema = z.object({
  shopName:      z.string().min(2, 'Tên tiệm ít nhất 2 ký tự'),
  ownerName:     z.string().min(2, 'Tên ít nhất 2 ký tự'),
  ownerPhone:    z.string().optional(),
  ownerEmail:    z.string().email('Email không hợp lệ'),
  ownerPassword: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
});
type CreateFormData = z.infer<typeof createSchema>;

export default function SuperAdminDashboard() {
  const [shopStats, setShopStats] = useState<ShopStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  // Create shop modal
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  // Edit shop modal
  const [editShopOpen, setEditShopOpen] = useState(false);
  const [editShop, setEditShop] = useState<Shop | null>(null);
  const [editShopName, setEditShopName] = useState('');
  const [editingShop, setEditingShop] = useState(false);

  // Delete shop
  const [deleteShopOpen, setDeleteShopOpen] = useState(false);
  const [deleteShop, setDeleteShop] = useState<Shop | null>(null);
  const [deletingShop, setDeletingShop] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
  });

  async function fetchAllData() {
    setLoading(true);
    setLoadError('');

    const monthStart = startOfMonth(new Date());
    const monthEnd   = endOfMonth(new Date());
    const msStart = Timestamp.fromDate(monthStart).seconds;
    const msEnd   = Timestamp.fromDate(monthEnd).seconds;

    const [shopsResult, usersResult, txResult] = await Promise.allSettled([
      getDocs(collection(db, 'shops')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'transactions')),
    ]);

    if (shopsResult.status === 'rejected') {
      const msg = (shopsResult.reason as Error)?.message ?? 'Permission denied';
      console.error('shops query failed:', shopsResult.reason);
      setLoadError(`Không thể đọc dữ liệu tiệm: ${msg}. Vui lòng kiểm tra Firestore Rules.`);
      setLoading(false);
      return;
    }

    const shops = shopsResult.value.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Shop)
      .sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);

    const users = usersResult.status === 'fulfilled'
      ? usersResult.value.docs.map((d) => ({ id: d.id, ...d.data() }) as User)
      : [];

    const allTx = txResult.status === 'fulfilled'
      ? txResult.value.docs
          .map((d) => ({ id: d.id, ...d.data() }) as Transaction)
          .filter((t) => t.createdAt.seconds >= msStart && t.createdAt.seconds <= msEnd)
      : [];

    setTotalUsers(users.filter((u) => u.role !== 'super_admin').length);

    let grandTotal = 0;
    const stats: ShopStats[] = shops.map((shop) => {
      const members    = users.filter((u) => u.shopId === shop.id && u.role !== 'super_admin');
      const owner      = users.find((u)  => u.shopId === shop.id && u.role === 'owner') ?? null;
      const shopTx     = allTx.filter((t) => t.shopId === shop.id);
      const monthRevenue = shopTx.reduce((s, t) => s + t.totalAmount, 0);
      grandTotal += monthRevenue;
      return { shop, memberCount: members.length, monthRevenue, monthTransactions: shopTx.length, owner };
    });

    setShopStats(stats.sort((a, b) => b.monthRevenue - a.monthRevenue));
    setTotalRevenue(grandTotal);
    setLoading(false);
  }

  useEffect(() => { fetchAllData(); }, []);

  // ── Create shop + owner ──────────────────────────────────────
  const handleCreate = async (data: CreateFormData) => {
    setCreating(true);
    try {
      await createOwnerWithShop(data.shopName, data.ownerEmail, data.ownerPassword, data.ownerName, data.ownerPhone || '');
      toast.success(`Đã tạo tiệm "${data.shopName}" thành công!`);
      reset(); setShowPwd(false); setCreateOpen(false);
      fetchAllData();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === 'auth/email-already-in-use') toast.error('Email owner đã được sử dụng');
      else toast.error('Không thể tạo tiệm. Vui lòng thử lại.');
    } finally {
      setCreating(false);
    }
  };

  // ── Edit shop name ───────────────────────────────────────────
  const openEditShop = (shop: Shop) => {
    setEditShop(shop);
    setEditShopName(shop.name);
    setEditShopOpen(true);
  };

  const handleEditShop = async () => {
    if (!editShop || !editShopName.trim()) return;
    setEditingShop(true);
    try {
      await updateDoc(doc(db, 'shops', editShop.id), { name: editShopName.trim() });
      toast.success('Đã cập nhật tên tiệm!');
      setShopStats((prev) => prev.map((s) =>
        s.shop.id === editShop.id ? { ...s, shop: { ...s.shop, name: editShopName.trim() } } : s
      ));
      setEditShopOpen(false);
    } catch {
      toast.error('Không thể cập nhật');
    } finally {
      setEditingShop(false);
    }
  };

  // ── Delete shop ──────────────────────────────────────────────
  const handleDeleteShop = async () => {
    if (!deleteShop) return;
    setDeletingShop(true);
    try {
      await deleteDoc(doc(db, 'shops', deleteShop.id));
      toast.success('Đã xóa tiệm');
      setShopStats((prev) => prev.filter((s) => s.shop.id !== deleteShop.id));
      setDeleteShopOpen(false);
    } catch {
      toast.error('Không thể xóa tiệm');
    } finally {
      setDeletingShop(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tổng quan hệ thống</h1>
          <p className="text-sm text-gray-400 mt-1">Tất cả tiệm trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAllData}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <RefreshCw size={14} /> Làm mới
          </button>
          <button
            onClick={() => { reset(); setShowPwd(false); setCreateOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-gradient-primary text-white text-sm font-medium shadow-sm hover:opacity-90 transition-opacity"
          >
            <Plus size={14} /> Thêm tiệm
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">Lỗi tải dữ liệu</p>
            <p className="text-xs text-red-600 dark:text-red-500 mt-0.5">{loadError}</p>
            <p className="text-xs text-red-500 mt-1">
              Kiểm tra Firebase Console → Firestore → Rules và đảm bảo rules đã được deploy.
            </p>
          </div>
        </div>
      )}

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Tổng tiệm',    value: shopStats.length, icon: Store,         gradient: 'from-primary-500 to-secondary-400' },
          { label: 'Tổng thành viên', value: totalUsers,    icon: Users,         gradient: 'from-mint-400 to-emerald-400' },
          { label: 'DT tháng này', value: formatCurrency(totalRevenue), icon: TrendingUp, gradient: 'from-amber-400 to-orange-400' },
          { label: 'GD tháng này', value: shopStats.reduce((s, st) => s + st.monthTransactions, 0), icon: ArrowLeftRight, gradient: 'from-blue-400 to-cyan-400' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-3xl p-4 bg-gradient-to-br ${item.gradient} text-white relative overflow-hidden`}
          >
            <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/20" />
            <item.icon size={20} className="mb-2 relative" />
            <p className="text-2xl font-bold relative">{item.value}</p>
            <p className="text-xs text-white/70 mt-1 relative">{item.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Shops List */}
      <div>
        <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-4">
          Danh sách tiệm ({shopStats.length})
        </h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} className="h-36" />)}
          </div>
        ) : shopStats.length === 0 && !loadError ? (
          <Card>
            <p className="text-center text-gray-400 py-8">Chưa có tiệm nào — nhấn "Thêm tiệm" để tạo</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {shopStats.map((stat, i) => (
              <motion.div
                key={stat.shop.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    {/* Clickable shop info → detail page */}
                    <Link href={`/super-admin/shops/detail?shopId=${stat.shop.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                      <div className="h-12 w-12 rounded-2xl bg-gradient-primary flex items-center justify-center flex-shrink-0">
                        <Store size={20} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 dark:text-gray-100 truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {stat.shop.name}
                        </p>
                        {stat.owner && (
                          <p className="text-xs text-gray-400 truncate">
                            👤 {stat.owner.name} — {stat.owner.email}
                          </p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          Tạo: {formatDate(stat.shop.createdAt.toDate())}
                        </p>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <div className="text-right mr-1">
                        <p className="font-bold text-primary-600 dark:text-primary-400">
                          {formatCurrency(stat.monthRevenue)}
                        </p>
                        <p className="text-xs text-gray-400">tháng này</p>
                      </div>
                      <Link
                        href={`/super-admin/shops/detail?shopId=${stat.shop.id}`}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="Xem chi tiết"
                      >
                        <ChevronRight size={16} />
                      </Link>
                      <button
                        onClick={() => openEditShop(stat.shop)}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                        title="Sửa tên tiệm"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => { setDeleteShop(stat.shop); setDeleteShopOpen(true); }}
                        className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        title="Xóa tiệm"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{stat.memberCount}</p>
                      <p className="text-xs text-gray-400">Thành viên</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{stat.monthTransactions}</p>
                      <p className="text-xs text-gray-400">GD tháng này</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {stat.monthTransactions > 0 ? formatCurrency(stat.monthRevenue / stat.monthTransactions) : '—'}
                      </p>
                      <p className="text-xs text-gray-400">TB/GD</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Create shop + owner */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Tạo tiệm mới">
        <form onSubmit={handleSubmit(handleCreate)} className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Thông tin tiệm</p>
            <Input label="Tên tiệm" placeholder="VD: HD Beauty - Chi nhánh 2" error={errors.shopName?.message} {...register('shopName')} />
          </div>
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tài khoản chủ tiệm</p>
            <div className="space-y-3">
              <Input label="Họ tên" placeholder="Nguyễn Văn A" error={errors.ownerName?.message} {...register('ownerName')} />
              <Input label="Số điện thoại" placeholder="0901234567" type="tel" {...register('ownerPhone')} />
              <Input label="Email đăng nhập" type="email" placeholder="owner@email.com" error={errors.ownerEmail?.message} {...register('ownerEmail')} />
              <Input
                label="Mật khẩu"
                type={showPwd ? 'text' : 'password'}
                placeholder="Ít nhất 6 ký tự"
                error={errors.ownerPassword?.message}
                rightIcon={
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                }
                {...register('ownerPassword')}
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" fullWidth type="button" onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button fullWidth type="submit" loading={creating}><Plus size={16} /> Tạo tiệm</Button>
          </div>
        </form>
      </Modal>

      {/* Edit shop name */}
      <Modal open={editShopOpen} onClose={() => setEditShopOpen(false)} title="Sửa tên tiệm">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Tên tiệm mới</label>
            <input
              value={editShopName}
              onChange={(e) => setEditShopName(e.target.value)}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm outline-none focus:border-primary-400"
            />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" fullWidth onClick={() => setEditShopOpen(false)}>Hủy</Button>
            <Button fullWidth loading={editingShop} disabled={!editShopName.trim()} onClick={handleEditShop}>Lưu</Button>
          </div>
        </div>
      </Modal>

      {/* Delete shop confirm */}
      <ConfirmDialog
        open={deleteShopOpen}
        onClose={() => setDeleteShopOpen(false)}
        onConfirm={handleDeleteShop}
        title="Xóa tiệm"
        description={`Xóa tiệm "${deleteShop?.name}"? Dữ liệu tiệm sẽ bị xóa nhưng tài khoản nhân viên vẫn còn trong hệ thống.`}
        confirmLabel="Xóa tiệm"
        loading={deletingShop}
      />
    </div>
  );
}
