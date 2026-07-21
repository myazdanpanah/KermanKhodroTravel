import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag,
  message, Card
} from 'antd'
import {
  CheckCircleOutlined, PlayCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface ProductionOrder {
  id: number; number: string; product_name: string; quantity: number;
  status: string; priority: number; material_cost: number; total_cost: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  draft: 'default', approved: 'processing', released: 'processing',
  started: 'warning', paused: 'error', completed: 'success', cancelled: 'error',
}
const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس', approved: 'تأیید شده', released: 'آزاد شده',
  started: 'شروع شده', paused: 'متوقف', completed: 'تکمیل شده', cancelled: 'لغو شده',
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(false)

  const fetchOrders = async () => {
    setLoading(true)
    try { const { data } = await api.get('/manufacturing/production-orders/'); setOrders(data.data || data) }
    catch { message.error('خطا در بارگذاری') }
    setLoading(false)
  }

  useEffect(() => { fetchOrders() }, [])

  const handleAction = async (id: number, action: string) => {
    try {
      await api.post(`/manufacturing/production-orders/${id}/${action}/`)
      message.success('عملیات با موفقیت انجام شد')
      fetchOrders()
    } catch (err: any) { message.error(err.response?.data?.message || 'خطا') }
  }

  const columns: ColumnsType<ProductionOrder> = [
    { title: 'شماره', dataIndex: 'number', render: (v) => <span className="font-mono font-medium">{v}</span> },
    { title: 'محصول', dataIndex: 'product_name' },
    { title: 'تعداد', dataIndex: 'quantity', render: (v) => v?.toLocaleString('fa-IR') },
    { title: 'هزینه کل', dataIndex: 'total_cost', render: (v) => v ? `${v.toLocaleString('fa-IR')} ریال` : '—' },
    { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'عملیات', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleAction(r.id, 'approve')}>تأیید</Button>}
          {(r.status === 'approved' || r.status === 'released') && <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleAction(r.id, 'start')}>شروع</Button>}
          {r.status === 'started' && <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleAction(r.id, 'complete')}>تکمیل</Button>}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">دستورات تولید</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchOrders}>بروزرسانی</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={orders} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}
