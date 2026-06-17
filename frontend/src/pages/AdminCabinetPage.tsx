import {
  ApartmentOutlined,
  BarChartOutlined,
  CarOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  HomeOutlined,
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
import { AdminIncidentViewTypesPage } from './AdminIncidentViewTypesPage';
import { AdminAhchRequestsPage } from './AdminAhchRequestsPage';
import { AdminItRequestsPage } from './AdminItRequestsPage';
import { AdminMetrologistRequestsPage } from './AdminMetrologistRequestsPage';
import { AdminTransportRequestsPage } from './AdminTransportRequestsPage';
import { AdminVehiclesPage } from './AdminVehiclesPage';
import { AdminOrganizationPage } from './AdminOrganizationPage';
import { AdminUsersPage } from './AdminUsersPage';
import { AnalyticsPage } from './AnalyticsPage';
import './AdminCabinetPage.scss';

type Section =
  | 'departments'
  | 'incident-types'
  | 'incident-view-types'
  | 'announcements'
  | 'documents'
  | 'it-requests'
  | 'metrologist-requests'
  | 'ahch-requests'
  | 'transport-requests'
  | 'vehicles'
  | 'incidents'
  | 'users'
  | 'organization'
  | 'analytics';

const SECTION_TITLES: Record<Section, string> = {
  departments: 'Отделения',
  'incident-types': 'Типы инцидентов',
  'incident-view-types': 'Вид нежелательных событий',
  announcements: 'Объявления',
  documents: 'Документы',
  'it-requests': 'Заявки в ИТ',
  'metrologist-requests': 'Заявки метрологу',
  'ahch-requests': 'Заявки в АХЧ',
  'transport-requests': 'Транспортные заявки',
  vehicles: 'Автомобили',
  incidents: 'Нежелательные события',
  users: 'Пользователи',
  organization: 'Профиль организации',
  analytics: 'Аналитика',
};

export function AdminCabinetPage() {
  const [activeSection, setActiveSection] = useState<Section>('departments');

  const content = useMemo(() => {
    switch (activeSection) {
      case 'it-requests':
        return <AdminItRequestsPage />;
      case 'metrologist-requests':
        return <AdminMetrologistRequestsPage />;
      case 'ahch-requests':
        return <AdminAhchRequestsPage />;
      case 'transport-requests':
        return <AdminTransportRequestsPage />;
      case 'vehicles':
        return <AdminVehiclesPage />;
      case 'documents':
        return <AdminDocumentsPage />;
      case 'announcements':
        return <AdminAnnouncementsPage />;
      case 'incident-types':
        return <AdminIncidentTypesPage />;
      case 'incident-view-types':
        return <AdminIncidentViewTypesPage />;
      case 'incidents':
        return <IncidentsRegistryPanel hideTitle />;
      case 'analytics':
        return <AnalyticsPage />;
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
              { key: 'incident-view-types', icon: <UnorderedListOutlined />, label: 'Вид нежелательных событий' },
              { key: 'announcements', icon: <NotificationOutlined />, label: 'Объявления' },
              { key: 'documents', icon: <FileTextOutlined />, label: 'Документы' },
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
              { key: 'metrologist-requests', icon: <ExperimentOutlined />, label: 'Заявки метрологу' },
              { key: 'ahch-requests', icon: <HomeOutlined />, label: 'Заявки в АХЧ' },
              { key: 'transport-requests', icon: <CarOutlined />, label: 'Транспортные заявки' },
              { key: 'vehicles', icon: <CarOutlined />, label: 'Автомобили' },
              { key: 'incidents', icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
              { key: 'analytics', icon: <BarChartOutlined />, label: 'Аналитика' },
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
