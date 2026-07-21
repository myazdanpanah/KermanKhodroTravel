import { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import api from '../../api/client';

interface Refund {
  id: number;
  booking_number: string;
  refund_amount: number;
  tax_amount: number;
  net_refund: number;
  reason: string;
  status: string;
  created_at: string;
}

export default function RefundsPage() {
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/refunds/')
      .then(({ data }) => setRefunds(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    pending: 'orange', processed: 'green', rejected: 'red',
  };

  return (
    <div>
      <h2>بازپرداخت‌ها</h2>
      <Table
        dataSource={refunds}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'شماره رزرو', dataIndex: 'booking_number', key: 'booking_number' },
          { title: 'مبلغ بازپرداخت', dataIndex: 'refund_amount', key: 'refund_amount', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'مالیات', dataIndex: 'tax_amount', key: 'tax_amount', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'خالص', dataIndex: 'net_refund', key: 'net_refund', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'دلیل', dataIndex: 'reason', key: 'reason' },
          { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
          { title: 'تاریخ', dataIndex: 'created_at', key: 'created_at' },
        ]}
      />
    </div>
  );
}
