import { useEffect, useState } from 'react'
import {
  Table, Button, Space, Tag, Modal, Form, InputNumber,
  message, Card, Row, Col, Statistic
} from 'antd'
import {
  DollarOutlined, CheckCircleOutlined,
  ReloadOutlined, WarningOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import api from '../../api/client'

interface SalesInvoice {
  id: number; invoice_number: string; customer_name: string; invoice_date: string;
  total: number; amount_paid: number; balance_due: number; status: string;
}

const statusColors: Record<string, string> = {
  draft: 'default', issued: 'processing', sent: 'processing',
  paid: 'success', partial: 'warning', overdue: 'error', cancelled: 'error',
}
const statusLabels: Record<string, string> = {
  draft: 'پیش‌نویس', issued: 'صادر شده', sent: 'ارسال شده',
  paid: 'پرداخت شده', partial: 'پرداخت جزئی', overdue: 'سررسید گذشته', cancelled: 'لغو شده',
}

export default function SalesInvoicesPage() {
  const [invoices, setInvoices] = useState<SalesInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })
  const [paymentForm] = Form.useForm()
  const [receivables, setReceivables] = useState({ outstanding_invoices: 0, balance: 0 })

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/sales/invoices/')
      setInvoices(data.results || data)
    } catch { message.error('خطا در بارگذاری فاکتورها') }
    setLoading(false)
  }

  const fetchReceivables = async () => {
    try {      const { data } = await api.get('/sales/invoices/receivables/'); setReceivables(data) } catch { message.error('Failed to load receivables') }
  }

  useEffect(() => { fetchInvoices(); fetchReceivables() }, [])

  const handleIssue = async (id: number) => {
    try {      await api.post(`/sales/invoices/${id}/issue/`); message.success('فاکتور صادر شد'); fetchInvoices() }
    catch (err: any) { message.error(err.response?.data?.detail || 'خطا در صدور فاکتور') }
  }

  const handlePayment = async (values: any) => {
    try {
      await api.post(`/sales/invoices/${paymentModal.id}/record_payment/`, { amount: values.amount })
      message.success('پرداخت ثبت شد')
      setPaymentModal({ open: false, id: null })
      paymentForm.resetFields()
      fetchInvoices()
      fetchReceivables()
    } catch (err: any) { message.error(err.response?.data?.detail || 'خطا در ثبت پرداخت') }
  }

  const columns: ColumnsType<SalesInvoice> = [
    { title: 'شماره', dataIndex: 'invoice_number', render: (v) => <span className="font-mono font-medium">{v}</span> },
    { title: 'مشتری', dataIndex: 'customer_name' },
    { title: 'تاریخ', dataIndex: 'invoice_date', render: (v) => v ? new Date(v).toLocaleDateString('fa-IR') : '—' },
    { title: 'مبلغ کل', dataIndex: 'total', render: (v) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'پرداخت شده', dataIndex: 'amount_paid', render: (v) => v?.toLocaleString('fa-IR') + ' ریال' },
    { title: 'مانده', dataIndex: 'balance_due', render: (v) => <span className={v > 0 ? 'text-nx-danger-500 font-bold' : ''}>{v?.toLocaleString('fa-IR')} ریال</span> },
    { title: 'وضعیت', dataIndex: 'status', render: (s) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag> },
    {
      title: 'عملیات', key: 'actions',
      render: (_, r) => (
        <Space>
          {r.status === 'draft' && <Button type="link" icon={<CheckCircleOutlined />} onClick={() => handleIssue(r.id)}>صدور</Button>}
          {!['draft', 'paid', 'cancelled'].includes(r.status) && r.balance_due > 0 && (
            <Button type="link" icon={<DollarOutlined />} onClick={() => setPaymentModal({ open: true, id: r.id })}>ثبت پرداخت</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">فاکتورهای فروش</h1>
        <Button icon={<ReloadOutlined />} onClick={fetchInvoices}>بروزرسانی</Button>
      </div>
      <Row gutter={16}>
        <Col span={12}><Card><Statistic title="صورتحساب‌های باز" value={receivables.outstanding_invoices} prefix={<WarningOutlined />} /></Card></Col>
        <Col span={12}><Card><Statistic title="مطالبات معوق" value={receivables.balance} prefix={<DollarOutlined />} suffix="ریال" valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>
      <Card>
        <Table columns={columns} dataSource={invoices} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal title="ثبت پرداخت" open={paymentModal.open} onCancel={() => { setPaymentModal({ open: false, id: null }); paymentForm.resetFields() }} footer={null}>
        <Form form={paymentForm} layout="vertical" onFinish={handlePayment}>
          <Form.Item name="amount" label="مبلغ پرداخت (ریال)" rules={[{ required: true }]}>
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setPaymentModal({ open: false, id: null }); paymentForm.resetFields() }}>انصراف</Button>
            <Button type="primary" htmlType="submit">ثبت پرداخت</Button>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
