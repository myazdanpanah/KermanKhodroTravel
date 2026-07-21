import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Card, Row, Col, Statistic,
  message, Popconfirm
} from 'antd'
import {
  CheckCircleOutlined, ClockCircleOutlined,
  ReloadOutlined, InboxOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface GoodsReceipt {
  id: number
  receipt_number: string
  purchase_order: number
  purchase_order_number: string
  supplier_name: string
  status: 'draft' | 'received' | 'inspected' | 'accepted'
  total_amount: number
  items_count: number
  received_at: string
  notes: string
}

export default function GoodsReceiptsPage() {
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ draft: 0, received: 0, accepted: 0 })

  const fetchReceipts = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/purchasing/goods-receipts/')
      setReceipts(data.results || data)
      const items = data.results || data
      setStats({
        draft: items.filter((r: GoodsReceipt) => r.status === 'draft').length,
        received: items.filter((r: GoodsReceipt) => r.status === 'received').length,
        accepted: items.filter((r: GoodsReceipt) => r.status === 'accepted').length,
      })
    } catch {
      message.error('Failed to load goods receipts')
    }
    setLoading(false)
  }

  useEffect(() => { fetchReceipts() }, [])

  const handleAccept = async (id: number) => {
    try {
      await api.post(`/purchasing/goods-receipts/${id}/accept/`)
      message.success('Goods receipt accepted')
      fetchReceipts()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to accept receipt')
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'default',
    received: 'processing',
    inspected: 'warning',
    accepted: 'success',
  }

  const statusLabels: Record<string, string> = {
    draft: 'پیش‌نویس',
    received: 'دریافت شده',
    inspected: 'بازرسی شده',
    accepted: 'پذیرفته شده',
  }

  const columns: ColumnsType<GoodsReceipt> = [
    {
      title: 'شماره رسید',
      dataIndex: 'receipt_number',
      key: 'receipt_number',
      render: (v) => <div className="font-mono font-medium">{v}</div>,
    },
    {
      title: 'سفارش خرید',
      key: 'po',
      render: (_, r) => r.purchase_order_number || `#${r.purchase_order}`,
    },
    {
      title: 'تأمین‌کننده',
      dataIndex: 'supplier_name',
      key: 'supplier_name',
    },
    {
      title: 'تعداد اقلام',
      dataIndex: 'items_count',
      key: 'items_count',
      render: (v) => v || '—',
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (v) => v ? `${v.toLocaleString('fa-IR')} ریال` : '—',
    },
    {
      title: 'وضعیت',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: 'تاریخ دریافت',
      dataIndex: 'received_at',
      key: 'received_at',
      render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—',
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'inspected' && (
            <Popconfirm
              title="آیا از پذیرش این رسید اطمینان دارید؟"
              onConfirm={() => handleAccept(r.id)}
            >
              <Button type="link" icon={<CheckCircleOutlined />}>
                پذیرش
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">رسیدهای دریافت کالا</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchReceipts}>بروزرسانی</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="پیش‌نویس"
              value={stats.draft}
              valueStyle={{ color: '#8c8c8c' }}
              prefix={<InboxOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="دریافت شده"
              value={stats.received}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="پذیرفته شده"
              value={stats.accepted}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={receipts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'داده‌ای یافت نشد' }}
        />
      </Card>
    </div>
  )
}
