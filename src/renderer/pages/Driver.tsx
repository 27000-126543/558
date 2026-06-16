import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Card,
  Tag,
  Tabs,
  Descriptions,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import {
  driverApi,
  scheduleApi,
  adjustmentApi,
  routeApi,
} from '../api';
import type { Driver, DriverAdjustment, Schedule, Route } from '../../shared/types';
import dayjs from 'dayjs';

const { TextArea } = Input;

const statusColors: Record<string, string> = {
  on_duty: 'green',
  off_duty: 'default',
  rest: 'orange',
};

const statusLabels: Record<string, string> = {
  on_duty: '在岗',
  off_duty: '离岗',
  rest: '休息',
};

const adjStatusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const adjStatusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
};

interface DriverPageProps {
  onRefreshAlerts?: () => void;
}

const DriverPage: React.FC<DriverPageProps> = ({ onRefreshAlerts }) => {
  const [activeTab, setActiveTab] = useState('management');
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [adjustments, setAdjustments] = useState<DriverAdjustment[]>([]);
  const [adjustmentList, setAdjustmentList] = useState<any[]>([]);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [applyForm] = Form.useForm();

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectForm] = Form.useForm();

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await driverApi.getAll();
      setDrivers(data);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSchedules = async () => {
    try {
      const data = await scheduleApi.getAll();
      setSchedules(data);
    } catch {}
  };

  const loadRoutes = async () => {
    try {
      const data = await routeApi.getAll();
      setRoutes(data);
    } catch {}
  };

  const loadAdjustments = async () => {
    setLoading(true);
    try {
      const data = await adjustmentApi.getAll();
      setAdjustments(data);
      const enriched = await Promise.all(
        data.map(async (adj) => {
          try {
            const detail = await adjustmentApi.getById(adj.id);
            return detail;
          } catch {
            return adj;
          }
        })
      );
      setAdjustmentList(enriched);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrivers();
    loadSchedules();
    loadRoutes();
    loadAdjustments();
  }, []);

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await driverApi.update(editingId, values);
      } else {
        await driverApi.create(values);
      }
      message.success('保存成功');
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
      loadDrivers();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleEdit = (record: Driver) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除该司机?',
      onOk: async () => {
        try {
          await driverApi.remove(id);
          message.success('删除成功');
          loadDrivers();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleOpenApply = () => {
    applyForm.resetFields();
    setApplyModalOpen(true);
  };

  const handleSubmitApply = async (values: any) => {
    try {
      const payload = {
        scheduleId: values.scheduleId,
        driverId: values.newDriverId,
        reason: values.reason,
      };
      await adjustmentApi.create(payload);
      message.success('换班申请已提交');
      setApplyModalOpen(false);
      applyForm.resetFields();
      loadAdjustments();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleViewDetail = async (id: number) => {
    try {
      const detail = await adjustmentApi.getById(id);
      setDetailData(detail);
      setDetailModalOpen(true);
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleApprove = (id: number) => {
    Modal.confirm({
      title: '确认批准该换班申请?',
      content: '批准后原班次司机将被替换，调度列表会立即更新。',
      onOk: async () => {
        try {
          await adjustmentApi.approve(id, '主管');
          message.success('已批准');
          loadAdjustments();
          loadSchedules();
          onRefreshAlerts?.();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleOpenReject = (id: number) => {
    setRejectingId(id);
    rejectForm.resetFields();
    setRejectModalOpen(true);
  };

  const handleSubmitReject = async (values: any) => {
    if (!rejectingId) return;
    try {
      await adjustmentApi.reject(rejectingId, '主管', values.rejectionReason);
      message.success('已拒绝');
      setRejectModalOpen(false);
      setRejectingId(null);
      rejectForm.resetFields();
      loadAdjustments();
      onRefreshAlerts?.();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '司机编号', dataIndex: 'driverNo', key: 'driverNo' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '驾驶证号', dataIndex: 'licenseNo', key: 'licenseNo' },
    { title: '准驾车型', dataIndex: 'licenseType', key: 'licenseType' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Driver) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const scheduleOptions = schedules
    .filter(s => s.status === 'pending' || s.status === 'departed')
    .map(s => {
      const route = routes.find(r => r.id === s.routeId);
      const oldDriver = drivers.find(d => d.id === s.driverId);
      return {
        value: s.id,
        label: `${s.scheduleNo} | ${route?.routeName || ''} | ${dayjs(s.departureTime).format('MM-DD HH:mm')} | 原司机: ${oldDriver?.name || '-'}`,
      };
    });

  const driverOptions = drivers
    .filter(d => d.status === 'on_duty')
    .map(d => ({
      value: d.id,
      label: `${d.driverNo} - ${d.name}`,
    }));

  const myApplicationsColumns = [
    { title: '申请编号', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '班次信息',
      key: 'schedule',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.schedule_no || '-'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.route_name || '-'}</div>
        </div>
      ),
    },
    {
      title: '原司机',
      key: 'oldDriver',
      render: (_: any, r: any) => (
        <Tag color="blue">{r.old_driver_name || '-'}</Tag>
      ),
    },
    {
      title: '新司机',
      key: 'newDriver',
      render: (_: any, r: any) => (
        <Tag color="cyan">{r.new_driver_name || '-'}</Tag>
      ),
    },
    { title: '申请原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={adjStatusColors[s]}>{adjStatusLabels[s]}</Tag>,
    },
    {
      title: '拒绝原因',
      dataIndex: 'rejectionReason',
      key: 'rejectionReason',
      render: (v: string) => v ? <span style={{ color: '#ff4d4f' }}>{v}</span> : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: any, record: DriverAdjustment) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
            详情
          </Button>
        </Space>
      ),
    },
  ];

  const approvalColumns = [
    { title: '申请编号', dataIndex: 'id', key: 'id', width: 80 },
    {
      title: '班次信息',
      key: 'schedule',
      render: (_: any, r: any) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.schedule_no || '-'}</div>
          <div style={{ fontSize: 12, color: '#888' }}>{r.route_name || '-'}</div>
        </div>
      ),
    },
    {
      title: '原司机',
      key: 'oldDriver',
      render: (_: any, r: any) => (
        <Tag color="blue">{r.old_driver_name || '-'}</Tag>
      ),
    },
    {
      title: '新司机',
      key: 'newDriver',
      render: (_: any, r: any) => (
        <Tag color="cyan">{r.new_driver_name || '-'}</Tag>
      ),
    },
    { title: '申请原因', dataIndex: 'reason', key: 'reason', ellipsis: true },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: string) => <Tag color={adjStatusColors[s]}>{adjStatusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: DriverAdjustment) => (
        <Space size="small">
          <Button size="small" type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
            详情
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                size="small"
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => handleApprove(record.id)}
              >
                批准
              </Button>
              <Button
                size="small"
                danger
                icon={<CloseOutlined />}
                onClick={() => handleOpenReject(record.id)}
              >
                拒绝
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const renderManagement = () => (
    <Card
      title="司机管理"
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
          新增司机
        </Button>
      }
    >
      <Table columns={columns} dataSource={drivers} rowKey="id" loading={loading} />
    </Card>
  );

  const renderMyApplications = () => (
    <Card
      title="我的换班申请"
      extra={
        <Button
          type="primary"
          icon={<SwapOutlined />}
          onClick={handleOpenApply}
        >
          发起换班申请
        </Button>
      }
    >
      <Table columns={myApplicationsColumns} dataSource={adjustmentList} rowKey="id" loading={loading} />
    </Card>
  );

  const renderApproval = () => (
    <Card title="换班审批（主管）">
      <Table columns={approvalColumns} dataSource={adjustmentList} rowKey="id" loading={loading} />
    </Card>
  );

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={(k) => {
          setActiveTab(k);
          if (k === 'approval' || k === 'application') {
            loadAdjustments();
          }
        }}
        items={[
          { key: 'management', label: '司机管理', children: renderManagement() },
          { key: 'application', label: '我的换班申请', children: renderMyApplications() },
          { key: 'approval', label: '换班审批', children: renderApproval() },
        ]}
      />

      <Modal title={editingId ? '编辑司机' : '新增司机'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="司机编号" name="driverNo" rules={[{ required: true }]}>
            <Input placeholder="如 D001" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="驾驶证号" name="licenseNo">
            <Input />
          </Form.Item>
          <Form.Item label="准驾车型" name="licenseType" initialValue="A1">
            <Select
              options={[
                { value: 'A1', label: 'A1 大型客车' },
                { value: 'A2', label: 'A2 牵引车' },
                { value: 'A3', label: 'A3 城市公交车' },
                { value: 'B1', label: 'B1 中型客车' },
              ]}
            />
          </Form.Item>
          <Form.Item label="状态" name="status" initialValue="on_duty">
            <Select
              options={[
                { value: 'on_duty', label: '在岗' },
                { value: 'off_duty', label: '离岗' },
                { value: 'rest', label: '休息' },
              ]}
            />
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

      <Modal title="发起换班申请" open={applyModalOpen} onCancel={() => setApplyModalOpen(false)} footer={null} width={600}>
        <Form form={applyForm} layout="vertical" onFinish={handleSubmitApply}>
          <Form.Item label="选择班次" name="scheduleId" rules={[{ required: true, message: '请选择班次' }]}>
            <Select options={scheduleOptions} placeholder="请选择需要换班的班次" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="新司机" name="newDriverId" rules={[{ required: true, message: '请选择新司机' }]}>
            <Select options={driverOptions} placeholder="请选择替换的司机" showSearch optionFilterProp="label" />
          </Form.Item>
          <Form.Item label="换班原因" name="reason" rules={[{ required: true, message: '请填写换班原因' }]}>
            <TextArea rows={4} placeholder="请详细说明换班原因..." maxLength={200} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setApplyModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="拒绝换班申请" open={rejectModalOpen} onCancel={() => setRejectModalOpen(false)} footer={null} width={500}>
        <Form form={rejectForm} layout="vertical" onFinish={handleSubmitReject}>
          <Form.Item label="拒绝原因" name="rejectionReason" rules={[{ required: true, message: '请填写拒绝原因' }]}>
            <TextArea rows={4} placeholder="请填写拒绝原因，司机会看到此信息..." maxLength={200} showCount />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setRejectModalOpen(false)}>取消</Button>
              <Button danger type="primary" htmlType="submit">
                确认拒绝
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="换班申请详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {detailData && (
          <div>
            <Descriptions title="基本信息" bordered column={2} size="small">
              <Descriptions.Item label="申请编号">{detailData.id}</Descriptions.Item>
              <Descriptions.Item label="申请时间">{dayjs(detailData.createdAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={adjStatusColors[detailData.status]}>{adjStatusLabels[detailData.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="审批人">{detailData.approver || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '16px 0' }} />

            <Descriptions title="班次信息" bordered column={2} size="small">
              <Descriptions.Item label="班次编号">{detailData.schedule_no || '-'}</Descriptions.Item>
              <Descriptions.Item label="路线">{detailData.route_name || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '16px 0' }} />

            <Descriptions title="司机变更" bordered column={2} size="small">
              <Descriptions.Item label="原司机">
                <Tag color="blue">{detailData.old_driver_name || '-'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="新司机">
                <Tag color="cyan">{detailData.new_driver_name || '-'}</Tag>
              </Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '16px 0' }} />

            <Descriptions title="原因说明" bordered column={1} size="small">
              <Descriptions.Item label="申请原因">{detailData.reason}</Descriptions.Item>
              {detailData.rejectionReason && (
                <Descriptions.Item label="拒绝原因">
                  <span style={{ color: '#ff4d4f' }}>{detailData.rejectionReason}</span>
                </Descriptions.Item>
              )}
              {detailData.approvedAt && (
                <Descriptions.Item label="审批时间">{dayjs(detailData.approvedAt).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
              )}
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DriverPage;
