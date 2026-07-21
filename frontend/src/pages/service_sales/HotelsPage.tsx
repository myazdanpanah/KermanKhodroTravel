import { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import api from '../../api/client';

interface HotelReservation {
  id: number;
  hotel_name: string;
  room_type: string;
  check_in: string;
  check_out: string;
  nights: number;
  price_per_night: number;
  status: string;
}

export default function HotelsPage() {
  const [reservations, setReservations] = useState<HotelReservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/hotel-reservations/')
      .then(({ data }) => setReservations(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    confirmed: 'green', pending: 'orange', cancelled: 'red', checked_in: 'blue', checked_out: 'default',
  };

  return (
    <div>
      <h2>رزرو هتل‌ها</h2>
      <Table
        dataSource={reservations}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'هتل', dataIndex: 'hotel_name', key: 'hotel_name' },
          { title: 'نوع اتاق', dataIndex: 'room_type', key: 'room_type' },
          { title: 'تاریخ ورود', dataIndex: 'check_in', key: 'check_in' },
          { title: 'تاریخ خروج', dataIndex: 'check_out', key: 'check_out' },
          { title: 'شب‌ها', dataIndex: 'nights', key: 'nights' },
          { title: 'قیمت هر شب', dataIndex: 'price_per_night', key: 'price_per_night', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
        ]}
      />
    </div>
  );
}
