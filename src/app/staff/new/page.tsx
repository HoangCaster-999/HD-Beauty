'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createTransaction } from '@/services/transaction.service';
import { useStaffWorkingWindow } from '@/hooks/useWorkingHours';
import Header from '@/components/layout/Header';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

const schema = z.object({
  totalAmount: z.coerce.number().min(1, 'Doanh thu phải lớn hơn 0'),
});

type FormData = z.infer<typeof schema>;

export default function StaffNewTransactionPage() {
  const { user } = useAuth();
  const { allowed, startHour, endHour } = useStaffWorkingWindow();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { totalAmount: undefined },
  });

  const onSubmit = async (data: FormData) => {
    if (!user?.shopId || !user?.id) return;
    if (!allowed) {
      toast.error(`Chỉ được ghi doanh thu từ ${startHour}:00 đến ${endHour}:00 (giờ Đức)`);
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction(user.shopId, user.id, user.name, {
        totalAmount: data.totalAmount,
      });

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        reset({ totalAmount: undefined });
      }, 2000);

      toast.success('Lưu giao dịch thành công!');
    } catch {
      toast.error('Không thể lưu giao dịch');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Header title="Giao dịch mới" subtitle="Nhập doanh thu" />

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          >
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 flex flex-col items-center gap-4 mx-6 shadow-2xl">
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-mint-400 to-emerald-400 flex items-center justify-center">
                <Check size={40} className="text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Đã lưu!</h3>
              <p className="text-gray-400 text-sm text-center">Giao dịch đã được ghi nhận thành công</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit(onSubmit)} className="p-4 md:p-6 space-y-5 max-w-5xl">
        {!allowed && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-900/20 p-4">
            <Clock size={20} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-700 dark:text-amber-400 text-sm">
                Ngoài giờ làm việc
              </p>
              <p className="text-amber-600/80 dark:text-amber-400/70 text-xs mt-0.5">
                Bạn chỉ có thể ghi doanh thu từ {startHour}:00 sáng đến {endHour}:00 tối (giờ Đức).
                Sau {endHour}:00 sẽ không thể thêm hoặc chỉnh sửa.
              </p>
            </div>
          </div>
        )}

        <Card>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Doanh thu</h3>
          <Input
            label="Số tiền (€) *"
            type="number"
            placeholder="150"
            disabled={!allowed}
            error={errors.totalAmount?.message}
            {...register('totalAmount')}
          />
        </Card>

        <Button type="submit" fullWidth size="lg" loading={submitting} disabled={!allowed}>
          <Sparkles size={18} />
          {allowed ? 'Lưu giao dịch' : `Đóng cửa sau ${endHour}:00`}
        </Button>
      </form>
    </div>
  );
}
