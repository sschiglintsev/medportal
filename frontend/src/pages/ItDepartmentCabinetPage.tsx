import { BellOutlined, ToolOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import './ItDepartmentCabinetPage.scss';

type Section = 'it-requests' | 'notifications';

export function ItDepartmentCabinetPage() {
  const [activeSection, setActiveSection] = useState<Section>('it-requests');

  return (
    <section className="it-dept-cabinet-page">
      <div className="it-dept-cabinet-page__layout">
        <aside className="it-dept-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as Section)}
            items={[
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
              { key: 'notifications', icon: <BellOutlined />, label: 'Уведомления Max' },
            ]}
          />
        </aside>

        <div className="it-dept-cabinet-page__content">
          {activeSection === 'notifications' ? (
            <>
              <Typography.Title level={4} className="it-dept-cabinet-page__title">
                Уведомления Max
              </Typography.Title>
              <MaxLinkCard />
            </>
          ) : (
            <>
              <Typography.Title level={4} className="it-dept-cabinet-page__title">
                Заявки в ИТ
              </Typography.Title>
              <AdminItRequestsPage />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
