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

/**
 * Dynamically filter navigation sections based on:
 * 1. Organization module entitlements (accessible_modules)
 * 2. User role and granular permission flags
 */
export function getFilteredNavSections(user: any): NavSection[] {
  if (!user) return []

  const isSuperUser = Boolean(user.is_superuser)
  const isSysAdmin = user.role === 'admin' || isSuperUser
  const isCeo = user.role === 'ceo'
  const isFinanceRole = user.role === 'finance'
  const isSalesRole = user.role === 'sales' || user.department === 'sales'

  // Organization-level module entitlements
  const accessibleModules: string[] = user.accessible_modules || []
  const hasModule = (slug: string) =>
    isSysAdmin || accessibleModules.includes(slug)

  const hasFinanceModule = hasModule('finance') || hasModule('billing')
  const hasCrmModule = hasModule('crm')
  const hasOfficeModule = hasModule('office')
  const hasBiModule = hasModule('bi_dashboard') || hasModule('bi')

  // User-level permission checks
  const canViewFinance =
    hasFinanceModule &&
    (isSysAdmin || isCeo || isFinanceRole || Boolean(user.permissions?.view))
  const canIssue =
    hasFinanceModule &&
    (isSysAdmin || isCeo || Boolean(user.permissions?.issue))
  const canManageFinanceSettings =
    hasFinanceModule &&
    (isSysAdmin || isCeo || Boolean(user.permissions?.manage_settings))

  const canAccessCrm =
    hasCrmModule &&
    (isSysAdmin || isCeo || isSalesRole || Boolean(user.permissions?.crm))
  const canAccessOffice = hasOfficeModule
  const canAccessManagement =
    (isSysAdmin || isCeo || (canViewFinance && isFinanceRole)) &&
    (hasBiModule || isSysAdmin || isCeo)
  const canAccessSettings = isSysAdmin

  const sections: NavSection[] = []

  // 1. BI / Executive Management Dashboard
  if (canAccessManagement) {
    sections.push({
      id: 'bi',
      label: 'داشبورد',
      items: [
        { to: '/erp/management', icon: PieChart, label: 'داشبورد مدیریتی', end: true },
      ],
    })
  }

  // 2. Finance
  if (canViewFinance) {
    const financeItems: NavItem[] = [
      { to: '/erp/billing', icon: LayoutDashboard, label: 'داشبورد مالی', end: true },
    ]
    if (canIssue) {
      financeItems.push({ to: '/erp/billing/issue', icon: Plus, label: 'صدور صورت‌حساب' })
    }
    financeItems.push(
      { to: '/erp/billing/invoices', icon: FileText, label: 'صورت‌حساب‌ها' },
      { to: '/erp/billing/payments', icon: CreditCard, label: 'پرداخت‌ها' },
      { to: '/erp/billing/performance', icon: Gauge, label: 'عملکرد' },
      { to: '/erp/billing/payers', icon: Users, label: 'مشتریان' }
    )
    if (canManageFinanceSettings) {
      financeItems.push({ to: '/erp/billing/services', icon: Briefcase, label: 'خدمات' })
    }
    sections.push({
      id: 'finance',
      label: 'مالی',
      items: financeItems,
    })
  }

  // 3. CRM
  if (canAccessCrm) {
    sections.push({
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
    })
  }

  // 4. Office
  if (canAccessOffice) {
    sections.push({
      id: 'office',
      label: 'اداری',
      items: [
        { to: '/erp/office', icon: Inbox, label: 'میزکار اداری', end: true },
        { to: '/erp/office/correspondence', icon: Mail, label: 'نامه‌ها' },
        { to: '/erp/office/contracts', icon: FileSignature, label: 'قراردادها' },
      ],
    })
  }

  // 5. Notifications (General for all authenticated users)
  sections.push({
    id: 'notifications',
    label: 'اعلانات',
    items: [
      { to: '/erp/notifications', icon: Bell, label: 'اعلانات' },
    ],
  })

  // 6. Settings (Exclusively System Admin)
  if (canAccessSettings) {
    sections.push({
      id: 'settings',
      label: 'تنظیمات',
      items: [
        { to: '/erp/settings', icon: Settings, label: 'تنظیمات' },
      ],
    })
  }

  return sections
}

/**
 * Determine the user's default/primary ERP landing page so they land on an authorized dashboard
 * instead of an unauthorized section that throws a 403 error.
 */
export function getDefaultERPPath(user: any): string {
  const sections = getFilteredNavSections(user)

  // 1. If user can see Management dashboard, default to /erp/management
  const biSection = sections.find((s) => s.id === 'bi')
  if (biSection && biSection.items.length > 0) {
    return biSection.items[0].to
  }

  // 2. If user can see Finance, default to /erp/billing
  const financeSection = sections.find((s) => s.id === 'finance')
  if (financeSection && financeSection.items.length > 0) {
    return financeSection.items[0].to
  }

  // 3. If user can see CRM, default to /erp/crm
  const crmSection = sections.find((s) => s.id === 'crm')
  if (crmSection && crmSection.items.length > 0) {
    return crmSection.items[0].to
  }

  // 4. If user can see Office, default to /erp/office
  const officeSection = sections.find((s) => s.id === 'office')
  if (officeSection && officeSection.items.length > 0) {
    return officeSection.items[0].to
  }

  // 5. First item of any available section, or /launcher
  if (sections.length > 0 && sections[0].items.length > 0) {
    return sections[0].items[0].to
  }

  return '/launcher'
}

/**
 * Check whether a user is permitted to navigate to a specific ERP path.
 */
export function canUserAccessERPPath(user: any, path: string): boolean {
  if (!user) return false
  const cleanPath = path.replace(/\/$/, '')
  if (cleanPath === '/erp/profile' || cleanPath === '/erp/notifications') return true

  const sections = getFilteredNavSections(user)
  for (const section of sections) {
    for (const item of section.items) {
      if (item.end ? cleanPath === item.to : cleanPath.startsWith(item.to)) {
        return true
      }
    }
  }
  return false
}
