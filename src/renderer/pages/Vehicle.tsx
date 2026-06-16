import React, { useEffect, useState, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Card, Tag, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ToolOutlined } from '@ant-design/icons';
import { vehicleApi } from '../api';
import type { Vehicle } from '../../shared/types';

const statusColors: Record<string, string> = {
  idle: 'default',
  running: 'processing',
  maintenance: 'warning',
  disabled: 'error',
};

const statusLabels: Record<string, string> = {
  idle: '空闲',
  running: '运行中',
  maintenance: '维保中',
  disabled: '故障',
};

const VehiclePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [mileageModalOpen, setMileageModalOpen] = useState(false);
  const [returnVehicle, setReturnVehicle] = useState<Vehicle | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [mileageForm] = Form.useForm();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await vehicleApi.getAll();
      setVehicles(data);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (values: any) => {
    try {
      if (editingId) {
        await vehicleApi.update(editingId, values);
      } else {
        await vehicleApi.create(values);
      }
      message.success('保存成功');
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleEdit = (record: Vehicle) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除该车辆?',
      onOk: async () => {
        try {
          await vehicleApi.remove(id);
          message.success('删除成功');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleDepart = async (id: number) => {
    try {
      await vehicleApi.updateStatus(id, 'running');
      message.success('车辆已发车');
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleReturnClick = (record: Vehicle) => {
    setReturnVehicle(record);
    mileageForm.setFieldsValue({ mileage: 50 });
    setMileageModalOpen(true);
  };

  const handleReturnSubmit = async (values: any) => {
    if (!returnVehicle) return;
    try {
      const newMileage = returnVehicle.mileage + (values.mileage || 0);
      await vehicleApi.updateStatus(returnVehicle.id, 'idle', newMileage);
      message.success(`车辆已归队，新增里程${values.mileage}km，总里程${newMileage}km`);
      setMileageModalOpen(false);
      setReturnVehicle(null);
      mileageForm.resetFields();
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const columns = [
    { title: '车牌号', dataIndex: 'plateNo', key: 'plateNo', render: (t: string) => <strong>{t}</strong> },
    { title: '车型', dataIndex: 'model', key: 'model' },
    { title: '座位数', dataIndex: 'capacity', key: 'capacity' },
    {
      title: '行驶里程',
      dataIndex: 'mileage',
      key: 'mileage',
      render: (m: number) => `${m.toLocaleString()} km`,
    },
    {
      title: '维保进度',
      key: 'maintenance',
      render: (_: any, record: Vehicle) => {
        const ratio = Math.min(100, (record.mileage / record.nextMaintenanceMileage) * 100);
        return (
          <Progress
            percent={Math.round(ratio)}
            size="small"
            status={ratio >= 90 ? 'exception' : ratio >= 70 ? 'active' : undefined}
          />
        );
      },
    },
    {
      title: '下次维保里程',
      dataIndex: 'nextMaintenanceMileage',
      key: 'next',
      render: (m: number) => `${m.toLocaleString()} km`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Vehicle) => (
        <Space size="small">
          {record.status === 'idle' && (
            <Button
              size="small"
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleDepart(record.id)}
            >
              发车
            </Button>
          )}
          {record.status === 'running' && (
            <Button
              size="small"
              type="link"
              icon={<ToolOutlined />}
              onClick={() => handleReturnClick(record)}
            >
              归队
            </Button>
          )}
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

  return (
    <div>
      <Card
        title="车辆管理"
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
            新增车辆
          </Button>
        }
      >
        <Table columns={columns} dataSource={vehicles} rowKey="id" loading={loading} />
      </Card>

      <Modal title={editingId ? '编辑车辆' : '新增车辆'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="车牌号" name="plateNo" rules={[{ required: true }]}>
            <Input placeholder="如 京A12345" />
          </Form.Item>
          <Form.Item label="车型" name="model">
            <Input placeholder="如 宇通客车ZK6115" />
          </Form.Item>
          <Form.Item label="座位数" name="capacity" initialValue={45}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="当前里程(km)" name="mileage" initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="下次维保里程(km)" name="nextMaintenanceMileage" initialValue={5000}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" initialValue="idle">
            <Select
              options={[
                { value: 'idle', label: '空闲' },
                { value: 'running', label: '运行中' },
                { value: 'maintenance', label: '维保中' },
                { value: 'disabled', label: '故障' },
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

      <Modal
        title={`车辆归队 - ${returnVehicle?.plateNo || ''}`}
        open={mileageModalOpen}
        onCancel={() => { setMileageModalOpen(false); setReturnVehicle(null); }}
        footer={null}
        width={400}
      >
        {returnVehicle && (
          <div style={{ marginBottom: 16, color: '#666' }}>
            当前里程：{returnVehicle.mileage.toLocaleString()} km | 下次维保：{returnVehicle.nextMaintenanceMileage.toLocaleString()} km
          </div>
        )}
        <Form form={mileageForm} layout="vertical" onFinish={handleReturnSubmit}>
          <Form.Item label="本次行驶里程(km)" name="mileage" rules={[{ required: true, message: '请输入行驶里程' }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="输入本次行驶公里数" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setMileageModalOpen(false); setReturnVehicle(null); }}>取消</Button>
              <Button type="primary" htmlType="submit">确认归队</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VehiclePage;
