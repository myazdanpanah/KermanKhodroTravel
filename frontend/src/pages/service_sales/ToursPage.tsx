import { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import api from '../../api/client';

interface Tour {
  id: number;
  name: string;
  destination: string;
  duration_days: number;
  max_participants: number;
  price_per_person: number;
  is_active: boolean;
}

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/tours/')
      .then(({ data }) => setTours(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>تورها</h2>
      <Table
        dataSource={tours}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'نام تور', dataIndex: 'name', key: 'name' },
          { title: 'مقصد', dataIndex: 'destination', key: 'destination' },
          { title: 'مدت (روز)', dataIndex: 'duration_days', key: 'duration_days' },
          { title: 'حداکثر ظرفیت', dataIndex: 'max_participants', key: 'max_participants' },
          { title: 'قیمت هر نفر', dataIndex: 'price_per_person', key: 'price_per_person', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'فعال', dataIndex: 'is_active', key: 'is_active', render: (v: boolean) => <Tag color={v ? 'green' : 'red'}>{v ? 'بله' : 'خیر'}</Tag> },
        ]}
      />
    </div>
  );
}
