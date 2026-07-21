import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic, Table, Tag } from 'antd'
import {
  ShoppingCartOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import api from '../../api/client'

const statusColors: Record<string, string> = {
  draft: 'default',
  confirmed: 'processing',
  processing: 'processing',
  delivered: 'success',
  completed: 'success',
  cancelled: 'error',
  paid: 'success',
  partial: 'warning',
  overdue: 'error',
}

const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس',
  confirmed: 'تأیید شده',
  processing: 'در حال پردازش',
  delivered: 'تحویل شده',
  completed: 'تکمیل شده',
  cancelled: 'لغو شده',
  paid: 'پرداخت شده',
  partial: 'پرداخت جزئی',
  overdue: 'سررسید گذشته',
}

export default function SalesDashboard() {
  const [stats, setStats] = useState({
    total_orders: 0, draft: 0, confirmed: 0, processing: 0,
    delivered: 0, completed: 0, total_value: 0,
  })
  const [recentOrders, setRecentOrders] = useState<any[]>([])
  const [receivables, setReceivables] = useState({ outstanding_invoices: 0, balance: 0 })

  useEffect(() => {
    api.get('/sales/orders/summary/').then(({ data }) => setStats(data)).catch(() => {})
    api.get('/sales/orders/').then(({ data }) => setRecentOrders((data.results || data).slice(0, 5))).catch(() => {})
    api.get('/sales/invoices/receivables/').then(({ data }) => setReceivables(data)).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">داشبورد فروش</h1>

      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title="کل سفارشات" value={stats.total_orders} prefix={<ShoppingCartOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="در حال پردازش" value={stats.processing} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="تکمیل شده" value={stats.completed} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="مطالبات معوق" value={receivables.balance} prefix={<DollarOutlined />} valueStyle={{ color: '#faad14' }} suffix="ریال" /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="ارزش کل سفارشات">
            <Statistic value={stats.total_value} suffix="ریال" />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="صورتحساب‌های باز">
            <Statistic value={receivables.outstanding_invoices} suffix="مورد" />
          </Card>
        </Col>
      </Row>

      <Card title="آخرین سفارشات">
        <Table
          dataSource={recentOrders}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'شماره', dataIndex: 'order_number', key: 'order_number', render: (v: string) => <span className="font-mono">{v}</span> },
            { title: 'مشتری', key: 'customer', render: (_: any, r: any) => r.customer_name },
            { title: 'مبلغ', dataIndex: 'total', key: 'total', render: (v: number) => v?.toLocaleString('fa-IR') + ' ریال' },
            { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
          ]}
        />
      </Card>
    </div>
  )
}
