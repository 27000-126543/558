import React, { useEffect, useState, useCallback } from 'react';
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
  Alert,
  Steps,
  InputNumber,
  Divider,
} from 'antd';
import { PlusOutlined, EyeOutlined, EditOutlined, PlayCircleOutlined, CheckCircleOutlined, WarningOutlined, CheckOutlined, EnvironmentOutlined, TeamOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { scheduleApi, routeApi, vehicleApi, driverApi, adjustmentApi } from '../api';
import type { Schedule, Route, Vehicle, Driver } from '../../shared/types';

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

const { Step } = Steps;

interface SchedulePageProps {
  onRefreshAlerts?: () => void;
}

const SchedulePage: React.FC<SchedulePageProps> = ({ onRefreshAlerts }) => {
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
  const [delayResult, setDelayResult] = useState<any>(null);
  const [delayModalOpen, setDelayModalOpen] = useState(false);
  const [passengerConfirmed, setPassengerConfirmed] = useState(false);
  const [passengerConfirmedAt, setPassengerConfirmedAt] = useState<string>('');
  const [confirmingPassengers, setConfirmingPassengers] = useState(false);
  const [tripTrackOpen, setTripTrackOpen] = useState(false);
  const [stationLogs, setStationLogs] = useState<any[]>([]);
  const [stationForm] = Form.useForm();
  const [editingLogId, setEditingLogId] = useState<number | null>(null);
  const [stationAffectedOpen, setStationAffectedOpen] = useState(false);
  const [affectedPassengers, setAffectedPassengers] = useState<any[]>([]);
  const [viewingStationId, setViewingStationId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [adjustForm] = Form.useForm();

  const loadData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getRouteStations = (routeId: number) => {
    const route = routes.find(r => r.id === routeId);
    return route?.stations || [];
  };

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
      const resp = await scheduleApi.getPassengers(id);
      setPassengers(resp?.passengers || []);
      const confirmed = resp?.schedule?.passengerConfirmed === true;
      const confirmedAt = resp?.schedule?.passengerConfirmedAt || '';
      setPassengerConfirmed(confirmed);
      setPassengerConfirmedAt(confirmedAt);
      const schedule = schedules.find((s) => s.id === id);
      setCurrentSchedule(schedule || null);
      setPassengerOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleConfirmPassengers = async () => {
    if (!currentSchedule) return;
    setConfirmingPassengers(true);
    try {
      const result = await scheduleApi.confirmPassengers(currentSchedule.id);
      setPassengerConfirmed(true);
      setPassengerConfirmedAt(result.confirmedAt);
      message.success(`乘客名单已确认，确认时间：${result.confirmedAt}`);
      loadData();
      if (onRefreshAlerts) onRefreshAlerts();
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setConfirmingPassengers(false);
    }
  };

  const handleDelay = async (id: number) => {
    Modal.confirm({
      title: '标记班次延误?',
      content: '系统将自动推送预警通知并尝试重新调度',
      onOk: async () => {
        try {
          const result = await scheduleApi.handleDelay(id);
          setDelayResult(result);
          setDelayModalOpen(true);
          loadData();
          if (onRefreshAlerts) onRefreshAlerts();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
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

  const handleOpenTripTrack = async (record: Schedule) => {
    setCurrentSchedule(record);
    try {
      const logs = await scheduleApi.getStationLogs(record.id);
      setStationLogs(logs);
      setTripTrackOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleOpenStationForm = (log: any) => {
    setEditingLogId(log.id);
    stationForm.setFieldsValue({
      boardedCount: log.boarded_count || 0,
      absentCount: log.absent_count || 0,
      actualArrivalTime: log.actual_arrival_time ? dayjs(log.actual_arrival_time) : dayjs(),
      actualDepartureTime: log.actual_departure_time ? dayjs(log.actual_departure_time) : dayjs().add(2, 'minute'),
    });
  };

  const handleSubmitStationLog = async (values: any) => {
    if (!currentSchedule || !editingLogId) return;
    try {
      const resp = await scheduleApi.recordStationArrival(
        currentSchedule.id,
        editingLogId,
        {
          actualArrivalTime: values.actualArrivalTime.format('YYYY-MM-DD HH:mm:ss'),
          actualDepartureTime: values.actualDepartureTime?.format('YYYY-MM-DD HH:mm:ss'),
          boardedCount: values.boardedCount || 0,
          absentCount: values.absentCount || 0,
        }
      );
      message.success('站点记录已保存');
      if (resp?.newAlert && onRefreshAlerts) {
        onRefreshAlerts();
      }
      setEditingLogId(null);
      stationForm.resetFields();
      const logs = await scheduleApi.getStationLogs(currentSchedule.id);
      setStationLogs(logs);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleViewAffectedPassengers = async (stationId: number) => {
    if (!currentSchedule) return;
    setViewingStationId(stationId);
    try {
      const data = await scheduleApi.getStationAffectedPassengers(currentSchedule.id, stationId);
      setAffectedPassengers(data);
      setStationAffectedOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const getCurrentStationLabel = (sch: Schedule) => {
    if (sch.status !== 'departed' && sch.status !== 'delayed') return null;
    const seq = sch.currentStationSeq || 0;
    if (seq === 0) return <Tag color="blue">刚发车</Tag>;
    const stations = getRouteStations(sch.routeId);
    const st = stations.find(s => s.sequence === seq);
    return st ? (
      <Tag color="blue" icon={<EnvironmentOutlined />}>{st.stationName}</Tag>
    ) : null;
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
      title: '当前站点',
      key: 'currentStation',
      render: (_: any, record: Schedule) => getCurrentStationLabel(record),
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
        <Space size="small" wrap>
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewPassengers(record.id)}>
            乘客名单
          </Button>
          {(record.status === 'departed' || record.status === 'delayed') && (
            <Button size="small" type="link" icon={<EnvironmentOutlined />} onClick={() => handleOpenTripTrack(record)}>
              行程跟踪
            </Button>
          )}
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
            <>
              <Button
                size="small"
                type="link"
                danger
                icon={<WarningOutlined />}
                onClick={() => handleDelay(record.id)}
              >
                延误预警
              </Button>
            </>
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

      <Modal title="乘客名单" open={passengerOpen} onCancel={() => setPassengerOpen(false)} footer={null} width={750}>
        {passengerConfirmed && (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message={`司机已确认乘客名单${passengerConfirmedAt ? `（确认时间：${passengerConfirmedAt}）` : ''}`}
            style={{ marginBottom: 16 }}
          />
        )}
        {(!passengers || passengers.length === 0) ? (
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
        <div style={{ marginTop: 16, textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setPassengerOpen(false)}>关闭</Button>
            {!passengerConfirmed && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={confirmingPassengers}
                onClick={handleConfirmPassengers}
              >
                确认乘客名单
              </Button>
            )}
          </Space>
        </div>
      </Modal>

      <Modal title="延误预警结果" open={delayModalOpen} onCancel={() => setDelayModalOpen(false)} footer={null} width={600}>
        {delayResult && (
          <div>
            <Alert
              type="error"
              showIcon
              message={delayResult.alert?.title}
              description={delayResult.alert?.message}
              style={{ marginBottom: 16 }}
            />

            {delayResult.replacementVehicles?.length > 0 && (
              <Card type="inner" title="推荐可替换车辆" style={{ marginBottom: 16 }} size="small">
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  columns={[
                    { title: '车牌号', dataIndex: 'plateNo', key: 'plateNo' },
                    { title: '车型', dataIndex: 'model', key: 'model' },
                    { title: '座位数', dataIndex: 'capacity', key: 'capacity' },
                  ]}
                  dataSource={delayResult.replacementVehicles}
                />
              </Card>
            )}

            {delayResult.rescheduledSchedule && (
              <Card type="inner" title="系统已生成补发班次（待确认）" size="small">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="班次编号">{delayResult.rescheduledSchedule.scheduleNo}</Descriptions.Item>
                  <Descriptions.Item label="路线">
                    {routes.find((r) => r.id === delayResult.rescheduledSchedule.routeId)?.routeName || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="车辆">
                    {vehicles.find((v) => v.id === delayResult.rescheduledSchedule.vehicleId)?.plateNo || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="司机">
                    {drivers.find((d) => d.id === delayResult.rescheduledSchedule.driverId)?.name || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="发车时间">{delayResult.rescheduledSchedule.departureTime}</Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color="orange">待确认</Tag>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            )}

            {delayResult.replacementVehicles?.length === 0 && !delayResult.rescheduledSchedule && (
              <Alert type="warning" message="暂无可用替换车辆，请手动安排调度" />
            )}

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <Button type="primary" onClick={() => setDelayModalOpen(false)}>知道了</Button>
            </div>
          </div>
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

      <Modal
        title={`行程跟踪 - ${currentSchedule?.scheduleNo || ''}`}
        open={tripTrackOpen}
        onCancel={() => { setTripTrackOpen(false); setEditingLogId(null); stationForm.resetFields(); }}
        footer={null}
        width={900}
      >
        {stationLogs.length > 0 && (
          <>
            <Card size="small" style={{ marginBottom: 16 }} title="站点进度">
              <Steps
                direction="vertical"
                size="small"
                current={stationLogs.findIndex(s => !!s.actual_arrival_time) >= 0
                  ? (stationLogs.filter(s => !!s.actual_arrival_time).length)
                  : 0}
                status="process"
              >
                {stationLogs.map(log => {
                  const stTitle = (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <span style={{ fontWeight: 600 }}>{log.station_name}</span>
                        {log.is_delayed ? <Tag color="red">晚到{log.delay_minutes}分钟</Tag> : null}
                      </Space>
                      <Space>
                        <span style={{ color: '#999', fontSize: 12 }}>
                          <ClockCircleOutlined /> 计划 {log.planned_arrival_time}
                        </span>
                        <Button
                          type="link"
                          size="small"
                          onClick={() => handleOpenStationForm(log)}
                        >
                          {log.actual_arrival_time ? '编辑记录' : '记录到站'}
                        </Button>
                        {log.is_delayed === 1 && (
                          <Button
                            type="link"
                            size="small"
                            danger
                            onClick={() => handleViewAffectedPassengers(log.station_id)}
                          >
                            影响乘客
                          </Button>
                        )}
                      </Space>
                    </div>
                  );
                  const stDesc = log.actual_arrival_time ? (
                    <Space size="large" style={{ fontSize: 12, color: '#666' }}>
                      <span><CheckCircleOutlined style={{ color: '#52c41a' }} /> 实际到达 {log.actual_arrival_time.substring(11, 16)}</span>
                      {log.boarded_count !== undefined && log.boarded_count > 0 && (
                        <span><TeamOutlined /> 上车 {log.boarded_count}人</span>
                      )}
                      {log.absent_count !== undefined && log.absent_count > 0 && (
                        <span style={{ color: '#ff4d4f' }}><UserOutlined /> 未到 {log.absent_count}人</span>
                      )}
                    </Space>
                  ) : (
                    <span style={{ fontSize: 12, color: '#999' }}>未到达</span>
                  );
                  return <Step key={log.id} title={stTitle} description={stDesc} />;
                })}
              </Steps>
            </Card>

            {editingLogId && (
              <Card size="small" title="编辑站点记录" type="inner" style={{ marginBottom: 16 }}>
                <Form form={stationForm} layout="vertical" onFinish={handleSubmitStationLog}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item label="实际到达时间" name="actualArrivalTime" rules={[{ required: true }]}>
                      <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
                    </Form.Item>
                    <Form.Item label="实际离开时间" name="actualDepartureTime">
                      <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
                    </Form.Item>
                    <Form.Item label="上车人数" name="boardedCount">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item label="未到人数" name="absentCount">
                      <InputNumber min={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Space>
                      <Button onClick={() => { setEditingLogId(null); stationForm.resetFields(); }}>取消</Button>
                      <Button type="primary" htmlType="submit">保存</Button>
                    </Space>
                  </div>
                </Form>
              </Card>
            )}
          </>
        )}
      </Modal>

      <Modal
        title="受站点延误影响的乘客"
        open={stationAffectedOpen}
        onCancel={() => { setStationAffectedOpen(false); setViewingStationId(null); }}
        footer={null}
        width={700}
      >
        {affectedPassengers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>该站点暂无乘客</div>
        ) : (
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            columns={[
              { title: '座位号', dataIndex: 'seat_no', key: 'seat', width: 80 },
              { title: '员工编号', dataIndex: 'employee_no', key: 'no' },
              { title: '姓名', dataIndex: 'employee_name', key: 'name' },
              { title: '部门', dataIndex: 'department', key: 'dept' },
              { title: '联系电话', dataIndex: 'phone', key: 'phone' },
              { title: '站点', dataIndex: 'station_name', key: 'station' },
            ]}
            dataSource={affectedPassengers}
          />
        )}
      </Modal>
    </div>
  );
};

export default SchedulePage;
