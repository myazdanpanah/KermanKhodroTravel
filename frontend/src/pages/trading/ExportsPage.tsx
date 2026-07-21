import { useEffect, useState } from 'react'
import { Table, Button, Space, Tag, message, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface ExportOrder { id: number; order_number: string; customer_name: string; product_name: string; total_price_irr: number; status: string; }

const statusColors: Record<string, string> = { draft: 'default', confirmed: 'processing', documentation: 'blue', shipped: 'cyan', invoiced: 'orange', completed: 'success', cancelled: 'error' }
const statusLabels: Record<string, string> = { draft: 'پیش‌نویس', confirmed: 'تأیید شده', documentation: 'مدارک', shipped: 'ارسال شده', invoiced: 'فاکتور شده', completed: 'تکمیل', cancelled: 'لغو' }

export default function ExportsPage() {
  const [orders, setOrders] = useState<ExportOrder[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/trading/exports/'); setOrders(data.results || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  const act = async (id: number, action: string) => {
    try { await api.post(`/trading/exports/${id}/${action}/`); message.success('انجام شد'); fetch() }
    catch (err: any) { message.error(err.response?.data?.detail || 'خطا') }
  }

  const columns = [
    { title: 'شماره', dataIndex: 'order_number', render: (v: string) => <span className="font-mono font-medium">{v}</span> },
    { title: 'مشتری', dataIndex: 'customer_name' },
    { title: 'محصول', dataIndex: 'product_name' },
    { title: 'مبلغ', dataIndex: 'total_price_irr', render: (v: number) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'وضعیت', dataIndex: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: 'عملیات', key: 'a', render: (_: any, r: ExportOrder) => (
      <Space>
        {r.status === 'draft' && <Button type="link" onClick={() => act(r.id, 'confirm')}>تأیید</Button>}
        {r.status === 'confirmed' && <Button type="link" onClick={() => act(r.id, 'ship')}>ارسال</Button>}
      </Space>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">صادرات</h1><Button icon={<ReloadOutlined />} onClick={fetch}>بروزرسانی</Button></div>
      <Card><Table columns={columns} dataSource={orders} rowKey="id" loading={loading} /></Card>
    </div>
  )
}
