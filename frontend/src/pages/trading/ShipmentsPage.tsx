import { useEffect, useState } from 'react'
import { Table, Button, Tag, message, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface Shipment { id: number; shipment_number: string; shipment_type: string; status: string; origin: string; destination: string; total_cost: number; cost_currency: string; }

const statusColors: Record<string, string> = { preparing: 'default', picked_up: 'blue', in_transit: 'processing', at_port: 'orange', delivered: 'success', cancelled: 'error' }
const typeLabels: Record<string, string> = { sea: 'دریایی', air: 'هوایی', land: 'زمینی', rail: 'ریلی', multimodal: 'چندوجهی' }

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/trading/shipments/'); setShipments(data.results || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  const columns = [
    { title: 'شماره', dataIndex: 'shipment_number', render: (v: string) => <span className="font-mono font-medium">{v}</span> },
    { title: 'نوع', dataIndex: 'shipment_type', render: (v: string) => typeLabels[v] || v },
    { title: 'وضعیت', dataIndex: 'status', render: (s: string) => <Tag color={statusColors[s]}>{s}</Tag> },
    { title: 'مبدأ', dataIndex: 'origin' },
    { title: 'مقصد', dataIndex: 'destination' },
    { title: 'هزینه', dataIndex: 'total_cost', render: (v: number, r: Shipment) => v ? `${v.toLocaleString('fa-IR')} ${r.cost_currency}` : '—' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">حمل و نقل</h1><Button icon={<ReloadOutlined />} onClick={fetch}>بروزرسانی</Button></div>
      <Card><Table columns={columns} dataSource={shipments} rowKey="id" loading={loading} /></Card>
    </div>
  )
}
