import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Tag, Spin, message } from 'antd';
import {
  CalendarOutlined,
  DollarOutlined,
  TeamOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import api from '../../api/client';

interface Summary {
  total_bookings: number;
  total_revenue: number;
  total_commissions: number;
  total_refunds: number;
  active_services: number;
  total_passengers: number;
  recent_bookings: any[];
}

export default function ServiceSalesDashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/service-sales/bookings/summary/')
      .then(({ data }) => setSummary(data))
      .catch(() => message.error('خطا در بارگذاری'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  const statusColors: Record<string, string> = {
    confirmed: 'green', pending: 'orange', cancelled: 'red', completed: 'blue',
  };

  return (
    <div>
      <h2>داشبورد فروش خدمات</h2>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="کل رزروها" value={summary?.total_bookings || 0} prefix={<CalendarOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="درآمد کل" value={summary?.total_revenue || 0} prefix={<DollarOutlined />} suffix="ریال" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="کل کمیسیون‌ها" value={summary?.total_commissions || 0} prefix={<PercentageOutlined />} suffix="ریال" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="مسافران" value={summary?.total_passengers || 0} prefix={<TeamOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card title="آخرین رزروها">
        <Table
          dataSource={summary?.recent_bookings || []}
          rowKey="id"
          pagination={false}
          columns={[
            { title: 'شماره', dataIndex: 'booking_number', key: 'booking_number' },
            { title: 'مشتری', dataIndex: 'customer_name', key: 'customer_name' },
            { title: 'مبلغ', dataIndex: 'total_amount', key: 'total_amount', render: (v: number) => `${v?.toLocaleString()} ریال` },
            {
              title: 'وضعیت', dataIndex: 'status', key: 'status',
              render: (s: string) => <Tag color={statusColors[s] || 'default'}>{s}</Tag>,
            },
          ]}
        />
      </Card>
    </div>
  );
}
