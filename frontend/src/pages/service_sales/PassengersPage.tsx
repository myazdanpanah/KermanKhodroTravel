import { useEffect, useState } from 'react';
import { Table, message } from 'antd';
import api from '../../api/client';

interface Passenger {
  id: number;
  full_name: string;
  national_id: string;
  passport_number: string;
  phone: string;
  email: string;
}

export default function PassengersPage() {
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/passengers/')
      .then(({ data }) => setPassengers(data.results || data))
      .catch(() => message.error('خطا'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>مسافران</h2>
      <Table
        dataSource={passengers}
        rowKey="id"
        loading={loading}
        columns={[
          { title: 'نام کامل', dataIndex: 'full_name', key: 'full_name' },
          { title: 'کد ملی', dataIndex: 'national_id', key: 'national_id' },
          { title: 'شماره پاسپورت', dataIndex: 'passport_number', key: 'passport_number' },
          { title: 'تلفن', dataIndex: 'phone', key: 'phone' },
          { title: 'ایمیل', dataIndex: 'email', key: 'email' },
        ]}
      />
    </div>
  );
}
