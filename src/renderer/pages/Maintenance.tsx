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
  InputNumber,
  List,
  Progress,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  PlusOutlined,
  CheckOutlined,
  WarningOutlined,
  ToolOutlined,
  TeamOutlined,
  ShoppingOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { maintenanceApi, sparePartApi, teamApi, adjustmentApi, vehicleApi, driverApi, scheduleApi } from '../api';
import type {
  MaintenanceWorkOrder,
  SparePart,
  MaintenanceTeam,
  DriverAdjustment,
  Vehicle,
  Driver,
} from '../../shared/types';

const woStatusColors: Record<string, string> = {
  pending: 'orange',
  in_progress: 'processing',
  completed: 'green',
  cancelled: 'default',
};

const woStatusLabels: Record<string, string> = {
  pending: '待处理',
  in_progress: '处理中',
  completed: '已完成',
  cancelled: '已取消',
};

const adjustStatusColors: Record<string, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
};

const adjustStatusLabels: Record<string, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
};

const MaintenancePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [workOrders, setWorkOrders] = useState<MaintenanceWorkOrder[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [lowStockParts, setLowStockParts] = useState<SparePart[]>([]);
  const [teams, setTeams] = useState<MaintenanceTeam[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [adjustments, setAdjustments] = useState<DriverAdjustment[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  const [woModalOpen, setWoModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [currentWo, setCurrentWo] = useState<MaintenanceWorkOrder | null>(null);
  const [partsUsed, setPartsUsed] = useState<{ partId: number; partName: string; quantity: number; unitPrice: number }[]>([]);
  const [partModalOpen, setPartModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [woForm] = Form.useForm();
  const [partForm] = Form.useForm();
  const [teamForm] = Form.useForm();
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [wo, sp, ls, tm, vh, dr, ad, sc] = await Promise.all([
        maintenanceApi.getAll(),
        sparePartApi.getAll(),
        sparePartApi.getLowStock(),
        teamApi.getAll(),
        vehicleApi.getAll(),
        driverApi.getAll(),
        adjustmentApi.getAll(),
        scheduleApi.getAll(),
      ]);
      setWorkOrders(wo);
      setSpareParts(sp);
      setLowStockParts(ls);
      setTeams(tm);
      setVehicles(vh);
      setDrivers(dr);
      setAdjustments(ad);
      setSchedules(sc);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateWo = async (values: any) => {
    try {
      await maintenanceApi.create({
        ...values,
        workOrderNo: 'WO' + Date.now(),
        partsUsed: [],
      });
      message.success('工单创建成功');
      setWoModalOpen(false);
      woForm.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleCompleteWo = async () => {
    if (!currentWo) return;
    try {
      await maintenanceApi.complete(currentWo.id, partsUsed);
      message.success('工单已完成，库存已更新');
      setCompleteModalOpen(false);
      setCurrentWo(null);
      setPartsUsed([]);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleAddPartUsed = () => {
    setPartsUsed([...partsUsed, { partId: 0, partName: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemovePartUsed = (index: number) => {
    setPartsUsed(partsUsed.filter((_, i) => i !== index));
  };

  const handlePartUsedChange = (index: number, field: string, value: any) => {
    const newParts = [...partsUsed];
    if (field === 'partId') {
      const part = spareParts.find((p) => p.id === value);
      (newParts[index] as any).partId = value;
      (newParts[index] as any).partName = part?.partName || '';
      (newParts[index] as any).unitPrice = part?.unitPrice || 0;
    } else {
      (newParts[index] as any)[field] = value;
    }
    setPartsUsed(newParts);
  };

  const handleCreatePart = async (values: any) => {
    try {
      if (editingPartId) {
        await sparePartApi.update(editingPartId, values);
      } else {
        await sparePartApi.create(values);
      }
      message.success('保存成功');
      setPartModalOpen(false);
      partForm.resetFields();
      setEditingPartId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleCreateTeam = async (values: any) => {
    try {
      if (editingTeamId) {
        await teamApi.update(editingTeamId, values);
      } else {
        await teamApi.create(values);
      }
      message.success('保存成功');
      setTeamModalOpen(false);
      teamForm.resetFields();
      setEditingTeamId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleApproveAdjust = async (id: number) => {
    Modal.confirm({
      title: '确认通过该换班申请?',
      onOk: async () => {
        try {
          await adjustmentApi.approve(id, '系统管理员');
          message.success('已批准');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleRejectAdjust = async (id: number) => {
    Modal.confirm({
      title: '确认拒绝该换班申请?',
      onOk: async () => {
        try {
          await adjustmentApi.reject(id, '系统管理员');
          message.success('已拒绝');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const woColumns = [
    { title: '工单号', dataIndex: 'workOrderNo', key: 'workOrderNo' },
    {
      title: '车辆',
      dataIndex: 'vehicleId',
      key: 'vehicleId',
      render: (id: number) => vehicles.find((v) => v.id === id)?.plateNo || '-',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (t: string) => (t === 'routine' ? '常规保养' : t === 'repair' ? '维修' : '年检'),
    },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    {
      title: '触发里程',
      dataIndex: 'mileageTriggered',
      key: 'mileage',
      render: (m?: number) => (m ? `${m}km` : '-'),
    },
    {
      title: '维修班组',
      dataIndex: 'teamId',
      key: 'teamId',
      render: (id?: number) => teams.find((t) => t.id === id)?.teamName || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={woStatusColors[s]}>{woStatusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MaintenanceWorkOrder) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'in_progress') && (
            <Button
              size="small"
              type="link"
              icon={<CheckOutlined />}
              onClick={() => {
                setCurrentWo(record);
                setPartsUsed([]);
                setCompleteModalOpen(true);
              }}
            >
              完成工单
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const partColumns = [
    { title: '备件编号', dataIndex: 'partNo', key: 'partNo' },
    { title: '备件名称', dataIndex: 'partName', key: 'partName' },
    { title: '分类', dataIndex: 'category', key: 'category' },
    {
      title: '库存',
      dataIndex: 'stock',
      key: 'stock',
      render: (s: number, record: SparePart) => (
        <Space>
          {s}
          {s < record.safetyStock && <Tag color="red" icon={<ExclamationCircleOutlined />}>库存不足</Tag>}
        </Space>
      ),
    },
    { title: '安全库存', dataIndex: 'safetyStock', key: 'safetyStock' },
    { title: '单价(元)', dataIndex: 'unitPrice', key: 'unitPrice' },
    { title: '供应商', dataIndex: 'supplier', key: 'supplier' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: SparePart) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setEditingPartId(record.id);
            partForm.setFieldsValue(record);
            setPartModalOpen(true);
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  const teamColumns = [
    { title: '班组名称', dataIndex: 'teamName', key: 'teamName' },
    { title: '班组长', dataIndex: 'leader', key: 'leader' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    { title: '成员', dataIndex: 'members', key: 'members' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: MaintenanceTeam) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setEditingTeamId(record.id);
            teamForm.setFieldsValue(record);
            setTeamModalOpen(true);
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  const adjustColumns = [
    {
      title: '班次',
      dataIndex: 'scheduleId',
      key: 'scheduleId',
      render: (id: number) => schedules.find((s: any) => s.id === id)?.scheduleNo || '-',
    },
    {
      title: '申请司机',
      dataIndex: 'driverId',
      key: 'driverId',
      render: (id: number) => drivers.find((d) => d.id === id)?.name || '-',
    },
    { title: '申请原因', dataIndex: 'reason', key: 'reason' },
    { title: '审批人', dataIndex: 'approver', key: 'approver', render: (a?: string) => a || '-' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={adjustStatusColors[s]}>{adjustStatusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: DriverAdjustment) =>
        record.status === 'pending' ? (
          <Space size="small">
            <Button size="small" type="primary" onClick={() => handleApproveAdjust(record.id)}>
              通过
            </Button>
            <Button size="small" danger onClick={() => handleRejectAdjust(record.id)}>
              拒绝
            </Button>
          </Space>
        ) : null,
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待处理工单"
              value={workOrders.filter((w) => w.status === 'pending').length}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="处理中工单"
              value={workOrders.filter((w) => w.status === 'in_progress').length}
              prefix={<ToolOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="低库存备件"
              value={lowStockParts.length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="待审批换班"
              value={adjustments.filter((a) => a.status === 'pending').length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'workorder',
              label: (
                <span>
                  <ToolOutlined /> 维保工单
                </span>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        woForm.resetFields();
                        setWoModalOpen(true);
                      }}
                    >
                      新建工单
                    </Button>
                  </div>
                  <Table columns={woColumns} dataSource={workOrders} rowKey="id" loading={loading} />
                </>
              ),
            },
            {
              key: 'parts',
              label: (
                <span>
                  <ShoppingOutlined /> 备件库存
                </span>
              ),
              children: (
                <>
                  {lowStockParts.length > 0 && (
                    <Card
                      type="inner"
                      title={<Tag color="red" icon={<WarningOutlined />}>库存预警</Tag>}
                      style={{ marginBottom: 16 }}
                    >
                      <List
                        size="small"
                        dataSource={lowStockParts}
                        renderItem={(p) => (
                          <List.Item key={p.id}>
                            <Space>
                              <strong>{p.partName}</strong>
                              <span style={{ color: '#ff4d4f' }}>
                                当前库存: {p.stock} / 安全库存: {p.safetyStock}
                              </span>
                              <Progress
                                percent={Math.round((p.stock / p.safetyStock) * 100)}
                                size="small"
                                status="exception"
                                style={{ width: 150 }}
                              />
                            </Space>
                          </List.Item>
                        )}
                      />
                    </Card>
                  )}
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingPartId(null);
                        partForm.resetFields();
                        setPartModalOpen(true);
                      }}
                    >
                      新增备件
                    </Button>
                  </div>
                  <Table columns={partColumns} dataSource={spareParts} rowKey="id" loading={loading} />
                </>
              ),
            },
            {
              key: 'teams',
              label: (
                <span>
                  <TeamOutlined /> 维修班组
                </span>
              ),
              children: (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => {
                        setEditingTeamId(null);
                        teamForm.resetFields();
                        setTeamModalOpen(true);
                      }}
                    >
                      新增班组
                    </Button>
                  </div>
                  <Table columns={teamColumns} dataSource={teams} rowKey="id" loading={loading} />
                </>
              ),
            },
            {
              key: 'adjustments',
              label: (
                <span>
                  <TeamOutlined /> 司机换班审批
                </span>
              ),
              children: <Table columns={adjustColumns} dataSource={adjustments} rowKey="id" loading={loading} />,
            },
          ]}
        />
      </Card>

      <Modal title="新建维保工单" open={woModalOpen} onCancel={() => setWoModalOpen(false)} footer={null} width={500}>
        <Form form={woForm} layout="vertical" onFinish={handleCreateWo}>
          <Form.Item label="车辆" name="vehicleId" rules={[{ required: true }]}>
            <Select
              options={vehicles.map((v) => ({ value: v.id, label: `${v.plateNo} (${v.model})` }))}
            />
          </Form.Item>
          <Form.Item label="类型" name="type" rules={[{ required: true }]} initialValue="routine">
            <Select
              options={[
                { value: 'routine', label: '常规保养' },
                { value: 'repair', label: '故障维修' },
                { value: 'inspection', label: '年度检查' },
              ]}
            />
          </Form.Item>
          <Form.Item label="维修班组" name="teamId" rules={[{ required: true }]}>
            <Select options={teams.map((t) => ({ value: t.id, label: t.teamName }))} />
          </Form.Item>
          <Form.Item label="问题描述" name="description" rules={[{ required: true }]}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setWoModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="完成工单 - 备件使用" open={completeModalOpen} onCancel={() => setCompleteModalOpen(false)} footer={null} width={600}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <strong>使用备件清单</strong>
            <Button size="small" onClick={handleAddPartUsed}>+ 添加备件</Button>
          </div>
          {partsUsed.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px dashed #ddd' }}>暂无备件</div>
          ) : (
            <List
              size="small"
              bordered
              dataSource={partsUsed}
              renderItem={(_, index) => (
                <List.Item
                  key={index}
                  actions={[
                    <Button type="link" danger size="small" onClick={() => handleRemovePartUsed(index)}>
                      删除
                    </Button>,
                  ]}
                >
                  <Space wrap>
                    <Select
                      style={{ width: 200 }}
                      placeholder="选择备件"
                      value={partsUsed[index].partId || undefined}
                      onChange={(v) => handlePartUsedChange(index, 'partId', v)}
                      options={spareParts.map((p) => ({
                        value: p.id,
                        label: `${p.partName} (库存: ${p.stock}, ￥${p.unitPrice})`,
                      }))}
                    />
                    <InputNumber
                      min={1}
                      placeholder="数量"
                      value={partsUsed[index].quantity}
                      onChange={(v) => handlePartUsedChange(index, 'quantity', v)}
                    />
                    <span>小计: ￥{((partsUsed[index].quantity || 0) * (partsUsed[index].unitPrice || 0)).toFixed(2)}</span>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={() => setCompleteModalOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleCompleteWo}>
              确认完成
            </Button>
          </Space>
        </div>
      </Modal>

      <Modal title={editingPartId ? '编辑备件' : '新增备件'} open={partModalOpen} onCancel={() => setPartModalOpen(false)} footer={null} width={500}>
        <Form form={partForm} layout="vertical" onFinish={handleCreatePart}>
          <Form.Item label="备件编号" name="partNo" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="备件名称" name="partName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Select
              options={[
                { value: '发动机件', label: '发动机件' },
                { value: '制动系统', label: '制动系统' },
                { value: '行走系统', label: '行走系统' },
                { value: '车身件', label: '车身件' },
                { value: '电气件', label: '电气件' },
              ]}
            />
          </Form.Item>
          <Form.Item label="当前库存" name="stock" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="安全库存" name="safetyStock" initialValue={10}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="单价(元)" name="unitPrice" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="供应商" name="supplier">
            <Input />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setPartModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={editingTeamId ? '编辑班组' : '新增班组'} open={teamModalOpen} onCancel={() => setTeamModalOpen(false)} footer={null} width={500}>
        <Form form={teamForm} layout="vertical" onFinish={handleCreateTeam}>
          <Form.Item label="班组名称" name="teamName" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="班组长" name="leader">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="成员(逗号分隔)" name="members">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setTeamModalOpen(false)}>取消</Button>
              <Button type="primary" htmlType="submit">
                保存
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default MaintenancePage;
