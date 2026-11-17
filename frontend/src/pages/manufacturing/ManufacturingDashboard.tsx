import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import {
  AppstoreOutlined, PlayCircleOutlined, CheckCircleOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import api from '../../api/client'

export default function ManufacturingDashboard() {
  const [summary, setSummary] = useState({
    active_production_orders: 0, draft_production_orders: 0,
    completed_production_orders: 0, active_boms: 0, active_work_centers: 0,
  })

  useEffect(() => {
    api.get('/manufacturing/summary/').then(({ data }) => {
      setSummary(data.data || data)
    }).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">داشبورد تولید</h1>

      <Row gutter={16}>
        <Col span={6}>
          <Card><Statistic title="دستورات فعال" value={summary.active_production_orders} prefix={<PlayCircleOutlined />} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="در انتظار تأیید" value={summary.draft_production_orders} prefix={<AppstoreOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="تکمیل شده" value={summary.completed_production_orders} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="مراکز کار فعال" value={summary.active_work_centers} prefix={<ToolOutlined />} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="BOM فعال">
            <Statistic value={summary.active_boms} suffix="مورد" prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="خلاصه تولید">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>دستورات فعال:</span><span className="font-bold">{summary.active_production_orders}</span></div>
              <div className="flex justify-between"><span>دستورات در انتظار:</span><span className="font-bold">{summary.draft_production_orders}</span></div>
              <div className="flex justify-between"><span>تکمیل شده:</span><span className="font-bold text-nx-teal">{summary.completed_production_orders}</span></div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}
