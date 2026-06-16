import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Progress, Spin, Empty } from 'antd';
import {
  CarOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  CalendarOutlined,
  BellOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { dashboardApi, reportApi } from '../api';
import type { Schedule } from '../../shared/types';

interface Props {
  onRefresh?: () => void;
}

const statusColors: Record<string, string> = {
  pending: 'default',
  departed: 'processing',
  arrived: 'success',
  cancelled: 'default',
  delayed: 'warning',
};

const statusLabels: Record<string, string> = {
  pending: '待发车',
  departed: '行驶中',
  arrived: '已到达',
  cancelled: '已取消',
  delayed: '延误',
};

const Dashboard: React.FC<Props> = ({ onRefresh }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [realtimeData, setRealtimeData] = useState<any>({ schedules: [] });
  const [chartData, setChartData] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, r, c] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRealtimeData(),
        reportApi.getStats(),
      ]);
      setStats(s);
      setRealtimeData(r);
      setChartData(c);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    onRefresh?.();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  const scheduleColumns = [
    { title: '班次编号', dataIndex: 'schedule_no', key: 'schedule_no' },
    { title: '路线', dataIndex: 'route_name', key: 'route_name' },
    { title: '车牌', dataIndex: 'plate_no', key: 'plate_no' },
    { title: '司机', dataIndex: 'driver_name', key: 'driver_name' },
    { title: '发车时间', dataIndex: 'departure_time', key: 'departure_time' },
    { title: '乘车人数', dataIndex: 'passenger_count', key: 'passenger_count' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
  ];

  const getChartOption = () => {
    const dates = Array.from(new Set(chartData.map((d: any) => d.ride_date))).sort();
    const toData = dates.map(date => {
      const item = chartData.find((d: any) => d.ride_date === date && d.direction === 'to_company');
      return item?.count || 0;
    });
    const fromData = dates.map(date => {
      const item = chartData.find((d: any) => d.ride_date === date && d.direction === 'from_company');
      return item?.count || 0;
    });
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['上班通勤', '下班通勤'] },
      xAxis: { type: 'category', data: dates },
      yAxis: { type: 'value' },
      series: [
        { name: '上班通勤', type: 'bar', data: toData, itemStyle: { color: '#1677ff' } },
        { name: '下班通勤', type: 'bar', data: fromData, itemStyle: { color: '#52c41a' } },
      ],
    };
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="车辆总数" value={stats.totalVehicles} prefix={<CarOutlined />} valueStyle={{ color: '#1677ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="运行中车辆" value={stats.runningVehicles} prefix={<CarOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="今日班次" value={stats.todaySchedules} prefix={<CalendarOutlined />} valueStyle={{ color: '#722ed1' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="待处理申请" value={stats.pendingRequests} prefix={<SafetyCertificateOutlined />} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="在职员工" value={stats.totalEmployees} prefix={<UserOutlined />} valueStyle={{ color: '#13c2c2' }} />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8} lg={4}>
          <Card>
            <Statistic title="未读预警" value={stats.activeAlerts} prefix={<BellOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="今日班次实时状态">
            {realtimeData.schedules.length === 0 ? (
              <Empty description="今日暂无班次" />
            ) : (
              <Table
                columns={scheduleColumns}
                dataSource={realtimeData.schedules}
                rowKey="id"
                size="small"
                pagination={false}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="车辆运行情况">
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>车辆利用率</span>
                <span>{stats.totalVehicles > 0 ? Math.round((stats.runningVehicles / stats.totalVehicles) * 100) : 0}%</span>
              </div>
              <Progress percent={stats.totalVehicles > 0 ? Math.round((stats.runningVehicles / stats.totalVehicles) * 100) : 0} status="active" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>今日上座率</span>
                <span>
                  {realtimeData.schedules.reduce((s: number, x: any) => s + (x.passenger_count || 0), 0) > 0
                    ? Math.round(
                        (realtimeData.schedules.reduce((s: number, x: any) => s + (x.passenger_count || 0), 0) /
                          (realtimeData.schedules.length * 45 || 1)) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>
              <Progress
                percent={
                  realtimeData.schedules.reduce((s: number, x: any) => s + (x.passenger_count || 0), 0) > 0
                    ? Math.round(
                        (realtimeData.schedules.reduce((s: number, x: any) => s + (x.passenger_count || 0), 0) /
                          (realtimeData.schedules.length * 45 || 1)) *
                          100
                      )
                    : 0
                }
                strokeColor="#52c41a"
              />
            </div>
            <ReactECharts option={getChartOption()} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
