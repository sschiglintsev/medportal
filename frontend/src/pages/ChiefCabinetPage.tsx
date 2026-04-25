import { ToolOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import './ChiefCabinetPage.scss';

export function ChiefCabinetPage() {
  const [activeSection, setActiveSection] = useState<'incidents' | 'it-requests'>('incidents');

  return (
    <section className="chief-cabinet-page">
      <div className="chief-cabinet-page__layout">
        <aside className="chief-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as 'incidents' | 'it-requests')}
            items={[
              { key: 'incidents', icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
            ]}
          />
        </aside>

        <div className="chief-cabinet-page__content">
          <Typography.Title level={4} className="chief-cabinet-page__title">
            {activeSection === 'it-requests' ? 'Заявки в ИТ' : 'Нежелательные события'}
          </Typography.Title>
          {activeSection === 'it-requests' ? (
            <AdminItRequestsPage />
          ) : (
            <IncidentsRegistryPanel hideTitle />
          )}
        </div>
      </div>
    </section>
  );
}
