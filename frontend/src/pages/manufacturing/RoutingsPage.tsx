import { useEffect, useState } from 'react'
import { Table, Button, Tag, message, Card } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface Routing { id: number; number: string; name: string; version: number; status: string; estimated_hours: string; }

export default function RoutingsPage() {
  const [routings, setRoutings] = useState<Routing[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/manufacturing/routings/'); setRoutings(data.data || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center"><h1 className="text-2xl font-bold">مسیر تولید (Routing)</h1><Button icon={<ReloadOutlined />} onClick={fetch}>بروزرسانی</Button></div>
      <Card>
        <Table
          dataSource={routings} rowKey="id" loading={loading}
          columns={[
            { title: 'شماره', dataIndex: 'number', render: (v: string) => <span className="font-mono">{v}</span> },
            { title: 'نام', dataIndex: 'name' },
            { title: 'نسخه', dataIndex: 'version', render: (v: number) => `v${v}` },
            { title: 'زمان تخمینی (ساعت)', dataIndex: 'estimated_hours' },
            { title: 'وضعیت', dataIndex: 'status', render: (s: string) => <Tag color={s === 'active' ? 'success' : 'default'}>{s}</Tag> },
          ]}
        />
      </Card>
    </div>
  )
}
