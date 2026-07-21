import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Card,
  message, Popconfirm
} from 'antd'
import {
  ReloadOutlined, SendOutlined, ArrowLeftOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface SalesQuotation {
  id: number
  quotation_number: string
  customer_name: string
  quotation_date: string
  valid_until: string
  total: number
  status: string
}

const statusColors: Record<string, string> = {
  draft: 'default', sent: 'processing', approved: 'success',
  rejected: 'error', expired: 'warning', converted: 'success',
}
const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس', sent: 'ارسال شده', approved: 'تأیید شده',
  rejected: 'رد شده', expired: 'منقضی شده', converted: 'تبدیل شده',
}

export default function SalesQuotationsPage() {
  const [quotations, setQuotations] = useState<SalesQuotation[]>([])
  const [loading, setLoading] = useState(false)

  const fetchQuotations = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/sales/quotations/')
      setQuotations(data.results || data)
    } catch { message.error('خطا در بارگذاری پیش‌فاکتورها') }
    setLoading(false)
  }

  useEffect(() => { fetchQuotations() }, [])

  const handleSend = async (id: number) => {
    try {
      await api.post(`/sales/quotations/${id}/send/`)
      message.success('پیش‌فاکتور ارسال شد')
      fetchQuotations()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا') }
  }

  const handleConvert = async (id: number) => {
    try {
      await api.post(`/sales/quotations/${id}/convert_to_order/`)
      message.success('پیش‌فاکتور به سفارش فروش تبدیل شد')
      fetchQuotations()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا در تبدیل') }
  }

  const columns: ColumnsType<SalesQuotation> = [
    { title: 'شماره', dataIndex: 'quotation_number', render: (v) => <span className="font-mono font-medium">{v}</span> },
    { title: 'مشتری', dataIndex: 'customer_name' },
    { title: 'تاریخ', dataIndex: 'quotation_date', render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—' },
    { title: ' اعتبار تا', dataIndex: 'valid_until', render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—' },
    { title: 'مبلغ کل', dataIndex: 'total', render: (v) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'عملیات', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && (
            <Button type="link" icon={<SendOutlined />} onClick={() => handleSend(r.id)}>ارسال</Button>
          )}
          {!['converted', 'rejected', 'expired'].includes(r.status) && (
            <Popconfirm title="آیا از تبدیل به سفارش فروش اطمینان دارید؟" onConfirm={() => handleConvert(r.id)}>
              <Button type="link" icon={<ArrowLeftOutlined />}>تبدیل به سفارش</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">پیش‌فاکتورها</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchQuotations}>بروزرسانی</Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={quotations} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  )
}
