import { BellOutlined, FileTextOutlined, OrderedListOutlined, TagsOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { useAppStore } from '../Core/store/app.store';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import { AdminIncidentTypesPage } from './AdminIncidentTypesPage';
import { AdminIncidentViewTypesPage } from './AdminIncidentViewTypesPage';
import './QualityControlCabinetPage.scss';

type Section = 'incidents' | 'incident-types' | 'incident-view-types' | 'documents' | 'notifications';

export function QualityControlCabinetPage() {
  const canManageDocuments = useAppStore((state) => state.user?.permissions?.canManageDocuments);
  const [activeSection, setActiveSection] = useState<Section>('incidents');

  useEffect(() => {
    if (activeSection === 'documents' && !canManageDocuments) {
      setActiveSection('incidents');
    }
  }, [activeSection, canManageDocuments]);

  const menuItems = [
    { key: 'incidents' as const, icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
    { key: 'incident-types' as const, icon: <TagsOutlined />, label: 'Типы инцидентов' },
    { key: 'incident-view-types' as const, icon: <OrderedListOutlined />, label: 'Вид нежелательных событий' },
    ...(canManageDocuments
      ? [{ key: 'documents' as const, icon: <FileTextOutlined />, label: 'Документы' }]
      : []),
    { key: 'notifications' as const, icon: <BellOutlined />, label: 'Уведомления Max' },
  ];

  return (
    <section className="quality-control-cabinet-page">
      <div className="quality-control-cabinet-page__layout">
        <aside className="quality-control-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as Section)}
            items={menuItems}
          />
        </aside>

        <div className="quality-control-cabinet-page__content">
          {activeSection === 'documents' && canManageDocuments ? (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Документы
              </Typography.Title>
              <AdminDocumentsPage />
            </>
          ) : activeSection === 'notifications' ? (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Уведомления Max
              </Typography.Title>
              <MaxLinkCard />
            </>
          ) : activeSection === 'incident-types' ? (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Типы инцидентов
              </Typography.Title>
              <AdminIncidentTypesPage />
            </>
          ) : activeSection === 'incident-view-types' ? (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Вид нежелательных событий
              </Typography.Title>
              <AdminIncidentViewTypesPage />
            </>
          ) : (
            <IncidentsRegistryPanel />
          )}
        </div>
      </div>
    </section>
  );
}
