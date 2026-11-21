/**
 * Quick-add actions shared by the mobile bar sheet and the desktop button.
 *
 * Each action is gated by the same permission the target page checks, so a
 * user never sees a shortcut for something they cannot do.
 */
import { useMemo } from 'react';
import { CreditCard, FilePlus2, Mail, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export interface QuickAction {
  to: string;
  label: string;
  icon: typeof FilePlus2;
}

export function useQuickActions(): QuickAction[] {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    const privileged = user?.role === 'admin' || user?.role === 'ceo' || Boolean(user?.isStaff);
    const canIssue = privileged || Boolean(user?.permissions?.issue);
    const canPay = privileged || Boolean(user?.permissions?.pay);
    const canCustomer = privileged || user?.role === 'sales' || user?.role === 'finance';
    const canLetter = privileged || Boolean(user?.accessible_modules?.includes('office'));

    const actions: QuickAction[] = [];
    if (canIssue) actions.push({ to: '/erp/billing/issue', label: 'ثبت صورت‌حساب جدید', icon: FilePlus2 });
    if (canPay) actions.push({ to: '/erp/billing/payments?new=1', label: 'ثبت پرداخت جدید', icon: CreditCard });
    if (canCustomer) actions.push({ to: '/erp/customers?new=1', label: 'ثبت مشتری جدید (CRM)', icon: UserPlus });
    if (canLetter) actions.push({ to: '/erp/office/correspondence?new=1', label: 'ثبت نامه جدید', icon: Mail });
    return actions;
  }, [user]);
}
