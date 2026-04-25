import {
  ApartmentOutlined,
  FileTextOutlined,
  NotificationOutlined,
  SettingOutlined,
  TagsOutlined,
  TeamOutlined,
  ToolOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Menu, Typography } from 'antd';
import { useMemo, useState } from 'react';

import { IncidentsRegistryPanel } from '../components/IncidentsRegistryPanel/IncidentsRegistryPanel';
import { AdminAnnouncementsPage } from './AdminAnnouncementsPage';
import { AdminDepartmentsPage } from './AdminDepartmentsPage';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import { AdminIncidentTypesPage } from './AdminIncidentTypesPage';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import { AdminOrganizationPage } from './AdminOrganizationPage';
import { AdminUsersPage } from './AdminUsersPage';
import './AdminCabinetPage.scss';

type Section =
  | 'departments'
  | 'incident-types'
  | 'announcements'
  | 'documents'
  | 'it-requests'
  | 'incidents'
  | 'users'
  | 'organization';

const SECTION_TITLES: Record<Section, string> = {
  departments: 'Отделения',
  'incident-types': 'Типы инцидентов',
  announcements: 'Объявления',
  documents: 'Документы',
  'it-requests': 'Заявки в ИТ',
  incidents: 'Нежелательные события',
  users: 'Пользователи',
  organization: 'Профиль организации',
};

export function AdminCabinetPage() {
  const [activeSection, setActiveSection] = useState<Section>('departments');

  const content = useMemo(() => {
    switch (activeSection) {
      case 'it-requests':
        return <AdminItRequestsPage />;
      case 'documents':
        return <AdminDocumentsPage />;
      case 'announcements':
        return <AdminAnnouncementsPage />;
      case 'incident-types':
        return <AdminIncidentTypesPage />;
      case 'incidents':
        return <IncidentsRegistryPanel hideTitle />;
      case 'users':
        return <AdminUsersPage />;
      case 'organization':
        return <AdminOrganizationPage />;
      default:
        return <AdminDepartmentsPage />;
    }
  }, [activeSection]);

  return (
    <section className="admin-cabinet-page">
      <div className="admin-cabinet-page__layout">
        <aside className="admin-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key as Section)}
            items={[
              { key: 'departments', icon: <ApartmentOutlined />, label: 'Отделения' },
              { key: 'incident-types', icon: <TagsOutlined />, label: 'Типы инцидентов' },
              { key: 'announcements', icon: <NotificationOutlined />, label: 'Объявления' },
              { key: 'documents', icon: <FileTextOutlined />, label: 'Документы' },
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
              { key: 'incidents', icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
              { type: 'divider' },
              { key: 'users', icon: <TeamOutlined />, label: 'Пользователи' },
              { key: 'organization', icon: <SettingOutlined />, label: 'Профиль организации' },
            ]}
          />
        </aside>

        <div className="admin-cabinet-page__content">
          <Typography.Title level={4} className="admin-cabinet-page__section-title">
            {SECTION_TITLES[activeSection]}
          </Typography.Title>
          {content}
        </div>
      </div>
    </section>
  );
}
