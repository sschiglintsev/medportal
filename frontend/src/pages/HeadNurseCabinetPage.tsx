import { BookOutlined, HeartOutlined, TeamOutlined } from '@ant-design/icons';
import { Menu } from 'antd';
import { useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { DepartmentJournalAccessPage } from './DepartmentJournalAccessPage';
import { ManagedJournalsPage } from './ManagedJournalsPage';
import { TempSheetsPage } from './TempSheetsPage';
import './HeadNurseCabinetPage.scss';

type Section = 'journals' | 'access' | 'temp' | 'max';

export function HeadNurseCabinetPage() {
  const [section, setSection] = useState<Section>('journals');

  return (
    <div className="head-nurse-cabinet">
      <Menu
        mode="inline"
        selectedKeys={[section]}
        onSelect={({ key }) => setSection(key as Section)}
        style={{ width: 220, flexShrink: 0 }}
        items={[
          { key: 'journals', icon: <BookOutlined />, label: 'Мои журналы' },
          { key: 'access', icon: <TeamOutlined />, label: 'Доступ к журналам отделений' },
          { key: 'temp', icon: <HeartOutlined />, label: 'Температурный лист' },
          { key: 'max', label: 'Уведомления Max' },
        ]}
      />
      <div className="head-nurse-cabinet__content">
        {section === 'journals' && <ManagedJournalsPage />}
        {section === 'access' && <DepartmentJournalAccessPage />}
        {section === 'temp' && <TempSheetsPage />}
        {section === 'max' && <MaxLinkCard />}
      </div>
    </div>
  );
}
