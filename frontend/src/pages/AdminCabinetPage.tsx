import { ApartmentOutlined, FileTextOutlined, NotificationOutlined, TagsOutlined, ToolOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { AdminAnnouncementsPage } from './AdminAnnouncementsPage';
import { AdminDepartmentsPage } from './AdminDepartmentsPage';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import { AdminIncidentTypesPage } from './AdminIncidentTypesPage';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import './AdminCabinetPage.scss';

export function AdminCabinetPage() {
  const [activeSection, setActiveSection] = useState('departments');
  const sectionTitle =
    activeSection === 'incident-types'
      ? 'Типы инцидентов'
      : activeSection === 'announcements'
        ? 'Объявления'
        : activeSection === 'documents'
          ? 'Документы'
          : activeSection === 'it-requests'
            ? 'Заявки в ИТ'
        : 'Отделения';

  const content = useMemo(() => {
    if (activeSection === 'it-requests') {
      return <AdminItRequestsPage />;
    }
    if (activeSection === 'documents') {
      return <AdminDocumentsPage />;
    }
    if (activeSection === 'announcements') {
      return <AdminAnnouncementsPage />;
    }
    if (activeSection === 'incident-types') {
      return <AdminIncidentTypesPage />;
    }
    return <AdminDepartmentsPage />;
  }, [activeSection]);

  return (
    <section className="admin-cabinet-page">
      <div className="admin-cabinet-page__layout">
        <aside className="admin-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key)}
            items={[
              { key: 'departments', icon: <ApartmentOutlined />, label: 'Отделения' },
              { key: 'incident-types', icon: <TagsOutlined />, label: 'Типы инцидентов' },
              { key: 'announcements', icon: <NotificationOutlined />, label: 'Объявления' },
              { key: 'documents', icon: <FileTextOutlined />, label: 'Документы' },
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
            ]}
          />
        </aside>

        <div className="admin-cabinet-page__content">
          <Typography.Title level={4} className="admin-cabinet-page__section-title">
            {sectionTitle}
          </Typography.Title>
          {content}
        </div>
      </div>
    </section>
  );
}
