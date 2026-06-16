import React, { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Table,
  Tag,
  message,
  DatePicker,
  Space,
  Row,
  Col,
  Statistic,
  Progress,
  Modal,
} from 'antd';
import { FileTextOutlined, DownloadOutlined, BarChartOutlined, TeamOutlined, CarOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { reportApi } from '../api';
import type { MonthlyReport } from '../../shared/types';
const { MonthPicker } = DatePicker;
const ReportPage: React.FC = () => {
 const [loading, setLoading] = useState(false);
 const [history, setHistory] = useState<MonthlyReport[]>([]);
 const [currentReport, setCurrentReport] = useState<MonthlyReport | null>(null);
 const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'));
 const loadData = async () => {
 setLoading(true);
 try {
 const data = await reportApi.getHistory();
 setHistory(data);
 if (data.length > 0) {
 setCurrentReport(data[0]);
 setSelectedMonth(data[0].reportMonth);
 }
 }
 catch (err: any) {
 message.error(err.message);
 }
 finally {
 setLoading(false);
 }
 };
 useEffect(() => {
 loadData();
 }, []);
 const handleGenerate = async () => {
 if (!selectedMonth) {
 message.warning('请选择月份');
 return;
 }
 setLoading(true);
 try {
 const data = await reportApi.generateMonthly(selectedMonth);
 setCurrentReport(data);
 message.success('报表生成成功');
 loadData();
 }
 catch (err: any) {
 message.error(err.message);
 }
 finally {
 setLoading(false);
 }
 };
 const handleExportPdf = async () => {
 if (!currentReport) {
 message.warning('请先生成或选择报表');
 return;
 }
 try {
 const result = await reportApi.exportPdf(currentReport.reportMonth);
 if (result === false) {
   return;
 }
 message.success('PDF导出成功');
 }
 catch (err: any) {
 message.error('导出失败: ' + err.message);
 }
 };
 const getDeptChartOption = () => {
 if (!currentReport)
 return {};
 return {
 tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
 legend: { data: ['通勤率', '准点率'] },
 xAxis: { type: 'category', data: currentReport.departmentStats.map((d) => d.department) },
 yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
 series: [
 {
 name: '通勤率',
 type: 'bar',
 data: currentReport.departmentStats.map((d) => d.commuteRate),
 itemStyle: { color: '#1677ff' },
 label: { show: true, position: 'top', formatter: '{c}%' },
 },
 {
 name: '准点率',
 type: 'bar',
 data: currentReport.departmentStats.map((d) => d.onTimeRate),
 itemStyle: { color: '#52c41a' },
 label: { show: true, position: 'top', formatter: '{c}%' },
 },
 ],
 };
 };
 const getVehicleChartOption = () => {
 if (!currentReport)
 return {};
 return {
 tooltip: { trigger: 'axis' },
 xAxis: { type: 'category', data: currentReport.vehicleUtilization.map((v) => v.plateNo) },
 yAxis: [
 { type: 'value', name: '班次' },
 { type: 'value', name: '利用率(%)', max: 100 },
 ],
 series: [
 {
 name: '总班次',
 type: 'bar',
 data: currentReport.vehicleUtilization.map((v) => v.totalTrips),
 itemStyle: { color: '#722ed1' },
 },
 {
 name: '利用率',
 type: 'line',
 yAxisIndex: 1,
 data: currentReport.vehicleUtilization.map((v) => v.utilizationRate),
 itemStyle: { color: '#fa8c16' },
 smooth: true,
 },
 ],
 };
 };
 const deptColumns = [
 { title: '部门', dataIndex: 'department', key: 'department' },
 { title: '总人数', dataIndex: 'totalEmployees', key: 'total' },
 { title: '通勤人数', dataIndex: 'commuteCount', key: 'commute' },
 {
 title: '通勤率',
 dataIndex: 'commuteRate',
 key: 'commuteRate',
 render: (v: number) => <Progress percent={v} size="small" />,
 },
 { title: '准点人数', dataIndex: 'onTimeCount', key: 'onTime' },
 {
 title: '准点率',
 dataIndex: 'onTimeRate',
 key: 'onTimeRate',
 render: (v: number) => <Progress percent={v} size="small" strokeColor="#52c41a" />,
 },
 ];
 const vehicleColumns = [
 { title: '车牌号', dataIndex: 'plateNo', key: 'plateNo' },
 { title: '总班次', dataIndex: 'totalTrips', key: 'trips' },
 { title: '总里程(km)', dataIndex: 'totalMileage', key: 'mileage' },
 {
 title: '车辆利用率',
 dataIndex: 'utilizationRate',
 key: 'util',
 render: (v: number) => <Progress percent={v} size="small" strokeColor="#722ed1" />,
 },
 ];
 const historyColumns = [
 { title: '报表月份', dataIndex: 'reportMonth', key: 'month' },
 { title: '整体通勤率', dataIndex: 'overallCommuteRate', key: 'commute', render: (v: number) => `${v}%` },
 { title: '整体准点率', dataIndex: 'overallOnTimeRate', key: 'onTime', render: (v: number) => `${v}%` },
 { title: '生成时间', dataIndex: 'createdAt', key: 'created' },
 {
 title: '操作',
 key: 'action',
 render: (_: any, record: MonthlyReport) => (<Button size="small" type="link" onClick={() => {
 setCurrentReport(record);
 setSelectedMonth(record.reportMonth);
 }}>
 查看
 </Button>),
 },
 ];
 return (<div>
 <Card style={{ marginBottom: 16 }}>
 <Space>
 <MonthPicker value={dayjs(selectedMonth)} onChange={(d) => d && setSelectedMonth(d.format('YYYY-MM'))} placeholder="选择月份"/>
 <Button type="primary" icon={<BarChartOutlined />} onClick={handleGenerate} loading={loading}>
 生成/刷新报表
 </Button>
 <Button icon={<DownloadOutlined />} onClick={handleExportPdf} disabled={!currentReport}>
 导出PDF
 </Button>
 </Space>
 </Card>

 {currentReport && (<>
 <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
 <Col xs={24} md={8}>
 <Card>
 <Statistic title={`${currentReport.reportMonth} 整体通勤率`} value={currentReport.overallCommuteRate} suffix="%" prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }}/>
 </Card>
 </Col>
 <Col xs={24} md={8}>
 <Card>
 <Statistic title="整体准点率" value={currentReport.overallOnTimeRate} suffix="%" prefix={<BarChartOutlined />} valueStyle={{ color: '#52c41a' }}/>
 </Card>
 </Col>
 <Col xs={24} md={8}>
 <Card>
 <Statistic title="统计车辆数" value={currentReport.vehicleUtilization.length} prefix={<CarOutlined />} valueStyle={{ color: '#722ed1' }}/>
 </Card>
 </Col>
 </Row>

 <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
 <Col xs={24} lg={12}>
 <Card title="各部门通勤与准点率分析">
 <ReactECharts option={getDeptChartOption()} style={{ height: 320 }}/>
 </Card>
 </Col>
 <Col xs={24} lg={12}>
 <Card title="车辆利用率分析">
 <ReactECharts option={getVehicleChartOption()} style={{ height: 320 }}/>
 </Card>
 </Col>
 </Row>

 <Card title={<Space><FileTextOutlined /> 各部门详细数据</Space>} style={{ marginBottom: 16 }}>
 <Table columns={deptColumns} dataSource={currentReport.departmentStats} rowKey="department" pagination={false} size="small"/>
 </Card>

 <Card title={<Space><CarOutlined /> 车辆使用详情</Space>} style={{ marginBottom: 16 }}>
 <Table columns={vehicleColumns} dataSource={currentReport.vehicleUtilization} rowKey="plateNo" pagination={false} size="small"/>
 </Card>
 </>)}

 <Card title={<Space><FileTextOutlined /> 历史报表</Space>}>
 <Table columns={historyColumns} dataSource={history} rowKey="id" loading={loading}/>
 </Card>
 </div>);
};
export default ReportPage;

