import React from 'react'
import {
  PieChart,
  LayoutDashboard,
  Plus,
  FileText,
  CreditCard,
  Gauge,
  Users,
  Briefcase,
  Target,
  TrendingUp,
  Calendar,
  Megaphone,
  MessageSquare,
  Inbox,
  Mail,
  FileSignature,
  Bell,
  Settings,
} from 'lucide-react'

export interface NavItem {
  to: string
  icon: React.ElementType
  label: string
  end?: boolean
}

export interface NavSection {
  id: string
  label: string
  items: NavItem[]
}

export const ERP_NAV_SECTIONS: NavSection[] = [
  {
    id: 'bi',
    label: 'داشبورد',
    items: [
      { to: '/erp/management', icon: PieChart, label: 'داشبورد مدیریتی', end: true },
    ],
  },
  {
    id: 'finance',
    label: 'مالی',
    items: [
      { to: '/erp/billing', icon: LayoutDashboard, label: 'داشبورد مالی', end: true },
      { to: '/erp/billing/issue', icon: Plus, label: 'صدور صورت‌حساب' },
      { to: '/erp/billing/invoices', icon: FileText, label: 'صورت‌حساب‌ها' },
      { to: '/erp/billing/payments', icon: CreditCard, label: 'پرداخت‌ها' },
      { to: '/erp/billing/performance', icon: Gauge, label: 'عملکرد' },
      { to: '/erp/billing/payers', icon: Users, label: 'مشتریان' },
      { to: '/erp/billing/services', icon: Briefcase, label: 'خدمات' },
    ],
  },
  {
    id: 'crm',
    label: 'CRM',
    items: [
      { to: '/erp/crm', icon: Users, label: 'داشبورد CRM', end: true },
      { to: '/erp/crm/leads', icon: Target, label: 'سرنخ‌ها' },
      { to: '/erp/crm/opportunities', icon: TrendingUp, label: 'فرصت‌ها' },
      { to: '/erp/crm/activities', icon: Calendar, label: 'فعالیت‌ها' },
      { to: '/erp/crm/campaigns', icon: Megaphone, label: 'کمپین‌ها' },
      { to: '/erp/crm/sms', icon: MessageSquare, label: 'پیامک‌ها' },
    ],
  },
  {
    id: 'office',
    label: 'اداری',
    items: [
      { to: '/erp/office', icon: Inbox, label: 'میزکار اداری', end: true },
      { to: '/erp/office/correspondence', icon: Mail, label: 'نامه‌ها' },
      { to: '/erp/office/contracts', icon: FileSignature, label: 'قراردادها' },
    ],
  },
  {
    id: 'notifications',
    label: 'اعلانات',
    items: [
      { to: '/erp/notifications', icon: Bell, label: 'اعلانات' },
    ],
  },
  {
    id: 'settings',
    label: 'تنظیمات',
    items: [
      { to: '/erp/settings', icon: Settings, label: 'تنظیمات' },
    ],
  },
]
