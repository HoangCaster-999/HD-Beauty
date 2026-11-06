'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Loading from '@/components/ui/Loading';
import { Moon, Sun, LogOut, LayoutDashboard, Users, CalendarX2 } from 'lucide-react';
import Image from 'next/image';
import { useTheme } from '@/contexts/ThemeContext';
import { getInitials } from '@/lib/utils';

const NAV = [
  { href: '/super-admin/dashboard', label: 'Tổng quan',    icon: LayoutDashboard },
  { href: '/super-admin/users',     label: 'Người dùng',   icon: Users },
  { href: '/super-admin/revenue-cleanup', label: 'Xóa doanh thu', icon: CalendarX2 },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isSuperAdmin, logout } = useAuth();
  const initials = getInitials(user?.name || 'S');
  const { toggleTheme, isDark } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login');
      else if (!isSuperAdmin) router.replace('/');
    }
  }, [user, loading, isSuperAdmin, router]);

  if (loading) return <Loading fullScreen text="Đang tải..." />;
  if (!isSuperAdmin) return null;

  return (
    <div className="min-h-screen min-h-dvh bg-gray-50 dark:bg-gray-950">
      {/* Top nav */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between px-4 py-3 max-w-5xl mx-auto">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="HD Beauty" width={36} height={36} className="rounded-xl flex-shrink-0" />
            <div className="hidden sm:block">
              <p className="font-bold text-sm text-gray-900 dark:text-gray-100 leading-none">HD Beauty</p>
              <p className="text-[10px] text-amber-500 font-medium">Super Admin</p>
            </div>

            {/* Nav tabs */}
            <nav className="flex items-center gap-1 ml-4">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                      active
                        ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon size={14} />
                    {/* Màn hình hẹp: chỉ tab đang mở hiện chữ để 3 tab không tràn header */}
                    <span className={active ? 'whitespace-nowrap' : 'hidden sm:inline whitespace-nowrap'}>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {/* Avatar → profile */}
            <Link href="/super-admin/profile" className="ml-1">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white text-xs font-bold overflow-hidden border-2 border-transparent hover:border-amber-400 transition-all">
                {user?.photoURL ? (
                  <Image src={user.photoURL} alt="avatar" width={32} height={32} className="h-full w-full object-cover" unoptimized />
                ) : (
                  initials
                )}
              </div>
            </Link>
            <button
              onClick={logout}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 pb-10">{children}</main>
    </div>
  );
}
