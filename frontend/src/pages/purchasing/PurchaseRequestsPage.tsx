import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Select, message, Card, Row, Col, Statistic
} from 'antd'
import {
  PlusOutlined, SendOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ReloadOutlined, FileTextOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface PurchaseRequest {
  id: number
  title: string
  description: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  requested_by_name: string
  total: number
  currency: string
  items: any[]
  created_at: string
}

export default function PurchaseRequestsPage() {
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [stats, setStats] = useState({ draft: 0, submitted: 0, approved: 0 })

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/purchasing/requests/')
      setRequests(data.results || data)
      const items = data.results || data
      setStats({
        draft: items.filter((r: PurchaseRequest) => r.status === 'draft').length,
        submitted: items.filter((r: PurchaseRequest) => r.status === 'submitted').length,
        approved: items.filter((r: PurchaseRequest) => r.status === 'approved').length,
      })
    } catch {
      message.error('Failed to load purchase requests')
    }
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [])

  const handleCreate = async (values: any) => {
    try {
      await api.post('/purchasing/requests/', {
        ...values,
        items: values.items || [],
      })
      message.success('Purchase request created')
      setModalOpen(false)
      form.resetFields()
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to create purchase request')
    }
  }

  const handleSubmit = async (id: number) => {
    try {
      await api.post(`/purchasing/requests/${id}/submit/`)
      message.success('Request submitted for approval')
      fetchRequests()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to submit request')
    }
  }

  const statusColors: Record<string, string> = {
    draft: 'default',
    submitted: 'processing',
    approved: 'success',
    rejected: 'error',
    ordered: 'success',
  }

  const statusLabels: Record<string, string> = {
    draft: 'پیش‌نویس',
    submitted: 'ارسال شده',
    approved: 'تأیید شده',
    rejected: 'رد شده',
    ordered: 'سفارش داده شده',
  }

  const priorityColors: Record<string, string> = {
    low: 'default',
    normal: 'blue',
    high: 'orange',
    urgent: 'red',
  }

  const priorityLabels: Record<string, string> = {
    low: 'کم',
    normal: 'عادی',
    high: 'زیاد',
    urgent: 'فوری',
  }

  const columns: ColumnsType<PurchaseRequest> = [
    {
      title: 'شماره',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: 'عنوان',
      dataIndex: 'title',
      key: 'title',
      render: (v) => <div className="font-medium">{v}</div>,
    },
    {
      title: 'درخواست‌کننده',
      dataIndex: 'requested_by_name',
      key: 'requested_by_name',
    },
    {
      title: 'اولویت',
      dataIndex: 'priority',
      key: 'priority',
      render: (p) => (
        <Tag color={priorityColors[p]}>{priorityLabels[p]}</Tag>
      ),
    },
    {
      title: 'مبلغ کل',
      dataIndex: 'total',
      key: 'total',
      render: (v, r) => v ? `${v.toLocaleString('fa-IR')} ${r.currency || 'IRR'}` : '—',
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
      title: 'تاریخ ایجاد',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (v) => new Date(v).toLocaleDateString('fa-IR'),
    },
    {
      title: 'عملیات',
      key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && (
            <Button
              type="link"
              icon={<SendOutlined />}
              onClick={() => handleSubmit(r.id)}
            >
              ارسال
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">درخواست‌های خرید</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRequests}>بروزرسانی</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            درخواست جدید
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="پیش‌نویس"
              value={stats.draft}
              valueStyle={{ color: '#8c8c8c' }}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="ارسال شده"
              value={stats.submitted}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="تأیید شده"
              value={stats.approved}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'داده‌ای یافت نشد' }}
        />
      </Card>

      <Modal
        title="درخواست خرید جدید"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="عنوان" rules={[{ required: true }]}>
            <Input placeholder="عنوان درخواست" />
          </Form.Item>
          <Form.Item name="description" label="توضیحات">
            <Input.TextArea rows={3} placeholder="توضیحات درخواست" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="priority" label="اولویت" initialValue="normal">
                <Select>
                  <Select.Option value="low">کم</Select.Option>
                  <Select.Option value="normal">عادی</Select.Option>
                  <Select.Option value="high">زیاد</Select.Option>
                  <Select.Option value="urgent">فوری</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="currency" label="ارز" initialValue="IRR">
                <Select>
                  <Select.Option value="IRR">ریال ایران</Select.Option>
                  <Select.Option value="USD">دلار</Select.Option>
                  <Select.Option value="EUR">یورو</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>انصراف</Button>
            <Button type="primary" htmlType="submit">ایجاد درخواست</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
