import { useEffect, useState } from 'react'
import { Table, Button, Space, Tag, message, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface ImportOrder { id: number; order_number: string; supplier_name: string; product_name: string; quantity: number; total_price_irr: number; status: string; foreign_currency: string; }

const statusColors: Record<string, string> = { draft: 'default', confirmed: 'processing', shipped: 'blue', customs_pending: 'orange', customs_cleared: 'green', warehouse_received: 'cyan', completed: 'success', cancelled: 'error' }
const statusLabels: Record<string, string> = { draft: 'پیش‌نویس', confirmed: 'تأیید شده', shipped: 'ارسال شده', customs_pending: 'در انتظار گمرک', customs_cleared: 'گمرک ترخیص', warehouse_received: 'دریافت انبار', completed: 'تکمیل', cancelled: 'لغو' }

export default function ImportsPage() {
  const [orders, setOrders] = useState<ImportOrder[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/trading/imports/'); setOrders(data.results || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  const act = async (id: number, action: string, extra: any = {}) => {
    try { await api.post(`/trading/imports/${id}/${action}/`, extra); message.success('انجام شد'); fetch() }
    catch (err: any) { message.error(err.response?.data?.detail || 'خطا') }
  }

  const columns = [
    { title: 'شماره', dataIndex: 'order_number', render: (v: string) => <span className="font-mono font-medium">{v}</span> },
    { title: 'تأمین‌کننده', dataIndex: 'supplier_name' },
    { title: 'محصول', dataIndex: 'product_name' },
    { title: 'مبلغ (IRR)', dataIndex: 'total_price_irr', render: (v: number) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'وضعیت', dataIndex: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: 'عملیات', key: 'a', render: (_: any, r: ImportOrder) => (
      <Space>
        {r.status === 'draft' && <Button type="link" onClick={() => act(r.id, 'confirm')}>تأیید</Button>}
        {r.status === 'confirmed' && <Button type="link" onClick={() => act(r.id, 'ship')}>ارسال</Button>}
        {r.status === 'shipped' && <Button type="link" onClick={() => act(r.id, 'clear_customs', { declaration_number: 'CD-' + r.id })}>ترخیص گمرک</Button>}
        {r.status === 'customs_cleared' && <Button type="link" onClick={() => act(r.id, 'receive')}>دریافت انبار</Button>}
        {r.status === 'warehouse_received' && <Button type="link" onClick={() => act(r.id, 'complete')}>تکمیل</Button>}
      </Space>
    )},
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">واردات</h1><Button icon={<ReloadOutlined />} onClick={fetch}>بروزرسانی</Button></div>
      <Card><Table columns={columns} dataSource={orders} rowKey="id" loading={loading} /></Card>
    </div>
  )
}
