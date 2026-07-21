import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input, InputNumber,
  Select, message, Popconfirm, Card, Statistic, Row, Col, Tooltip
} from 'antd'
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, ReloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface Reservation {
  id: number
  product: { id: number; name: string; sku: string }
  warehouse: { id: number; name: string }
  quantity: number
  reserved_quantity: number
  status: 'active' | 'fulfilled' | 'cancelled'
  reference_type: string
  reference_id: number
  notes: string
  created_at: string
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [products, setProducts] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [stats, setStats] = useState({ active: 0, fulfilled: 0, cancelled: 0 })

  const fetchReservations = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/inventory/reservations/')
      setReservations(data.results || data)
      // Calculate stats
      const active = (data.results || data).filter((r: Reservation) => r.status === 'active').length
      const fulfilled = (data.results || data).filter((r: Reservation) => r.status === 'fulfilled').length
      const cancelled = (data.results || data).filter((r: Reservation) => r.status === 'cancelled').length
      setStats({ active, fulfilled, cancelled })
    } catch {
      message.error('Failed to load reservations')
    }
    setLoading(false)
  }

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/inventory/products/')
      setProducts(data.results || data)
    } catch {}
  }

  const fetchWarehouses = async () => {
    try {
      const { data } = await api.get('/inventory/warehouses/')
      setWarehouses(data.results || data)
    } catch {}
  }

  useEffect(() => {
    fetchReservations()
    fetchProducts()
    fetchWarehouses()
  }, [])

  const handleCreate = async (values: any) => {
    try {
      await api.post('/inventory/reservations/', {
        ...values,
        reserved_by: 1, // Current user
      })
      message.success('Reservation created')
      setModalOpen(false)
      form.resetFields()
      fetchReservations()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to create reservation')
    }
  }

  const handleFulfill = async (id: number) => {
    try {
      await api.post(`/inventory/reservations/${id}/fulfill/`)
      message.success('Reservation fulfilled')
      fetchReservations()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to fulfill reservation')
    }
  }

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/inventory/reservations/${id}/cancel/`)
      message.success('Reservation cancelled')
      fetchReservations()
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Failed to cancel reservation')
    }
  }

  const statusColors: Record<string, string> = {
    active: 'processing',
    fulfilled: 'success',
    cancelled: 'error',
  }

  const statusLabels: Record<string, string> = {
    active: 'فعال',
    fulfilled: 'تکمیل شده',
    cancelled: 'لغو شده',
  }

  const columns: ColumnsType<Reservation> = [
    {
      title: 'محصول',
      key: 'product',
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.product?.name}</div>
          <div className="text-gray-500 text-xs">{r.product?.sku}</div>
        </div>
      ),
    },
    {
      title: 'انبار',
      key: 'warehouse',
      render: (_, r) => r.warehouse?.name,
    },
    {
      title: 'تعداد',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (v) => v.toLocaleString('fa-IR'),
    },
    {
      title: 'رزرو شده',
      dataIndex: 'reserved_quantity',
      key: 'reserved_quantity',
      render: (v) => v.toLocaleString('fa-IR'),
    },
    {
      title: 'وضعیت',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={statusColors[status]}>
          {statusLabels[status]}
        </Tag>
      ),
    },
    {
      title: 'مرجع',
      key: 'reference',
      render: (_, r) => r.reference_type ? (
        <Tag>{r.reference_type} #{r.reference_id}</Tag>
      ) : '—',
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
          {r.status === 'active' && (
            <>
              <Tooltip title="تکمیل رزرو">
                <Button
                  type="link"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleFulfill(r.id)}
                >
                  تکمیل
                </Button>
              </Tooltip>
              <Popconfirm
                title="آیا از لغو این رزرو اطمینان دارید؟"
                onConfirm={() => handleCancel(r.id)}
              >
                <Button type="link" danger icon={<CloseCircleOutlined />}>
                  لغو
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">رزروهای موجودی</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchReservations}>
            بروزرسانی
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            رزرو جدید
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="رزروهای فعال"
              value={stats.active}
              valueStyle={{ color: '#1890ff' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="تکمیل شده"
              value={stats.fulfilled}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="لغو شده"
              value={stats.cancelled}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Table
          columns={columns}
          dataSource={reservations}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'داده‌ای یافت نشد' }}
        />
      </Card>

      <Modal
        title="رزرو جدید"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields() }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="product" label="محصول" rules={[{ required: true }]}>
            <Select
              placeholder="انتخاب محصول"
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={products.map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }))}
            />
          </Form.Item>
          <Form.Item name="warehouse" label="انبار" rules={[{ required: true }]}>
            <Select
              placeholder="انتخاب انبار"
              options={warehouses.map(w => ({ value: w.id, label: w.name }))}
            />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="quantity" label="تعداد" rules={[{ required: true }]}>
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="reference_type" label="نوع مرجع">
                <Select placeholder="اختیاری" allowClear>
                  <Select.Option value="production_order">سفارش تولید</Select.Option>
                  <Select.Option value="sales_order">سفارش فروش</Select.Option>
                  <Select.Option value="purchase_order">سفارش خرید</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="reference_id" label="شماره مرجع">
            <InputNumber className="w-full" placeholder="اختیاری" />
          </Form.Item>
          <Form.Item name="notes" label="یادداشت‌ها">
            <Input.TextArea rows={3} />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>انصراف</Button>
            <Button type="primary" htmlType="submit">ایجاد رزرو</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
