import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Card, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { driverApi } from '../api';
import type { Driver } from '../../shared/types';

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

const DriverPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
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

  useEffect(() => {
    loadData();
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
      loadData();
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
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
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

  return (
    <div>
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
    </div>
  );
};

export default DriverPage;
