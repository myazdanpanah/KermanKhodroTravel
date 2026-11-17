import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, Input,
  Select, message, Popconfirm, Card, Row, Col, DatePicker
} from 'antd'
import {
  PlusOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface SalesOrder {
  id: number
  order_number: string
  customer_name: string
  order_date: string
  delivery_date: string
  total: number
  status: string
  notes: string
  lines: any[]
}

const statusColors: Record<string, string> = {
  draft: 'default', confirmed: 'processing', processing: 'processing',
  partially_delivered: 'warning', delivered: 'success', invoiced: 'success',
  completed: 'success', cancelled: 'error',
}

const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس', confirmed: 'تأیید شده', processing: 'در حال پردازش',
  partially_delivered: 'تحویل جزئی', delivered: 'تحویل شده', invoiced: 'فاکتور شده',
  completed: 'تکمیل شده', cancelled: 'لغو شده',
}

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()
  const [customers, setCustomers] = useState<any[]>([])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/sales/orders/')
      setOrders(data.results || data)
    } catch { message.error('خطا در بارگذاری سفارشات') }
    setLoading(false)
  }

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get('/finance/customers/')
      setCustomers(data.results || data)
    } catch {
      message.error('Failed to load customers')
    }
  }

  useEffect(() => { fetchOrders(); fetchCustomers() }, [])

  const handleCreate = async (values: any) => {
    try {
      await api.post('/sales/orders/', {
        ...values,
        order_date: values.order_date?.format?.('YYYY-MM-DD') || values.order_date,
        delivery_date: values.delivery_date?.format?.('YYYY-MM-DD') || values.delivery_date,
      })
      message.success('سفارش فروش ایجاد شد')
      setModalOpen(false)
      form.resetFields()
      fetchOrders()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا در ایجاد سفارش') }
  }

  const handleConfirm = async (id: number) => {
    try {
      await api.post(`/sales/orders/${id}/confirm/`)
      message.success('سفارش تأیید شد')
      fetchOrders()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا در تأیید سفارش') }
  }

  const handleCancel = async (id: number) => {
    try {
      await api.post(`/sales/orders/${id}/cancel/`)
      message.success('سفارش لغو شد')
      fetchOrders()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا در لغو سفارش') }
  }

  const columns: ColumnsType<SalesOrder> = [
    { title: 'شماره', dataIndex: 'order_number', render: (v) => <span className="font-mono font-medium">{v}</span> },
    { title: 'مشتری', dataIndex: 'customer_name' },
    { title: 'تاریخ', dataIndex: 'order_date', render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—' },
    { title: 'مبلغ کل', dataIndex: 'total', render: (v) => v ? `${v.toLocaleString('fa-IR')} ریال` : '—' },
    { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'عملیات', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && (
            <>
              <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(r.id)}>تأیید</Button>
              <Popconfirm title="آیا از لغو اطمینان دارید؟" onConfirm={() => handleCancel(r.id)}>
                <Button type="link" danger icon={<CloseCircleOutlined />}>لغو</Button>
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
        <h1 className="text-2xl font-bold">سفارشات فروش</h1>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>بروزرسانی</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>سفارش جدید</Button>
        </Space>
      </div>
      <Card>
        <Table columns={columns} dataSource={orders} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="سفارش فروش جدید" open={modalOpen} onCancel={() => { setModalOpen(false); form.resetFields() }} footer={null} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="customer" label="مشتری" rules={[{ required: true }]}>
            <Select showSearch filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              options={customers.map(c => ({ value: c.id, label: c.name }))} placeholder="انتخاب مشتری" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="order_date" label="تاریخ سفارش" rules={[{ required: true }]}><DatePicker className="w-full" /></Form.Item></Col>
            <Col span={12}><Form.Item name="delivery_date" label="تاریخ تحویل"><DatePicker className="w-full" /></Form.Item></Col>
          </Row>
          <Form.Item name="notes" label="یادداشت‌ها"><Input.TextArea rows={3} /></Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setModalOpen(false); form.resetFields() }}>انصراف</Button>
            <Button type="primary" htmlType="submit">ایجاد سفارش</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
