import { useEffect, useState } from 'react';
import { Table, Tag, message } from 'antd';
import api from '../../api/client';

interface Ticket {
  id: number;
  ticket_number: string;
  passenger_name: string;
  airline: string;
  flight_number: string;
  departure_date: string;
  departure_city: string;
  arrival_city: string;
  price: number;
  status: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/tickets/')
      .then(({ data }) => setTickets(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  const statusColors: Record<string, string> = {
    issued: 'green', cancelled: 'red', refunded: 'orange', used: 'blue',
  };

  return (
    <div>
      <h2>بلیط‌ها</h2>
      <Table
        dataSource={tickets}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'شماره بلیط', dataIndex: 'ticket_number', key: 'ticket_number' },
          { title: 'مسافر', dataIndex: 'passenger_name', key: 'passenger_name' },
          { title: 'شرکت هواپیمایی', dataIndex: 'airline', key: 'airline' },
          { title: 'شماره پرواز', dataIndex: 'flight_number', key: 'flight_number' },
          { title: 'تاریخ پرواز', dataIndex: 'departure_date', key: 'departure_date' },
          { title: 'مبدأ', dataIndex: 'departure_city', key: 'departure_city' },
          { title: ' مقصد', dataIndex: 'arrival_city', key: 'arrival_city' },
          { title: 'قیمت', dataIndex: 'price', key: 'price', render: (v: number) => `${v?.toLocaleString()} ریال` },
          { title: 'وضعیت', dataIndex: 'status', key: 'status', render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag> },
        ]}
      />
    </div>
  );
}
