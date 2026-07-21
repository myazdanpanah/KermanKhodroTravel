import { useEffect, useState } from 'react'
import { Table, Button, Tag, message, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface Container { id: number; container_number: string; container_type: string; status: string; carrier: string; vessel_name: string; current_location: string; }

const statusColors: Record<string, string> = { empty: 'default', loaded: 'blue', in_transit: 'processing', at_port: 'orange', customs: 'warning', delivered: 'success', returned: 'error' }
const statusLabels: Record<string, string> = { empty: 'خالی', loaded: 'بارگیری شده', in_transit: 'در حال حمل', at_port: 'در بندر', customs: 'گمرک', delivered: 'تحویل شده', returned: 'برگشتی' }

export default function ContainersPage() {
  const [containers, setContainers] = useState<Container[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/trading/containers/'); setContainers(data.results || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  const columns = [
    { title: 'شماره کانتینر', dataIndex: 'container_number', render: (v: string) => <span className="font-mono font-medium">{v}</span> },
    { title: 'نوع', dataIndex: 'container_type' },
    { title: 'وضعیت', dataIndex: 'status', render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    { title: 'شرکت حمل', dataIndex: 'carrier' },
    { title: 'کشتی', dataIndex: 'vessel_name' },
    { title: 'موقعیت', dataIndex: 'current_location' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">کانتینرها</h1><Button icon={<ReloadOutlined />} onClick={fetch}>بروزرسانی</Button></div>
      <Card><Table columns={columns} dataSource={containers} rowKey="id" loading={loading} /></Card>
    </div>
  )
}
