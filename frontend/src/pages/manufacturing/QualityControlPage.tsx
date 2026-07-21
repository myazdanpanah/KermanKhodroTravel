import { Card, Row, Col, Statistic, Tag } from 'antd'
import { ExperimentOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons'

export default function QualityControlPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">کنترل کیفیت</h1>
      <Row gutter={16}>
        <Col span={8}><Card><Statistic title="بازرسی‌های امروز" value={0} prefix={<ExperimentOutlined />} /></Card></Col>
        <Col span={8}><Card><Statistic title="گذشته" value={0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={8}><Card><Statistic title="عدم انطباق باز" value={0} prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
      </Row>
      <Card>
        <p className="text-gray-500">کنترل کیفیت شامل بازرسی ورودی، فرآیندی و نهایی است.</p>
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2"><Tag color="blue">بازرسی ورودی</Tag> <span>بررسی مواد اولیه دریافتی</span></div>
          <div className="flex items-center gap-2"><Tag color="processing">بازرسی فرآیندی</Tag> <span>کنترل کیفیت در مراحل تولید</span></div>
          <div className="flex items-center gap-2"><Tag color="success">بازرسی نهایی</Tag> <span>کنترل نهایی محصول تولیدی</span></div>
        </div>
      </Card>
    </div>
  )
}
