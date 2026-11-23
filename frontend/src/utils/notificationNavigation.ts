export interface NotificationTarget {
  id?: number | string
  type?: string
  notification_type?: string
  target_type?: string
  target_id?: string | number | null
}

export interface NavigationRoute {
  pathname: string
  search?: string
}

/**
 * Resolves the target route for an in-app notification.
 * Handles all system domains: Billing, Office Automation, Dashboards, Orbit Messaging, Datasets, etc.
 */
export function resolveNotificationRoute(n: NotificationTarget): NavigationRoute | null {
  const targetType = (n.target_type || n.notification_type || n.type || '').trim().toLowerCase()
  const targetId = n.target_id !== undefined && n.target_id !== null ? String(n.target_id).trim() : ''

  // Billing requests
  if (targetType === 'billing_request' || targetType === 'billing_approval') {
    return {
      pathname: '/erp/billing/issue',
      search: targetId ? `request=${encodeURIComponent(targetId)}` : undefined,
    }
  }

  // Office correspondence / letters
  if (
    targetType === 'office_correspondence' ||
    targetType === 'correspondence' ||
    targetType === 'letter' ||
    targetType === 'office_letter'
  ) {
    return {
      pathname: targetId ? `/erp/office/correspondence/${targetId}` : '/erp/office/correspondence',
    }
  }

  // Dashboards & assignments
  if (
    targetType === 'dashboard' ||
    targetType === 'assignment' ||
    targetType.startsWith('assignment_') ||
    targetType === 'bulk_assignment'
  ) {
    return {
      pathname: targetId ? `/dashboards/${targetId}` : '/dashboards',
    }
  }

  // Orbit Messaging / Chat / Announcements
  if (
    targetType === 'messaging' ||
    targetType === 'message' ||
    targetType === 'new_message' ||
    targetType === 'conversation' ||
    targetType === 'orbit' ||
    targetType === 'channel'
  ) {
    return {
      pathname: targetId ? `/orbit/${targetId}` : '/orbit',
    }
  }

  // Invoices & Payments
  if (targetType === 'billing_invoice' || targetType === 'invoice') {
    return {
      pathname: '/erp/billing/invoices',
      search: targetId ? `id=${encodeURIComponent(targetId)}` : undefined,
    }
  }

  if (targetType === 'billing_payment' || targetType === 'payment') {
    return {
      pathname: '/erp/billing/payments',
      search: targetId ? `id=${encodeURIComponent(targetId)}` : undefined,
    }
  }

  // Datasets
  if (targetType === 'dataset') {
    return {
      pathname: targetId ? `/datasets/${targetId}` : '/datasets',
    }
  }

  // Office contracts
  if (targetType === 'office_contract' || targetType === 'contract') {
    return {
      pathname: '/erp/office/contracts',
    }
  }

  return null
}
