import { BellOutlined, FileTextOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { useAppStore } from '../Core/store/app.store';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import './QualityControlCabinetPage.scss';

type Section = 'incidents' | 'documents' | 'notifications';

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
            onClick={({ key }) => setActiveSection(key as 'incidents' | 'documents')}
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
          ) : (
            <IncidentsRegistryPanel />
          )}
        </div>
      </div>
    </section>
  );
}
