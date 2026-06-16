import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Space, message, Card, Tag, List } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { routeApi } from '../api';
import type { Route, RouteStation } from '../../shared/types';

const RoutePage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [stations, setStations] = useState<Omit<RouteStation, 'id'>[]>([
    { stationName: '', stationAddress: '', sequence: 1, estimatedArrivalTime: '08:00' },
  ]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await routeApi.getAll();
      setRoutes(data);
    } catch (err: any) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddStation = () => {
    setStations([
      ...stations,
      { stationName: '', stationAddress: '', sequence: stations.length + 1, estimatedArrivalTime: '08:00' },
    ]);
  };

  const handleRemoveStation = (index: number) => {
    const newStations = stations.filter((_, i) => i !== index);
    setStations(newStations.map((s, i) => ({ ...s, sequence: i + 1 })));
  };

  const handleStationChange = (index: number, field: string, value: any) => {
    const newStations = [...stations];
    (newStations[index] as any)[field] = value;
    setStations(newStations);
  };

  const handleSubmit = async (values: any) => {
    try {
      const validStations = stations.filter((s) => s.stationName.trim());
      if (validStations.length === 0) {
        message.error('请至少添加一个站点');
        return;
      }
      const payload = { ...values, stations: validStations };
      if (editingId) {
        await routeApi.update(editingId, payload);
      } else {
        await routeApi.create(payload);
      }
      message.success('保存成功');
      setModalOpen(false);
      form.resetFields();
      setEditingId(null);
      setStations([{ stationName: '', stationAddress: '', sequence: 1, estimatedArrivalTime: '08:00' }]);
      loadData();
    } catch (err: any) {
      message.error(err.message);
    }
  };

  const handleEdit = (record: Route) => {
    setEditingId(record.id);
    form.setFieldsValue({
      routeNo: record.routeNo,
      routeName: record.routeName,
      direction: record.direction,
    });
    setStations(record.stations);
    setModalOpen(true);
  };

  const handleDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除该路线?',
      onOk: async () => {
        try {
          await routeApi.remove(id);
          message.success('删除成功');
          loadData();
        } catch (err: any) {
          message.error(err.message);
        }
      },
    });
  };

  const columns = [
    { title: '路线编号', dataIndex: 'routeNo', key: 'routeNo' },
    { title: '路线名称', dataIndex: 'routeName', key: 'routeName' },
    {
      title: '方向',
      dataIndex: 'direction',
      key: 'direction',
      render: (d: string) => <Tag color={d === 'to_company' ? 'blue' : 'green'}>{d === 'to_company' ? '上班' : '下班'}</Tag>,
    },
    {
      title: '站点数',
      dataIndex: 'stations',
      key: 'stations',
      render: (s: RouteStation[]) => s.length + ' 站',
    },
    {
      title: '站点列表',
      dataIndex: 'stations',
      key: 'stationList',
      render: (s: RouteStation[]) => (
        <Space size={4} wrap>
          {s.map((st) => (
            <Tag key={st.id}>{st.sequence}. {st.stationName}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Route) => (
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
        title="路线站点管理"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setEditingId(null);
              form.resetFields();
              setStations([{ stationName: '', stationAddress: '', sequence: 1, estimatedArrivalTime: '08:00' }]);
              setModalOpen(true);
            }}
          >
            新增路线
          </Button>
        }
      >
        <Table columns={columns} dataSource={routes} rowKey="id" loading={loading} />
      </Card>

      <Modal
        title={editingId ? '编辑路线' : '新增路线'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="路线编号" name="routeNo" rules={[{ required: true }]}>
            <Input placeholder="如 R001" />
          </Form.Item>
          <Form.Item label="路线名称" name="routeName" rules={[{ required: true }]}>
            <Input placeholder="如 中关村线(上班)" />
          </Form.Item>
          <Form.Item label="方向" name="direction" rules={[{ required: true }]} initialValue="to_company">
            <Select
              options={[
                { value: 'to_company', label: '上班(前往公司)' },
                { value: 'from_company', label: '下班(离开公司)' },
              ]}
            />
          </Form.Item>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <strong>站点列表</strong>
              <Button size="small" onClick={handleAddStation}>+ 添加站点</Button>
            </div>
            <List
              size="small"
              bordered
              dataSource={stations}
              renderItem={(station, index) => (
                <List.Item
                  key={index}
                  style={{ flexWrap: 'wrap', gap: 8 }}
                  actions={[
                    stations.length > 1 ? (
                      <Button type="link" danger size="small" onClick={() => handleRemoveStation(index)}>
                        删除
                      </Button>
                    ) : null,
                  ]}
                >
                  <div style={{ width: '100%', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ width: 40, paddingTop: 5 }}>#{station.sequence}</div>
                    <Input
                      placeholder="站点名称"
                      value={station.stationName}
                      onChange={(e) => handleStationChange(index, 'stationName', e.target.value)}
                      style={{ width: 150 }}
                    />
                    <Input
                      placeholder="站点地址"
                      value={station.stationAddress}
                      onChange={(e) => handleStationChange(index, 'stationAddress', e.target.value)}
                      style={{ width: 180 }}
                    />
                    <Input
                      placeholder="到达时间"
                      value={station.estimatedArrivalTime}
                      onChange={(e) => handleStationChange(index, 'estimatedArrivalTime', e.target.value)}
                      style={{ width: 100 }}
                      prefix="⏰"
                    />
                  </div>
                </List.Item>
              )}
            />
          </div>

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

export default RoutePage;
