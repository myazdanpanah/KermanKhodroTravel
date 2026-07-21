import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Tag, message, Space, Popconfirm } from 'antd';
import { PlusOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../api/client';

interface Booking {
  id: number;
  booking_number: string;
  customer_name: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/service-sales/bookings/');
      setBookings(data.results || data);
    } catch { message.error('خطا در بارگذاری'); }
    setLoading(false);
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/service-sales/bookings/', values);
      message.success('رزرو ایجاد شد');
      setModalOpen(false);
      form.resetFields();
      fetchBookings();
    } catch { message.error('خطا در ایجاد'); }
  };

  const handleAction = async (id: number, action: string) => {
    try {
      await api.post(`/service-sales/bookings/${id}/${action}/`);
      message.success('انجام شد');
      fetchBookings();
    } catch { message.error('خطا'); }
  };

  const statusColors: Record<string, string> = {
    draft: 'default', confirmed: 'green', in_progress: 'blue', completed: 'purple', cancelled: 'red',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>رزروها</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>رزرو جدید</Button>
      </div>

      <Table
        dataSource={bookings}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'شماره', dataIndex: 'booking_number', key: 'booking_number' },
          { title: 'مشتری', dataIndex: 'customer_name', key: 'customer_name' },
          { title: 'تاریخ سفر', dataIndex: 'travel_date', key: 'travel_date' },
          { title: 'مبلغ', dataIndex: 'total_amount', key: 'total_amount', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s]}>{s}</Tag> },
          {
            title: 'عملیات', key: 'actions', width: 250,
            render: (_: any, record: Booking) => (
              <Space>
                {record.status === 'draft' && (
                  <Popconfirm title="تأیید رزرو؟" onConfirm={() => handleAction(record.id, 'confirm')}>
                    <Button size="small" icon={<CheckCircleOutlined />} style={{ color: 'green' }}>تأیید</Button>
                  </Popconfirm>
                )}
                {record.status === 'confirmed' && (
                  <Popconfirm title="شروع رزرو؟" onConfirm={() => handleAction(record.id, 'start')}>
                    <Button size="small" type="primary">شروع</Button>
                  </Popconfirm>
                )}
                {record.status === 'in_progress' && (
                  <Popconfirm title="تکمیل رزرو؟" onConfirm={() => handleAction(record.id, 'complete')}>
                    <Button size="small" type="primary" style={{ background: '#52c41a' }}>تکمیل</Button>
                  </Popconfirm>
                )}
                {!['completed', 'cancelled'].includes(record.status) && (
                  <Popconfirm title="لغو رزرو؟" onConfirm={() => handleAction(record.id, 'cancel')}>
                    <Button size="small" danger icon={<CloseCircleOutlined />}>لغو</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title="رزرو جدید"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="ایجاد"
        cancelText="لغو"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="customer" label="مشتری" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="travel_date" label="تاریخ سفر" rules={[{ required: true }]}>
            <Input type="date" />
          </Form.Item>
          <Form.Item name="return_date" label="تاریخ بازگشت">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="notes" label="توضیحات">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
