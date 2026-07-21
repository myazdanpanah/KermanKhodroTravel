import { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Tag, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import api from '../../api/client';

interface ServiceItem {
  id: number;
  name: string;
  category_name: string;
  service_type: string;
  selling_price: number;
  supplier_cost: number;
  is_active: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/service-sales/services/');
      setServices(data.results || data);
    } catch { message.error('خطا'); }
    setLoading(false);
  };

  useEffect(() => { fetchServices(); }, []);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await api.post('/service-sales/services/', values);
      message.success('خدمت ایجاد شد');
      setModalOpen(false);
      form.resetFields();
      fetchServices();
    } catch { message.error('خطا'); }
  };

  const typeLabels: Record<string, string> = {
    flight: 'پرواز', hotel: 'هتل', tour: 'تور', transfer: 'ترانسفر', visa: 'ویزا', insurance: 'بیمه', other: 'سایر',
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>خدمات</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>خدمت جدید</Button>
      </div>

      <Table
        dataSource={services}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'نام', dataIndex: 'name', key: 'name' },
          { title: 'دسته‌بندی', dataIndex: 'category_name', key: 'category_name' },
          { title: 'نوع', dataIndex: 'service_type', key: 'service_type', render: (t: string) => <Tag>{typeLabels[t] || t}</Tag> },
          { title: 'قیمت فروش', dataIndex: 'selling_price', key: 'selling_price', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'هزینه تأمین', dataIndex: 'supplier_cost', key: 'supplier_cost', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'فعال', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'بله' : 'خیر'}</Tag> },
        ]}
      />

      <Modal
        title="خدمت جدید"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        okText="ایجاد"
        cancelText="لغو"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="نام" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="category" label="دسته‌بندی" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="service_type" label="نوع" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="flight">پرواز</Select.Option>
              <Select.Option value="hotel">هتل</Select.Option>
              <Select.Option value="tour">تور</Select.Option>
              <Select.Option value="transfer">ترانسفر</Select.Option>
              <Select.Option value="visa">ویزا</Select.Option>
              <Select.Option value="insurance">بیمه</Select.Option>
              <Select.Option value="other">سایر</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="selling_price" label="قیمت فروش" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
          <Form.Item name="supplier_cost" label="هزینه تأمین">
            <InputNumber style={{ width: '100%' }} min={0} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
