'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { Store, Wallet } from 'lucide-react';

const baseItems = [
  { href: '/owner/dashboard',    img: '/dashboard.png' as string | null, label: 'Tổng quan' },
  { href: '/owner/staff',        img: '/nhanvien.png',                   label: 'Nhân viên' },
  { href: '/owner/revenue',      img: null,                              label: 'Doanh thu' },
  { href: '/owner/transactions', img: '/giaodich.png',                   label: 'Giao dịch' },
  { href: '/owner/reports',      img: '/baocao.png',                     label: 'Báo cáo'  },
];

export default function OwnerBottomNav() {
  const pathname = usePathname();
  const { user, isOwner } = useAuth();
  const hasShop  = !!user?.shopId;

  const navItems = (hasShop
    ? baseItems
    : baseItems.filter(i => i.href === '/owner/dashboard')
  ).filter(i => i.href !== '/owner/revenue' || isOwner); // Doanh thu: chỉ chủ tiệm

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border-t border-gray-100 dark:border-gray-800 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 min-w-0 flex-1"
            >
              <div className="relative">
                {active && (
                  <motion.div
                    layoutId="owner-nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary-100 dark:bg-primary-900/30"
                    style={{ margin: '-4px' }}
                  />
                )}
                {item.img ? (
                  <Image
                    src={item.img}
                    alt={item.label}
                    width={26}
                    height={26}
                    className={cn(
                      'relative transition-opacity duration-200',
                      active ? 'opacity-100' : 'opacity-45'
                    )}
                  />
                ) : (
                  <Wallet
                    size={22}
                    className={cn(
                      'relative transition-colors duration-200',
                      active ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500'
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium leading-none transition-colors duration-200 truncate',
                  active
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-gray-400 dark:text-gray-500'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}

        {/* Shop/Tạo tiệm tab — dùng lucide vì không có ảnh phù hợp */}
        {(() => {
          const active = pathname === '/owner/shop';
          return (
            <Link href="/owner/shop" className="flex flex-col items-center gap-1 min-w-0 flex-1">
              <div className="relative">
                {active && (
                  <motion.div
                    layoutId="owner-nav-indicator"
                    className="absolute inset-0 rounded-xl bg-primary-100 dark:bg-primary-900/30"
                    style={{ margin: '-4px' }}
                  />
                )}
                <Store
                  size={22}
                  className={cn(
                    'relative transition-colors duration-200',
                    active ? 'text-primary-600 dark:text-primary-400' : !hasShop ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
                  )}
                />
                {!hasShop && !active && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400" />
                )}
              </div>
              <span className={cn(
                'text-[10px] font-medium leading-none transition-colors duration-200 truncate',
                active ? 'text-primary-600 dark:text-primary-400' : !hasShop ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500'
              )}>
                {hasShop ? 'Tiệm' : 'Tạo tiệm'}
              </span>
            </Link>
          );
        })()}
      </div>
    </nav>
  );
}
