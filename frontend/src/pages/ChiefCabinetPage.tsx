import { ExperimentOutlined, HomeOutlined, ToolOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { AdminAhchRequestsPage } from './AdminAhchRequestsPage';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import { AdminMetrologistRequestsPage } from './AdminMetrologistRequestsPage';
import './ChiefCabinetPage.scss';

type Section = 'incidents' | 'it-requests' | 'metrologist-requests' | 'ahch-requests';

const SECTION_TITLES: Record<Section, string> = {
  incidents: 'Нежелательные события',
  'it-requests': 'Заявки в ИТ',
  'metrologist-requests': 'Заявки метрологу',
  'ahch-requests': 'Заявки в АХЧ',
};

export function ChiefCabinetPage() {
  const [activeSection, setActiveSection] = useState<Section>('incidents');

  return (
    <section className="chief-cabinet-page">
      <div className="chief-cabinet-page__layout">
        <aside className="chief-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as Section)}
            items={[
              { key: 'incidents', icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
              { key: 'metrologist-requests', icon: <ExperimentOutlined />, label: 'Заявки метрологу' },
              { key: 'ahch-requests', icon: <HomeOutlined />, label: 'Заявки в АХЧ' },
            ]}
          />
        </aside>

        <div className="chief-cabinet-page__content">
          <Typography.Title level={4} className="chief-cabinet-page__title">
            {SECTION_TITLES[activeSection]}
          </Typography.Title>
          {activeSection === 'it-requests' && <AdminItRequestsPage />}
          {activeSection === 'metrologist-requests' && <AdminMetrologistRequestsPage />}
          {activeSection === 'ahch-requests' && <AdminAhchRequestsPage />}
          {activeSection === 'incidents' && <IncidentsRegistryPanel hideTitle />}
        </div>
      </div>
    </section>
  );
}
