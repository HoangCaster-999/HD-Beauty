'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Store, Moon, Sun, LogOut, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/owner/dashboard',    img: '/dashboard.png', label: 'Tổng quan'  },
  { href: '/owner/staff',        img: '/nhanvien.png',  label: 'Nhân viên'  },
  { href: '/owner/revenue',      img: null,             label: 'Doanh thu'  },
  { href: '/owner/transactions', img: '/giaodich.png',  label: 'Giao dịch'  },
  { href: '/owner/reports',      img: '/baocao.png',    label: 'Báo cáo'    },
];

export default function OwnerSidebar() {
  const pathname = usePathname();
  const { user, logout, isOwner } = useAuth();
  const { toggleTheme, isDark } = useTheme();
  const hasShop = !!user?.shopId;

  // Doanh thu: chỉ chủ tiệm được thấy
  const navItems = NAV_ITEMS.filter(i => i.href !== '/owner/revenue' || isOwner);

  return (
    <aside className="hidden md:flex flex-col fixed left-0 top-0 h-full w-16 lg:w-56 bg-white dark:bg-gray-900 border-r border-gray-100 dark:border-gray-800 z-40 py-4 transition-all duration-200">

      {/* Logo */}
      <div className="px-3 mb-6 flex items-center gap-2 justify-center lg:justify-start">
        <Image src="/logo.png" alt="HD Beauty" width={38} height={38} className="rounded-xl flex-shrink-0" />
        <div className="hidden lg:block min-w-0">
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100 leading-tight">HD Beauty</p>
          <p className="text-[10px] text-primary-400 font-medium">Manager</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors group',
                active
                  ? 'bg-primary-50 dark:bg-primary-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              {item.img ? (
                <Image
                  src={item.img}
                  alt={item.label}
                  width={24}
                  height={24}
                  className={cn('flex-shrink-0 transition-opacity', active ? 'opacity-100' : 'opacity-45 group-hover:opacity-70')}
                />
              ) : (
                <Wallet
                  size={22}
                  className={cn(
                    'flex-shrink-0 transition-colors',
                    active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 opacity-45 group-hover:opacity-70'
                  )}
                />
              )}
              <span className={cn(
                'hidden lg:block text-sm font-medium truncate',
                active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Shop tab */}
        {(() => {
          const active = pathname === '/owner/shop' || pathname.startsWith('/owner/shop/');
          return (
            <Link
              href="/owner/shop"
              title={hasShop ? 'Tiệm' : 'Tạo tiệm'}
              className={cn(
                'flex items-center gap-3 px-2 py-2.5 rounded-xl transition-colors relative group',
                active ? 'bg-primary-50 dark:bg-primary-900/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
            >
              <Store
                size={22}
                className={cn(
                  'flex-shrink-0',
                  active ? 'text-primary-600 dark:text-primary-400' : !hasShop ? 'text-amber-500' : 'text-gray-400'
                )}
              />
              {!hasShop && !active && (
                <span className="absolute top-2 left-6 h-2 w-2 rounded-full bg-amber-400" />
              )}
              <span className={cn(
                'hidden lg:block text-sm font-medium',
                active ? 'text-primary-600 dark:text-primary-400' : !hasShop ? 'text-amber-500' : 'text-gray-600 dark:text-gray-400'
              )}>
                {hasShop ? 'Tiệm' : 'Tạo tiệm'}
              </span>
            </Link>
          );
        })()}
      </nav>

      {/* Bottom actions */}
      <div className="px-2 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-0.5">
        <button
          onClick={toggleTheme}
          title={isDark ? 'Chế độ sáng' : 'Chế độ tối'}
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
          <span className="hidden lg:block text-sm font-medium text-gray-600 dark:text-gray-400">
            {isDark ? 'Chế độ sáng' : 'Chế độ tối'}
          </span>
        </button>
        <button
          onClick={logout}
          title="Đăng xuất"
          className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <LogOut size={20} />
          <span className="hidden lg:block text-sm font-medium">Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
