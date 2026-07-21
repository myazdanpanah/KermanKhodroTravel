import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Card,
  message, Popconfirm
} from 'antd'
import {
  ReloadOutlined, CheckCircleOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface SalesReturn {
  id: number
  return_number: string
  customer_name: string
  return_date: string
  total_amount: number
  net_amount: number
  status: string
  reason: string
}

const statusColors: Record<string, string> = {
  draft: 'default', received: 'processing', approved: 'success',
  credited: 'success', cancelled: 'error',
}
const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس', received: 'دریافت شده', approved: 'تأیید شده',
  credited: 'اعتبارنامه صادر شده', cancelled: 'لغو شده',
}

export default function SalesReturnsPage() {
  const [returns, setReturns] = useState<SalesReturn[]>([])
  const [loading, setLoading] = useState(false)

  const fetchReturns = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/sales/returns/')
      setReturns(data.results || data)
    } catch { message.error('خطا در بارگذاری برگشتی‌ها') }
    setLoading(false)
  }

  useEffect(() => { fetchReturns() }, [])

  const handleReceive = async (id: number) => {
    try {
      await api.post(`/sales/returns/${id}/receive/`)
      message.success('برگشت دریافت شد')
      fetchReturns()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا') }
  }

  const columns: ColumnsType<SalesReturn> = [
    { title: 'شماره', dataIndex: 'return_number', render: (v) => <span className="font-mono font-medium">{v}</span> },
    { title: 'مشتری', dataIndex: 'customer_name' },
    { title: 'تاریخ', dataIndex: 'return_date', render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—' },
    { title: 'مبلغ کل', dataIndex: 'total_amount', render: (v) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'مبلغ خالص', dataIndex: 'net_amount', render: (v) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: 'دلیل', dataIndex: 'reason', render: (v) => v || '—' },
    {
      title: 'عملیات', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && (
            <Popconfirm title="آیا از دریافت کالا اطمینان دارید؟" onConfirm={() => handleReceive(r.id)}>
              <Button type="link" icon={<CheckCircleOutlined />}>دریافت</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">برگشت از فروش</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchReturns}>بروزرسانی</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={returns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}
