import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  DatePicker,
  TimePicker,
  Tag,
  Space,
  message,
  Card,
  Descriptions,
  Input,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, PlayCircleOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { scheduleApi, routeApi, vehicleApi, driverApi, adjustmentApi } from '../api';
import type { Schedule, Route, Vehicle, Driver, RideRequest } from '../../shared/types';

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

const SchedulePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [passengerOpen, setPassengerOpen] = useState(false);
  const [passengers, setPassengers] = useState<any[]>([]);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, r, v, d] = await Promise.all([
        scheduleApi.getAll(),
        routeApi.getAll(),
        vehicleApi.getAll(),
        driverApi.getAll(),
      ]);
      setSchedules(s);
      setRoutes(r);
      setVehicles(v);
      setDrivers(d);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      const payload = {
        scheduleNo: editingId ? undefined : 'S' + Date.now(),
        routeId: values.routeId,
        vehicleId: values.vehicleId,
        driverId: values.driverId,
        departureTime: values.departureTime.format('HH:mm'),
        date: values.date.format('YYYY-MM-DD'),
        status: 'pending',
      };
      if (editingId) {
        await scheduleApi.update(editingId, payload);
        message.success('更新成功');
      } else {
        await scheduleApi.create(payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await scheduleApi.updateStatus(id, status);
      message.success('状态已更新');
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleViewPassengers = async (id: number) => {
    try {
      const data = await scheduleApi.getPassengers(id);
      setPassengers(data);
      setPassengerOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleEdit = (record: Schedule) => {
    setCurrentSchedule(record);
    setEditingId(record.id);
    form.setFieldsValue({
      routeId: record.routeId,
      vehicleId: record.vehicleId,
      driverId: record.driverId,
      departureTime: dayjs(record.departureTime, 'HH:mm'),
      date: dayjs(record.date),
    });
    setModalOpen(true);
  };

  const handleAdjustSubmit = async (values: any) => {
    try {
      await adjustmentApi.create({
        scheduleId: currentSchedule?.id,
        driverId: values.driverId,
        reason: values.reason,
      });
      message.success('调整申请已提交，等待主管审批');
      setAdjustOpen(false);
      adjustForm.resetFields();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '班次编号', dataIndex: 'scheduleNo', key: 'scheduleNo' },
    {
      title: '路线',
      dataIndex: 'routeId',
      key: 'routeId',
      render: (id: number) => routes.find((r) => r.id === id)?.routeName || '-',
    },
    {
      title: '车辆',
      dataIndex: 'vehicleId',
      key: 'vehicleId',
      render: (id: number) => vehicles.find((v) => v.id === id)?.plateNo || '-',
    },
    {
      title: '司机',
      dataIndex: 'driverId',
      key: 'driverId',
      render: (id: number) => drivers.find((d) => d.id === id)?.name || '-',
    },
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '发车时间', dataIndex: 'departureTime', key: 'departureTime' },
    { title: '乘车人数', dataIndex: 'passengerCount', key: 'passengerCount' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Schedule) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewPassengers(record.id)}>
            乘客名单
          </Button>
          {record.status === 'pending' && (
            <>
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button
                size="small"
                type="link"
                icon={<PlayCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'departed')}
              >
                发车
              </Button>
              <Button
                size="small"
                type="link"
                onClick={() => {
                  setCurrentSchedule(record);
                  setAdjustOpen(true);
                }}
              >
                申请换班
              </Button>
            </>
          )}
          {record.status === 'departed' && (
            <Button
              size="small"
              type="link"
              icon={<CheckCircleOutlined />}
              onClick={() => handleUpdateStatus(record.id, 'arrived')}
            >
              到达
            </Button>
          )}
          {record.status === 'departed' && (
            <Button
              size="small"
              type="link"
              danger
              icon={<WarningOutlined />}
              onClick={() => {
                Modal.confirm({
                  title: '标记班次延误?',
                  content: '系统将自动推送预警并尝试重新调度',
                  onOk: async () => {
                    await handleUpdateStatus(record.id, 'delayed');
                    message.warning('延误预警已推送');
                  },
                });
              }}
            >
              延误预警
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="班车调度列表"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              setModalOpen(true);
            }}
          >
            新增班次
          </Button>
        }
      >
        <Table columns={columns} dataSource={schedules} rowKey="id" loading={loading} />
      </Card>

      <Modal title={editingId ? '编辑班次' : '新增班次'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="路线" name="routeId" rules={[{ required: true }]}>
            <Select options={routes.map((r) => ({ value: r.id, label: r.routeName }))} />
          </Form.Item>
          <Form.Item label="车辆" name="vehicleId" rules={[{ required: true }]}>
            <Select
              options={vehicles
                .filter((v) => v.status === 'idle' || v.id === currentSchedule?.vehicleId)
                .map((v) => ({ value: v.id, label: `${v.plateNo} (${v.model}, ${v.capacity}座)` }))}
            />
          </Form.Item>
          <Form.Item label="司机" name="driverId" rules={[{ required: true }]}>
            <Select
              options={drivers
                .filter((d) => d.status === 'on_duty' || d.id === currentSchedule?.driverId)
                .map((d) => ({ value: d.id, label: d.name }))}
            />
          </Form.Item>
          <Form.Item label="日期" name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="发车时间" name="departureTime" rules={[{ required: true }]}>
            <TimePicker format="HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="乘客名单" open={passengerOpen} onCancel={() => setPassengerOpen(false)} footer={null} width={700}>
        {passengers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>暂无乘客</div>
        ) : (
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            columns={[
              { title: '座位号', dataIndex: 'seatNo', key: 'seatNo', width: 80 },
              { title: '员工编号', dataIndex: 'employee_no', key: 'no' },
              { title: '姓名', dataIndex: 'employee_name', key: 'name' },
              { title: '部门', dataIndex: 'department', key: 'dept' },
              { title: '上车站点', dataIndex: 'station_name', key: 'station' },
              { title: '凭证号', dataIndex: 'ticketCode', key: 'ticket' },
            ]}
            dataSource={passengers as any[]}
          />
        )}
      </Modal>

      <Modal title="司机换班申请" open={adjustOpen} onCancel={() => setAdjustOpen(false)} footer={null} width={500}>
        <Form form={adjustForm} layout="vertical" onFinish={handleAdjustSubmit}>
          <Form.Item label="申请司机" name="driverId" rules={[{ required: true, message: '请选择司机' }]}>
            <Select options={drivers.filter((d) => d.status === 'on_duty').map((d) => ({ value: d.id, label: d.name }))} />
          </Form.Item>
          <Form.Item label="换班原因" name="reason" rules={[{ required: true, message: '请填写原因' }]}>
            <Input.TextArea rows={4} placeholder="请详细说明换班原因..." />
          </Form.Item>
          <div style={{ color: '#fa8c16', fontSize: 12, marginBottom: 16 }}>
            注意：换班申请需主管审批后生效
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAdjustOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SchedulePage;
