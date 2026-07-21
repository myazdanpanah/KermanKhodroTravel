import { useEffect, useState } from 'react'
import { Table, Tag, message, Card } from 'antd'
import api from '../../api/client'

interface WorkCenter { id: number; code: string; name: string; work_center_type: string; capacity: string; efficiency: string; hourly_cost: string; is_active: boolean; }

export default function WorkCentersPage() {
  const [centers, setCenters] = useState<WorkCenter[]>([])
  const [loading, setLoading] = useState(false)
  const fetch = async () => { setLoading(true); try { const { data } = await api.get('/manufacturing/work-centers/'); setCenters(data.data || data) } catch { message.error('خطا') } setLoading(false) }
  useEffect(() => { fetch() }, [])

  const typeLabels: Record<string, string> = { machine: 'ماشین', production_line: 'خط تولید', department: 'بخش', external_vendor: 'پیمانکار' }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">مراکز کار (Work Centers)</h1>
      <Card>
        <Table
          dataSource={centers} rowKey="id" loading={loading}
          columns={[
            { title: 'کد', dataIndex: 'code', render: (v: string) => <span className="font-mono font-medium">{v}</span> },
            { title: 'نام', dataIndex: 'name' },
            { title: 'نوع', dataIndex: 'work_center_type', render: (v: string) => typeLabels[v] || v },
            { title: 'ظرفیت', dataIndex: 'capacity', render: (v: string) => `${v} واحد/ساعت` },
            { title: 'بازدهی', dataIndex: 'efficiency', render: (v: string) => `${v}%` },
            { title: 'هزینه ساعتی', dataIndex: 'hourly_cost', render: (v: string) => v ? `${Number(v).toLocaleString('fa-IR')} ریال` : '—' },
            { title: 'وضعیت', dataIndex: 'is_active', render: (v: boolean) => <Tag color={v ? 'success' : 'error'}>{v ? 'فعال' : 'غیرفعال'}</Tag> },
          ]}
        />
      </Card>
    </div>
  )
}
