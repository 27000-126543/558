import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  Tag,
  Space,
  message,
  Card,
  Descriptions,
} from 'antd';
import { PlusOutlined, QrcodeOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { rideRequestApi, employeeApi, routeApi } from '../api';
import type { RideRequest, Employee, Route } from '../../shared/types';

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
  completed: 'blue',
};

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  completed: '已完成',
};

const directionLabels: Record<string, string> = {
  to_company: '上班',
  from_company: '下班',
};

const RideRequestPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RideRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<RideRequest | null>(null);
  const [form] = Form.useForm();

  const [selectedDirection, setSelectedDirection] = useState<string>('to_company');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [r, e, rt] = await Promise.all([
        rideRequestApi.getAll(),
        employeeApi.getAll(),
        routeApi.getAll(),
      ]);
      setRequests(r);
      setEmployees(e);
      setRoutes(rt);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredRoutes = routes.filter((r) => r.direction === selectedDirection);
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) || null;

  const handleDirectionChange = (dir: string) => {
    setSelectedDirection(dir);
    setSelectedRouteId(null);
    form.setFieldsValue({ routeId: undefined, stationId: undefined, rideTime: undefined });
  };

  const handleRouteChange = (routeId: number) => {
    setSelectedRouteId(routeId);
    form.setFieldsValue({ stationId: undefined, rideTime: undefined });
  };

  const handleSubmit = async (values: any) => {
    try {
      const route = routes.find((r) => r.id === values.routeId);
      await rideRequestApi.create({
        employeeId: values.employeeId,
        routeId: values.routeId,
        stationId: values.stationId,
        rideDate: values.rideDate.format('YYYY-MM-DD'),
        rideTime: values.rideTime,
        direction: route?.direction || selectedDirection,
      });
      message.success('申请提交成功，已自动分配班次与座位');
      setModalOpen(false);
      form.resetFields();
      setSelectedDirection('to_company');
      setSelectedRouteId(null);
      loadData();
    } catch (err: any) {
      Modal.error({ title: '申请失败', content: err.message });
    }
  };

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: '确认取消该申请?',
      onOk: async () => {
        try {
          await rideRequestApi.cancel(id);
          message.success('已取消');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleAssign = async (id: number) => {
    try {
      await rideRequestApi.assignSeat(id);
      message.success('分配成功');
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '申请编号', dataIndex: 'requestNo', key: 'requestNo' },
    {
      title: '员工',
      dataIndex: 'employeeId',
      key: 'employeeId',
      render: (id: number) => employees.find((e) => e.id === id)?.name || '-',
    },
    {
      title: '部门',
      dataIndex: 'employeeId',
      key: 'department',
      render: (id: number) => employees.find((e) => e.id === id)?.department || '-',
    },
    {
      title: '乘车日期',
      dataIndex: 'rideDate',
      key: 'rideDate',
    },
    { title: '乘车时间', dataIndex: 'rideTime', key: 'rideTime' },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (d: string) => directionLabels[d],
    },
    {
      title: '站点',
      dataIndex: 'stationId',
      key: 'stationId',
      render: (id: number) => {
        for (const r of routes) {
          const s = r.stations.find((st) => st.id === id);
          if (s) return s.stationName;
        }
        return '-';
      },
    },
    { title: '座位号', dataIndex: 'seatNo', key: 'seatNo', render: (n?: number) => n || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string, record: RideRequest) => (
        <Space>
          <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>
          {s === 'rejected' && <span style={{ color: '#ff4d4f', fontSize: 12 }}>{record.rejectionReason}</span>}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: RideRequest) => (
        <Space size="small">
          {record.status === 'approved' && record.ticketCode && (
            <Button
              size="small"
              type="link"
              icon={<QrcodeOutlined />}
              onClick={() => {
                setCurrentTicket(record);
                setTicketOpen(true);
              }}
            >
              乘车凭证
            </Button>
          )}
          {record.status === 'pending' && (
            <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => handleAssign(record.id)}>
              分配座位
            </Button>
          )}
          {['pending', 'approved'].includes(record.status) && (
            <Button size="small" type="link" danger icon={<CloseOutlined />} onClick={() => handleCancel(record.id)}>
              取消
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="乘车申请列表"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            setModalOpen(true);
            setSelectedDirection('to_company');
            setSelectedRouteId(null);
          }}>
            新增申请
          </Button>
        }
      >
        <Table columns={columns} dataSource={requests} rowKey="id" loading={loading} />
      </Card>

      <Modal title="新增乘车申请" open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={600} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ direction: 'to_company' }}>
          <Form.Item label="选择员工" name="employeeId" rules={[{ required: true, message: '请选择员工' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="搜索员工姓名或工号"
              options={employees.map((e) => ({
                value: e.id,
                label: `${e.employeeNo} - ${e.name} (${e.department})`,
              }))}
            />
          </Form.Item>
          <Form.Item label="乘车方向" name="direction" rules={[{ required: true }]}>
            <Select
              onChange={handleDirectionChange}
              options={[
                { value: 'to_company', label: '上班' },
                { value: 'from_company', label: '下班' },
              ]}
            />
          </Form.Item>
          <Form.Item label="选择路线" name="routeId" rules={[{ required: true, message: '请选择路线' }]}>
            <Select
              placeholder="请先选择乘车方向"
              onChange={handleRouteChange}
              options={filteredRoutes.map((r) => ({ value: r.id, label: r.routeName }))}
            />
          </Form.Item>
          <Form.Item label="上车站点" name="stationId" rules={[{ required: true, message: '请选择站点' }]}>
            <Select
              placeholder={selectedRouteId ? '请选择站点' : '请先选择路线'}
              options={selectedRoute?.stations.map((s) => ({ value: s.id, label: `${s.sequence}. ${s.stationName} (${s.estimatedArrivalTime})` })) || []}
            />
          </Form.Item>
          <Form.Item label="乘车日期" name="rideDate" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="乘车时间" name="rideTime" rules={[{ required: true, message: '请选择时间' }]}>
            <Select
              placeholder={selectedRouteId ? '请选择时间' : '请先选择路线'}
              options={selectedRoute?.stations.map((s) => ({ value: s.estimatedArrivalTime, label: s.estimatedArrivalTime })) || []}
            />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="电子乘车凭证" open={ticketOpen} onCancel={() => setTicketOpen(false)} footer={null} width={400}>
        {currentTicket && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1677ff 0%, #69b1ff 100%)',
                color: '#fff',
                padding: 20,
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>企业班车乘车凭证</div>
              <div style={{ fontSize: 32, fontWeight: 'bold', letterSpacing: 4, margin: '16px 0' }}>
                {currentTicket.ticketCode}
              </div>
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="员工">
                {employees.find((e) => e.id === currentTicket.employeeId)?.name}
              </Descriptions.Item>
              <Descriptions.Item label="部门">
                {employees.find((e) => e.id === currentTicket.employeeId)?.department}
              </Descriptions.Item>
              <Descriptions.Item label="日期">{currentTicket.rideDate}</Descriptions.Item>
              <Descriptions.Item label="时间">{currentTicket.rideTime}</Descriptions.Item>
              <Descriptions.Item label="方向">{directionLabels[currentTicket.direction]}</Descriptions.Item>
              <Descriptions.Item label="座位号">{currentTicket.seatNo}号</Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RideRequestPage;
