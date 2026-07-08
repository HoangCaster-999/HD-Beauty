'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Users, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/hooks/useStaff';
import Header from '@/components/layout/Header';
import SearchBar from '@/components/ui/SearchBar';
import EmptyState from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Loading';
import { getInitials } from '@/lib/utils';

export default function OwnerRevenuePage() {
  const router = useRouter();
  const { user, isOwner } = useAuth();
  const { staff, loading } = useStaff(user?.shopId);
  const [search, setSearch] = useState('');

  // Chỉ chủ tiệm được truy cập — Manager bị chuyển về tổng quan
  useEffect(() => {
    if (user && !isOwner) router.replace('/owner/dashboard');
  }, [user, isOwner, router]);

  if (user && !isOwner) return null;

  // Chỉ hiển thị nhân viên đang hoạt động, sắp xếp theo tên
  const members = staff
    .filter((s) => s.active)
    .filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <Header title="Doanh thu" subtitle="Chọn nhân viên để ghi doanh thu" />

      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        <SearchBar
          placeholder="Tìm nhân viên..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch('')}
        />

        {loading ? (
          <SkeletonList count={4} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users size={36} />}
            title={search ? 'Không tìm thấy' : 'Chưa có nhân viên'}
            description={
              search
                ? 'Thử tìm kiếm khác'
                : 'Thêm nhân viên ở mục "Nhân viên" để bắt đầu ghi doanh thu'
            }
          />
        ) : (
          <div className="space-y-3">
            {members.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.3 }}
                onClick={() => router.push(`/owner/revenue/${s.id}`)}
                className="w-full flex items-center gap-3 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-card text-left active:scale-[0.99] transition-transform hover:border-primary-200 dark:hover:border-primary-800"
              >
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary-400 to-secondary-300 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
                  {s.photoURL ? (
                    <Image src={s.photoURL} alt={s.name} width={48} height={48} className="h-full w-full object-cover" unoptimized />
                  ) : (
                    getInitials(s.name)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">
                    {s.role === 'manager' ? 'Quản lý' : 'Nhân viên'} · {s.email}
                  </p>
                </div>
                <ChevronRight size={20} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
