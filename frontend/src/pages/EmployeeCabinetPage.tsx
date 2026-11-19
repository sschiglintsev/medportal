import { BookOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { EmployeeJournalsPage } from './EmployeeJournalsPage';
import './EmployeeCabinetPage.scss';

type Section = 'journals' | 'max';

export function EmployeeCabinetPage() {
  const [section, setSection] = useState<Section>('journals');

  return (
    <div className="employee-cabinet">
      <Menu
        mode="inline"
        selectedKeys={[section]}
        onSelect={({ key }) => setSection(key as Section)}
        style={{ width: 220, flexShrink: 0 }}
        items={[
          { key: 'journals', icon: <BookOutlined />, label: 'Журналы' },
          { key: 'max', label: 'Уведомления Max' },
        ]}
      />
      <div className="employee-cabinet__content">
        {section === 'journals' && <EmployeeJournalsPage />}
        {section === 'max' && <MaxLinkCard />}
      </div>
    </div>
  );
}
