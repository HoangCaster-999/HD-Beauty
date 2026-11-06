import { Timestamp } from 'firebase/firestore';

export type UserRole = 'super_admin' | 'owner' | 'manager' | 'staff';

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Timestamp;
  address?: string;
  phone?: string;
  // Legacy fields — kept for backward compat
  openingHours?: string;
  weekendHours?: string;
  holidayHours?: string;
  // New structured schedule (JSON string)
  scheduleJson?: string;
}

export interface User {
  id: string;
  shopId: string;
  role: UserRole;
  name: string;
  phone: string;
  email: string;
  active: boolean;
  photoURL?: string;
  encryptedPassword?: string;
  createdAt: Timestamp;
}

export interface Service {
  id: string;
  shopId: string;
  name: string;
  price: number;
  active: boolean;
  createdAt: Timestamp;
}

export interface Transaction {
  id: string;
  shopId: string;
  staffId: string;
  staffName: string;
  totalAmount: number;
  createdAt: Timestamp;
}

export interface RevenueDeletionLog {
  id: string;
  shopId: string;
  shopName: string;
  month: string; // 'YYYY-MM' theo giờ Đức
  transactionCount: number;
  totalAmount: number;
  deletedBy: string;
  deletedByName: string;
  deletedAt: Timestamp;
}

export interface StaffReport {
  staffId: string;
  staffName: string;
  customerCount: number;
  totalRevenue: number;
  avgRevenue: number;
}

export interface DashboardStats {
  todayRevenue: number;
  monthRevenue: number;
  todayCustomers: number;
  monthCustomers: number;
  topStaff: StaffReport | null;
}

export interface ChartDataPoint {
  date: string;
  revenue: number;
  customers: number;
}

export interface TransactionFormData {
  totalAmount: number;
}

export interface StaffFormData {
  name: string;
  phone: string;
  email: string;
  password?: string;
}

export interface ServiceFormData {
  name: string;
  price: number;
  active: boolean;
}

export interface FilterState {
  dateFrom: string;
  dateTo: string;
  staffId: string;
  serviceId: string;
  search: string;
}
