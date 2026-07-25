/**
 * Nexivo ERP Mobile - Dashboard Screen
 * Phase 17: Mobile App (React Native)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { useAuthStore } from '../store/authStore'
import { api } from '../api/client'

const { width } = Dimensions.get('window')

interface DashboardMetric {
  label: string
  value: string
  change: number
  icon: string
}

interface RecentAlert {
  id: number
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  module: string
  created_at: string
}

export default function DashboardScreen() {
  const { user, logout } = useAuthStore()
  const [refreshing, setRefreshing] = useState(false)
  const [metrics, setMetrics] = useState<DashboardMetric[]>([])
  const [alerts, setAlerts] = useState<RecentAlert[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, alertRes] = await Promise.allSettled([
        api.getDashboard(),
        api.getAlerts({ is_read: false }),
      ])

      if (dashRes.status === 'fulfilled') {
        const data = dashRes.value.data
        setMetrics([
          { label: 'Total Revenue', value: `$${(data.total_revenue || 0).toLocaleString()}`, change: data.revenue_change || 0, icon: '💰' },
          { label: 'Active Orders', value: String(data.active_orders || 0), change: data.orders_change || 0, icon: '📦' },
          { label: 'Products', value: String(data.total_products || 0), change: 0, icon: '🏷️' },
          { label: 'Customers', value: String(data.total_customers || 0), change: 0, icon: '👥' },
        ])
      }

      if (alertRes.status === 'fulfilled') {
        const alertData = alertRes.value.data
        const alertList = Array.isArray(alertData) ? alertData : alertData.results || []
        setAlerts(alertList.slice(0, 5))
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchDashboard()
    setRefreshing(false)
  }, [fetchDashboard])

  const handleLogout = async () => {
    await logout()
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#dc2626'
      case 'high': return '#f97316'
      case 'medium': return '#eab308'
      case 'low': return '#22c55e'
      default: return '#6b7280'
    }
  }

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return '#fef2f2'
      case 'high': return '#fff7ed'
      case 'medium': return '#fefce8'
      case 'low': return '#f0fdf4'
      default: return '#f9fafb'
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#6366f1']} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.username || 'User'} 👋</Text>
          <Text style={styles.subtitle}>Here's your business overview</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Grid */}
      <View style={styles.metricsGrid}>
        {metrics.map((metric, index) => (
          <TouchableOpacity key={index} style={styles.metricCard}>
            <Text style={styles.metricIcon}>{metric.icon}</Text>
            <Text style={styles.metricValue}>{metric.value}</Text>
            <Text style={styles.metricLabel}>{metric.label}</Text>
            {metric.change !== 0 && (
              <Text style={[styles.metricChange, { color: metric.change > 0 ? '#22c55e' : '#dc2626' }]}>
                {metric.change > 0 ? '↑' : '↓'} {Math.abs(metric.change)}%
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          {[
            { label: 'Invoices', icon: '📄', screen: 'Invoices' },
            { label: 'Orders', icon: '🛒', screen: 'Orders' },
            { label: 'Inventory', icon: '📦', screen: 'Inventory' },
            { label: 'Reports', icon: '📊', screen: 'Reports' },
          ].map((action, index) => (
            <TouchableOpacity key={index} style={styles.actionCard}>
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          {alerts.map((alert) => (
            <TouchableOpacity
              key={alert.id}
              style={[styles.alertCard, { backgroundColor: getSeverityBg(alert.severity) }]}
            >
              <View style={[styles.alertDot, { backgroundColor: getSeverityColor(alert.severity) }]} />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.alertMeta}>{alert.module} • {new Date(alert.created_at).toLocaleDateString()}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Module Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Modules</Text>
        <View style={styles.modulesGrid}>
          {[
            { name: 'Finance', status: 'active', color: '#22c55e' },
            { name: 'Sales', status: 'active', color: '#22c55e' },
            { name: 'Inventory', status: 'active', color: '#22c55e' },
            { name: 'HR', status: 'active', color: '#22c55e' },
            { name: 'CRM', status: 'active', color: '#22c55e' },
            { name: 'AI Insights', status: 'active', color: '#6366f1' },
          ].map((module, index) => (
            <View key={index} style={styles.moduleChip}>
              <View style={[styles.moduleDot, { backgroundColor: module.color }]} />
              <Text style={styles.moduleName}>{module.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6b7280',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    gap: 12,
  },
  metricCard: {
    width: (width - 36) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  metricLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  metricChange: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    width: (width - 52) / 2,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  alertMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  modulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moduleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  moduleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  moduleName: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
})
