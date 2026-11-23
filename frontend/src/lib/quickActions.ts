/**
 * Quick-add actions shared by the mobile bar sheet and the desktop button.
 *
 * Each action is gated by the same permission the target page checks, so a
 * user never sees a shortcut for something they cannot do.
 */
import { useMemo } from 'react';
import { CreditCard, FilePlus2, Mail, MessageSquarePlus, UserPlus } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export interface QuickAction {
  to: string;
  label: string;
  icon: typeof FilePlus2;
}

export function useQuickActions(): QuickAction[] {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    const privileged = user?.role === 'admin' || user?.role === 'ceo' || Boolean(user?.is_superuser);

    const hasFinanceModule = privileged || Boolean(user?.accessible_modules?.includes('finance') || user?.accessible_modules?.includes('billing'));
    const hasCrmModule = privileged || Boolean(user?.accessible_modules?.includes('crm'));
    const hasOfficeModule = privileged || Boolean(user?.accessible_modules?.includes('office'));
    const hasOrbitModule = privileged || Boolean(user?.accessible_modules?.some((m) => m === 'orbit' || m === 'messaging'));

    const canIssue = hasFinanceModule && (privileged || Boolean(user?.permissions?.issue));
    const canPay = hasFinanceModule && (privileged || Boolean(user?.permissions?.pay));
    const canCustomer = hasCrmModule && (privileged || user?.role === 'sales');
    const canLetter = hasOfficeModule;

    const actions: QuickAction[] = [];
    if (hasOrbitModule) {
      actions.push({ to: '/orbit?new=1', label: 'ارسال پیام جدید', icon: MessageSquarePlus });
    }
    if (canIssue) actions.push({ to: '/erp/billing/issue', label: 'ثبت صورت‌حساب جدید', icon: FilePlus2 });
    if (canPay) actions.push({ to: '/erp/billing/payments?new=1', label: 'ثبت پرداخت جدید', icon: CreditCard });
    if (canCustomer) actions.push({ to: '/erp/crm/leads?new=1', label: 'ثبت سرنخ جدید (CRM)', icon: UserPlus });
    if (canLetter) actions.push({ to: '/erp/office/correspondence?new=1', label: 'ثبت نامه جدید', icon: Mail });
    return actions;
  }, [user]);
}
