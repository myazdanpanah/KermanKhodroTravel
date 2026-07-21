import { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import api from '../../api/client';

interface Commission {
  id: number;
  rule_name: string;
  booking_number: string;
  calculated_amount: number;
  status: string;
  calculated_at: string;
}

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/commissions/')
      .then(({ data }) => setCommissions(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    calculated: 'blue', paid: 'green', cancelled: 'red',
  };

  return (
    <div>
      <h2>کمیسیون‌ها</h2>
      <Table
        dataSource={commissions}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'قانون', dataIndex: 'rule_name', key: 'rule_name' },
          { title: 'شماره رزرو', dataIndex: 'booking_number', key: 'booking_number' },
          { title: 'مبلغ', dataIndex: 'calculated_amount', key: 'calculated_amount', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
          { title: 'تاریخ محاسبه', dataIndex: 'calculated_at', key: 'calculated_at' },
        ]}
      />
    </div>
  );
}
