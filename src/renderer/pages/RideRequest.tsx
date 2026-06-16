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
  InputNumber,
} from 'antd';
import { PlusOutlined, QrcodeOutlined, CloseOutlined, CheckOutlined, SwapOutlined, ScheduleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { rideRequestApi, employeeApi, routeApi } from '../api';
import type { RideRequest, Employee, Route } from '../../shared/types';

const statusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
  completed: 'blue',
  waitlist: 'purple',
  rescheduled: 'cyan',
};

const statusLabels: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  completed: '已完成',
  waitlist: '候补中',
  rescheduled: '已改签',
};

const directionLabels: Record<string, string> = {
  to_company: '上班',
  from_company: '下班',
};

interface RideRequestPageProps {
  onRefreshAlerts?: () => void;
}

const RideRequestPage: React.FC<RideRequestPageProps> = ({ onRefreshAlerts }) => {
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleRecord, setRescheduleRecord] = useState<any>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistData, setWaitlistData] = useState<any[]>([]);
  const [form] = Form.useForm();
  const [rescheduleForm] = Form.useForm();
  const [promoteScheduleId, setPromoteScheduleId] = useState<number | null>(null);

  const [selectedDirection, setSelectedDirection] = useState<string>('to_company');
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);

  const [rescheduleDirection, setRescheduleDirection] = useState<string>('to_company');
  const [rescheduleRouteId, setRescheduleRouteId] = useState<number | null>(null);

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
  const rescheduleFilteredRoutes = routes.filter(r => r.direction === rescheduleDirection);
  const rescheduleSelectedRoute = routes.find(r => r.id === rescheduleRouteId) || null;

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
      const resp: any = await rideRequestApi.create({
        employeeId: values.employeeId,
        routeId: values.routeId,
        stationId: values.stationId,
        rideDate: values.rideDate.format('YYYY-MM-DD'),
        rideTime: values.rideTime,
        direction: route?.direction || selectedDirection,
      });
      if (resp?.waitlist) {
        message.warning(resp.waitingWarning || `座位已满，已进入候补队列（第${resp.waitlistOrder}位）。有人取消或加车时将自动补位。`);
      } else {
        message.success('申请提交成功，已自动分配班次与座位');
      }
      setModalOpen(false);
      form.resetFields();
      setSelectedDirection('to_company');
      setSelectedRouteId(null);
      loadData();
      if (onRefreshAlerts) onRefreshAlerts();
    } catch (err: any) {
      Modal.error({ title: '申请失败', content: err.message });
    }
  };

  const handleCancel = async (id: number) => {
    Modal.confirm({
      title: '确认取消该申请?',
      content: '取消后座位将释放，候补乘客会自动补位',
      onOk: async () => {
        try {
          const resp: any = await rideRequestApi.cancel(id);
          let msg = '已取消';
          if (resp?.promoted && resp.promoted.length > 0) {
            msg += `，已自动补位${resp.promoted.length}名候补乘客`;
          }
          message.success(msg);
          loadData();
          if (onRefreshAlerts) onRefreshAlerts();
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

  const handleOpenReschedule = (record: any) => {
    setRescheduleRecord(record);
    const defDir = record.direction;
    setRescheduleDirection(defDir);
    const defRouteId = record.routeId;
    setRescheduleRouteId(defRouteId);
    rescheduleForm.setFieldsValue({
      direction: defDir,
      routeId: defRouteId,
      stationId: record.stationId,
      rideDate: dayjs(record.rideDate),
      rideTime: record.rideTime,
    });
    setRescheduleOpen(true);
  };

  const handleRescheduleDirectionChange = (dir: string) => {
    setRescheduleDirection(dir);
    setRescheduleRouteId(null);
    rescheduleForm.setFieldsValue({ routeId: undefined, stationId: undefined, rideTime: undefined });
  };

  const handleRescheduleRouteChange = (rid: number) => {
    setRescheduleRouteId(rid);
    rescheduleForm.setFieldsValue({ stationId: undefined, rideTime: undefined });
  };

  const handleRescheduleSubmit = async (values: any) => {
    if (!rescheduleRecord) return;
    try {
      const route = routes.find(r => r.id === values.routeId);
      const resp: any = await rideRequestApi.reschedule(rescheduleRecord.id, {
        routeId: values.routeId,
        stationId: values.stationId,
        rideDate: values.rideDate.format('YYYY-MM-DD'),
        rideTime: values.rideTime,
        direction: route?.direction || rescheduleDirection,
      });
      if (resp?.waitlist) {
        message.warning(resp.warning || `改签成功，新座位已满，已进入候补（第${resp.waitlistOrder}位）。原申请已作废。`);
      } else {
        message.success(`改签成功，新座位号：${resp.seatNo || '-'}，已生成新凭证`);
      }
      setRescheduleOpen(false);
      setRescheduleRecord(null);
      rescheduleForm.resetFields();
      loadData();
      if (onRefreshAlerts) onRefreshAlerts();
    } catch (err: any) {
      Modal.error({ title: '改签失败', content: err.message });
    }
  };

  const handleOpenWaitlist = async () => {
    try {
      const data = await rideRequestApi.getWaitlist();
      setWaitlistData(data);
      setWaitlistOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handlePromoteWaitlist = async () => {
    if (!promoteScheduleId) return;
    try {
      const resp: any = await rideRequestApi.promoteWaitlist(promoteScheduleId, 5);
      if (resp?.promoted?.length > 0) {
        message.success(`已补位${resp.promoted.length}名候补乘客`);
      } else {
        message.info(resp?.reason || '暂无补位');
      }
      loadData();
      const data = await rideRequestApi.getWaitlist();
      setWaitlistData(data);
      if (onRefreshAlerts) onRefreshAlerts();
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
      render: (s: string, record: any) => (
        <Space>
          <Tag color={statusColors[s] || 'default'}>
            {s === 'waitlist' && record.waitlistOrder
              ? `${statusLabels[s]} #${record.waitlistOrder}`
              : statusLabels[s] || s}
          </Tag>
          {s === 'rejected' && record.rejectionReason && (
            <span style={{ color: '#ff4d4f', fontSize: 12 }}>{record.rejectionReason}</span>
          )}
          {record.rescheduleCount > 0 && (
            <Tag color="cyan">已改签{record.rescheduleCount}次</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small" wrap>
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
          {record.status === 'approved' && (
            <Button
              size="small"
              type="link"
              icon={<SwapOutlined />}
              onClick={() => handleOpenReschedule(record)}
            >
              改签
            </Button>
          )}
          {record.status === 'pending' && (
            <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => handleAssign(record.id)}>
              分配座位
            </Button>
          )}
          {['pending', 'approved', 'waitlist'].includes(record.status) && (
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
          <Space>
            <Button icon={<ScheduleOutlined />} onClick={handleOpenWaitlist}>
              候补队列
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => {
              setModalOpen(true);
              setSelectedDirection('to_company');
              setSelectedRouteId(null);
            }}>
              新增申请
            </Button>
          </Space>
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
          <div style={{ color: '#1677ff', fontSize: 12, marginBottom: 16, padding: 8, background: '#e6f4ff', borderRadius: 6 }}>
            提示：座位已满时将自动进入候补队列，有人取消或加车时会自动补位并生成凭证
          </div>
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

      <Modal title="改签乘车申请" open={rescheduleOpen} onCancel={() => { setRescheduleOpen(false); setRescheduleRecord(null); }} footer={null} width={600} destroyOnClose>
        {rescheduleRecord && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>原申请信息</div>
            <Descriptions size="small" column={2}>
              <Descriptions.Item label="员工">{employees.find(e => e.id === rescheduleRecord.employeeId)?.name}</Descriptions.Item>
              <Descriptions.Item label="原座位">{rescheduleRecord.seatNo || '-'}</Descriptions.Item>
              <Descriptions.Item label="原日期">{rescheduleRecord.rideDate}</Descriptions.Item>
              <Descriptions.Item label="原时间">{rescheduleRecord.rideTime}</Descriptions.Item>
            </Descriptions>
            {rescheduleRecord.rescheduleCount >= 2 && (
              <div style={{ marginTop: 8, color: '#ff4d4f' }}>该申请已改签2次，无法继续改签，请取消后重新申请</div>
            )}
          </div>
        )}
        <Form form={rescheduleForm} layout="vertical" onFinish={handleRescheduleSubmit}>
          <Form.Item label="乘车方向" name="direction" rules={[{ required: true }]}>
            <Select
              onChange={handleRescheduleDirectionChange}
              options={[
                { value: 'to_company', label: '上班' },
                { value: 'from_company', label: '下班' },
              ]}
            />
          </Form.Item>
          <Form.Item label="选择新路线" name="routeId" rules={[{ required: true, message: '请选择路线' }]}>
            <Select
              placeholder="请先选择乘车方向"
              onChange={handleRescheduleRouteChange}
              options={rescheduleFilteredRoutes.map(r => ({ value: r.id, label: r.routeName }))}
            />
          </Form.Item>
          <Form.Item label="上新站点" name="stationId" rules={[{ required: true, message: '请选择站点' }]}>
            <Select
              placeholder={rescheduleRouteId ? '请选择站点' : '请先选择路线'}
              options={rescheduleSelectedRoute?.stations.map(s => ({ value: s.id, label: `${s.sequence}. ${s.stationName} (${s.estimatedArrivalTime})` })) || []}
            />
          </Form.Item>
          <Form.Item label="新乘车日期" name="rideDate" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker style={{ width: '100%' }} disabledDate={(d) => d.isBefore(dayjs().startOf('day'))} />
          </Form.Item>
          <Form.Item label="新乘车时间" name="rideTime" rules={[{ required: true, message: '请选择时间' }]}>
            <Select
              placeholder={rescheduleRouteId ? '请选择时间' : '请先选择路线'}
              options={rescheduleSelectedRoute?.stations.map(s => ({ value: s.estimatedArrivalTime, label: s.estimatedArrivalTime })) || []}
            />
          </Form.Item>
          <div style={{ color: '#fa8c16', fontSize: 12, marginBottom: 16, padding: 8, background: '#fff7e6', borderRadius: 6 }}>
            提示：改签会作废原申请并占用新座位；若新座位已满会进入候补；每张申请最多改签2次
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setRescheduleOpen(false); setRescheduleRecord(null); }}>取消</Button>
              <Button type="primary" htmlType="submit" disabled={rescheduleRecord?.rescheduleCount >= 2}>
                确认改签
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="候补队列管理" open={waitlistOpen} onCancel={() => setWaitlistOpen(false)} footer={null} width={800} destroyOnClose>
        <Card size="small" style={{ marginBottom: 16 }} title="手动补位候补到指定班次">
          <Space>
            <Select
              style={{ width: 300 }}
              placeholder="选择要补位的班次"
              value={promoteScheduleId || undefined}
              onChange={setPromoteScheduleId}
              options={
                (requests
                  .filter(r => r.status === 'approved' && r.scheduleId)
                  .map(r => ({
                    value: r.scheduleId,
                    label: `班次ID:${r.scheduleId} (日期:${r.rideDate})`,
                  })) as any)
                  .concat([
                    { value: 1, label: '班次 S001（中关村线上班）' },
                    { value: 2, label: '班次 S002（望京线上班）' },
                    { value: 3, label: '班次 S003（中关村线下班）' },
                    { value: 4, label: '班次 S004（望京线下班）' },
                  ])
                  .filter((v: any, i: number, arr: any[]) => arr.findIndex((x: any) => x.value === v.value) === i)
              }
            />
            <Button type="primary" onClick={handlePromoteWaitlist} disabled={!promoteScheduleId}>
              自动补位（最多5名）
            </Button>
          </Space>
        </Card>
        {waitlistData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>候补队列为空</div>
        ) : (
          <Table
            size="small"
            dataSource={waitlistData}
            rowKey="id"
            pagination={false}
            columns={[
              { title: '候补顺序', dataIndex: 'waitlist_order', key: 'o', width: 90, render: n => `#${n}` },
              { title: '申请编号', dataIndex: 'request_no', key: 'no' },
              { title: '员工', dataIndex: 'employee_name', key: 'name' },
              { title: '部门', dataIndex: 'department', key: 'dept' },
              { title: '方向', dataIndex: 'direction', key: 'd', render: d => directionLabels[d] || d },
              { title: '站点', dataIndex: 'station_name', key: 'st' },
              { title: '日期', dataIndex: 'ride_date', key: 'dt' },
              { title: '申请时间', dataIndex: 'created_at', key: 'ct' },
            ]}
          />
        )}
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
