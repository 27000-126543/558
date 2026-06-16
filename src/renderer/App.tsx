import React, { useState, useEffect } from 'react';
import { Layout, Menu, Badge, theme } from 'antd';
import {
  DashboardOutlined,
  CarOutlined,
  UserOutlined,
  TeamOutlined,
  CompassOutlined,
  CalendarOutlined,
  FileTextOutlined,
  ToolOutlined,
  BellOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import RideRequest from './pages/RideRequest';
import Schedule from './pages/Schedule';
import Vehicle from './pages/Vehicle';
import Employee from './pages/Employee';
import Driver from './pages/Driver';
import Route from './pages/Route';
import Maintenance from './pages/Maintenance';
import Report from './pages/Report';
import AlertPanel from './components/AlertPanel';
import type { Alert } from '../shared/types';
import { alertApi } from './api';

const { Header, Sider, Content } = Layout;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKey, setSelectedKey] = useState('dashboard');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertOpen, setAlertOpen] = useState(false);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const loadAlerts = async () => {
    try {
      const data = await alertApi.getUnread();
      setAlerts(data);
    } catch {}
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const menuItems = [
    { key: 'dashboard', icon: <DashboardOutlined />, label: '数据仪表盘' },
    { key: 'rideRequest', icon: <SafetyCertificateOutlined />, label: '乘车申请管理' },
    { key: 'schedule', icon: <CalendarOutlined />, label: '班车调度管理' },
    { key: 'route', icon: <CompassOutlined />, label: '路线站点管理' },
    { key: 'vehicle', icon: <CarOutlined />, label: '车辆管理' },
    { key: 'driver', icon: <TeamOutlined />, label: '司机管理' },
    { key: 'employee', icon: <UserOutlined />, label: '员工管理' },
    { key: 'maintenance', icon: <ToolOutlined />, label: '车辆维保管理' },
    { key: 'report', icon: <FileTextOutlined />, label: '统计报表' },
  ];

  const renderContent = () => {
    switch (selectedKey) {
      case 'dashboard': return <Dashboard onRefresh={loadAlerts} />;
      case 'rideRequest': return <RideRequest onRefreshAlerts={loadAlerts} />;
      case 'schedule': return <Schedule onRefreshAlerts={loadAlerts} />;
      case 'route': return <Route />;
      case 'vehicle': return <Vehicle />;
      case 'driver': return <Driver onRefreshAlerts={loadAlerts} />;
      case 'employee': return <Employee />;
      case 'maintenance': return <Maintenance />;
      case 'report': return <Report />;
      default: return <Dashboard onRefresh={loadAlerts} />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 14 : 16,
          fontWeight: 'bold',
          background: 'rgba(255,255,255,0.1)',
          margin: 16,
          borderRadius: 8,
        }}>
          {collapsed ? '班车' : '企业班车管理'}
        </div>
        <Menu
          theme="dark"
          selectedKeys={[selectedKey]}
          mode="inline"
          items={menuItems}
          onClick={({ key }) => setSelectedKey(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: colorBgContainer, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>{menuItems.find(m => m.key === selectedKey)?.label}</h2>
          <Badge count={alerts.length} offset={[-5, 5]}>
            <BellOutlined
              style={{ fontSize: 20, cursor: 'pointer', color: alerts.length > 0 ? '#ff4d4f' : '#666' }}
              onClick={() => setAlertOpen(true)}
            />
          </Badge>
        </Header>
        <Content style={{ margin: '16px', padding: 24, background: colorBgContainer, borderRadius: borderRadiusLG, overflow: 'auto' }}>
          {renderContent()}
        </Content>
      </Layout>
      <AlertPanel
        open={alertOpen}
        alerts={alerts}
        onClose={() => { setAlertOpen(false); loadAlerts(); }}
        onRead={(id) => alertApi.markRead(id).then(loadAlerts)}
      />
    </Layout>
  );
};

export default App;
