import { FileTextOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useEffect, useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { useAppStore } from '../Core/store/app.store';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import './QualityControlCabinetPage.scss';

export function QualityControlCabinetPage() {
  const canManageDocuments = useAppStore((state) => state.user?.permissions?.canManageDocuments);
  const [activeSection, setActiveSection] = useState<'incidents' | 'documents'>('incidents');

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
          ) : (
            <IncidentsRegistryPanel />
          )}
        </div>
      </div>
    </section>
  );
}
