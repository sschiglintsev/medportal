import { ToolOutlined } from '@ant-design/icons';
import { Menu, Typography } from 'antd';

import { AdminItRequestsPage } from './AdminItRequestsPage';
import './ItDepartmentCabinetPage.scss';

export function ItDepartmentCabinetPage() {
  return (
    <section className="it-dept-cabinet-page">
      <div className="it-dept-cabinet-page__layout">
        <aside className="it-dept-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={['it-requests']}
            items={[
              { key: 'it-requests', icon: <ToolOutlined />, label: 'Заявки в ИТ' },
            ]}
          />
        </aside>

        <div className="it-dept-cabinet-page__content">
          <Typography.Title level={4} className="it-dept-cabinet-page__title">
            Заявки в ИТ
          </Typography.Title>
          <AdminItRequestsPage />
        </div>
      </div>
    </section>
  );
}
