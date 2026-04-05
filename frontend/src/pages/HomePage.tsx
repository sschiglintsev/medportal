import { Card, List, Typography } from 'antd';

import { useReferences } from '../Core/hooks/useReferences';
import { useAppStore } from '../Core/store/app.store';
import './HomePage.scss';

export function HomePage() {
  useReferences();

  const departments = useAppStore((state) => state.departments);
  const incidentTypes = useAppStore((state) => state.incidentTypes);

  return (
    <div className="home-page">
      <Typography.Title level={3}>Справочники</Typography.Title>

      <div className="home-page__grid">
        <Card title="Отделения">
          <List
            dataSource={departments}
            renderItem={(item) => <List.Item key={item.id}>{item.name}</List.Item>}
          />
        </Card>

        <Card title="Типы инцидентов">
          <List
            dataSource={incidentTypes}
            renderItem={(item) => <List.Item key={item.id}>{item.name}</List.Item>}
          />
        </Card>
      </div>
    </div>
  );
}
