import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Space, message, Card, Tag, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { employeeApi } from '../api';
import type { Employee } from '../../shared/types';

const EmployeePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await employeeApi.getAll();
      setEmployees(data);
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
        await employeeApi.update(editingId, values);
      } else {
        await employeeApi.create(values);
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

  const handleEdit = (record: Employee) => {
    setEditingId(record.id);
    form.setFieldsValue(record);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除该员工?',
      onOk: async () => {
        try {
          await employeeApi.remove(id);
          message.success('删除成功');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const handleValidate = async (id: number) => {
    try {
      const result = await employeeApi.validate(id, 'to_company');
      if (result.valid) {
        Modal.success({ title: '校验通过', content: '该员工符合乘车条件' });
      } else {
        Modal.error({ title: '校验未通过', content: result.reason });
      }
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const getCreditColor = (score: number) => {
    if (score >= 90) return '#52c41a';
    if (score >= 70) return '#1677ff';
    if (score >= 60) return '#fa8c16';
    return '#ff4d4f';
  };

  const columns = [
    { title: '工号', dataIndex: 'employeeNo', key: 'employeeNo' },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { title: '职位', dataIndex: 'position', key: 'position' },
    { title: '联系电话', dataIndex: 'phone', key: 'phone' },
    {
      title: '信用分',
      dataIndex: 'creditScore',
      key: 'creditScore',
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={getCreditColor(score)}
          format={(p) => <span style={{ color: getCreditColor(score) }}>{p}分</span>}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={s === 'active' ? 'green' : 'default'}>{s === 'active' ? '在职' : '离职'}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Employee) => (
        <Space size="small">
          <Button size="small" type="link" icon={<SafetyOutlined />} onClick={() => handleValidate(record.id)}>
            乘车校验
          </Button>
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
        title="员工管理"
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
            新增员工
          </Button>
        }
      >
        <Table columns={columns} dataSource={employees} rowKey="id" loading={loading} />
      </Card>

      <Modal title={editingId ? '编辑员工' : '新增员工'} open={modalOpen} onCancel={() => setModalOpen(false)} footer={null} width={500}>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="工号" name="employeeNo" rules={[{ required: true }]}>
            <Input placeholder="如 E001" />
          </Form.Item>
          <Form.Item label="姓名" name="name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item label="部门" name="department" rules={[{ required: true }]}>
            <Select
              mode={undefined}
              allowClear
              options={[
                { value: '技术部', label: '技术部' },
                { value: '市场部', label: '市场部' },
                { value: '人事部', label: '人事部' },
                { value: '财务部', label: '财务部' },
                { value: '运营部', label: '运营部' },
                { value: '行政部', label: '行政部' },
              ]}
            />
          </Form.Item>
          <Form.Item label="职位" name="position">
            <Input />
          </Form.Item>
          <Form.Item label="联系电话" name="phone">
            <Input />
          </Form.Item>
          <Form.Item label="信用分" name="creditScore" initialValue={100}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="状态" name="status" initialValue="active">
            <Select
              options={[
                { value: 'active', label: '在职' },
                { value: 'inactive', label: '离职' },
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

export default EmployeePage;
