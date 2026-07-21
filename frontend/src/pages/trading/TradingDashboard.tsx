import { useEffect, useState } from 'react'
import { Card, Row, Col, Statistic } from 'antd'
import { ImportOutlined, ExportOutlined, WarningOutlined } from '@ant-design/icons'
import api from '../../api/client'

export default function TradingDashboard() {
  const [summary, setSummary] = useState({
    total_imports: 0, active_imports: 0, pending_customs: 0,
    total_exports: 0, active_exports: 0,
    total_import_value_irr: 0, total_export_value_irr: 0,
  })

  useEffect(() => {
    api.get('/trading/summary/').then(({ data }) => setSummary(data)).catch(() => {})
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">داشبورد بازرگانی</h1>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="کل واردات" value={summary.total_imports} prefix={<ImportOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="در حال واردات" value={summary.active_imports} prefix={<ImportOutlined />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="در انتظار گمرک" value={summary.pending_customs} prefix={<WarningOutlined />} valueStyle={{ color: '#faad14' }} /></Card></Col>
        <Col span={6}><Card><Statistic title="کل صادرات" value={summary.total_exports} prefix={<ExportOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}><Card><Statistic title="ارزش واردات" value={summary.total_import_value_irr} suffix="ریال" prefix={<ImportOutlined />} /></Card></Col>
        <Col span={12}><Card><Statistic title="ارزش صادرات" value={summary.total_export_value_irr} suffix="ریال" prefix={<ExportOutlined />} /></Card></Col>
      </Row>
    </div>
  )
}
