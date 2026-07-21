import { useEffect, useState } from 'react'
import { Table, Button, Tag, message, Card } from 'antd'
import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import api from '../../api/client'

interface BOM { id: number; number: string; product_name: string; version: number; status: string; }

export default function BOMsPage() {
  const [boms, setBoms] = useState<BOM[]>([])
  const [loading, setLoading] = useState(false)

  const fetchBoms = async () => {
    setLoading(true)
    try { const { data } = await api.get('/manufacturing/boms/'); setBoms(data.data || data) }
    catch { message.error('خطا در بارگذاری') }
    setLoading(false)
  }

  useEffect(() => { fetchBoms() }, [])

  const handleApprove = async (id: number) => {
    try { await api.post(`/manufacturing/boms/${id}/approve/`); message.success('BOM تأیید شد'); fetchBoms() }
    catch (err: any) { message.error(err.response?.data?.message || 'خطا') }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">لیست مواد (BOM)</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchBoms}>بروزرسانی</Button>
      </div>
      <Card>
        <Table
          dataSource={boms} rowKey="id" loading={loading}
          columns={[
            { title: 'شماره', dataIndex: 'number', render: (v) => <span className="font-mono">{v}</span> },
            { title: 'محصول', dataIndex: 'product_name' },
            { title: 'نسخه', dataIndex: 'version', render: (v) => `v${v}` },
            { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={s === 'active' ? 'success' : s === 'draft' ? 'default' : 'error'}>{s}</Tag> },
            { title: 'عملیات', key: 'a', render: (_, r) => r.status === 'draft' ? <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleApprove(r.id)}>تأیید</Button> : null },
          ]}
        />
      </Card>
    </div>
  )
}
