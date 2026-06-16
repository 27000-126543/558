import React from 'react';
import { Drawer, List, Tag, Empty, Button } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import type { Alert } from '../../shared/types';

interface Props {
  open: boolean;
  alerts: Alert[];
  onClose: () => void;
  onRead: (id: number) => void;
}

const levelConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  warning: { color: 'orange', icon: <WarningOutlined /> },
  danger: { color: 'red', icon: <ExclamationCircleOutlined /> },
  info: { color: 'blue', icon: <InfoCircleOutlined /> },
};

const typeLabels: Record<string, string> = {
  delay: '延误预警',
  maintenance: '维保提醒',
  stock: '库存预警',
  credit: '信用提醒',
};

const AlertPanel: React.FC<Props> = ({ open, alerts, onClose, onRead }) => {
  return (
    <Drawer title="系统预警通知" placement="right" onClose={onClose} open={open} width={400}>
      {alerts.length === 0 ? (
        <Empty description="暂无未读预警" />
      ) : (
        <List
          dataSource={alerts}
          renderItem={(item) => {
            const cfg = levelConfig[item.level] || levelConfig.info;
            return (
              <List.Item
                key={item.id}
                style={{ alignItems: 'flex-start' }}
                actions={[
                  <Button size="small" type="link" onClick={() => onRead(item.id)}>标记已读</Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<Tag color={cfg.color} icon={cfg.icon} style={{ fontSize: 14 }}>{typeLabels[item.type]}</Tag>}
                  title={<strong>{item.title}</strong>}
                  description={
                    <div>
                      <div style={{ color: '#666', marginBottom: 4 }}>{item.message}</div>
                      <div style={{ color: '#999', fontSize: 12 }}>{item.createdAt}</div>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
};

export default AlertPanel;
