import { BookOutlined, HeartOutlined } from '@ant-design/icons';
import { Menu, Spin } from 'antd';
import { useEffect, useState } from 'react';

import { MaxLinkCard } from '../components/MaxLinkCard/MaxLinkCard';
import { fetchTempSheetMyAccess } from '../Core/services/temp-sheet.service';
import { useAppStore } from '../Core/store/app.store';
import { EmployeeJournalsPage } from './EmployeeJournalsPage';
import { TempSheetsPage } from './TempSheetsPage';
import './EmployeeCabinetPage.scss';

type Section = 'journals' | 'temp' | 'max';

export function EmployeeCabinetPage() {
  const token = useAppStore((s) => s.token);
  const [section, setSection] = useState<Section>('journals');
  const [tempAccess, setTempAccess] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setTempAccess(false);
      return;
    }
    void fetchTempSheetMyAccess(token)
      .then((a) => setTempAccess(a.hasAccess))
      .catch(() => setTempAccess(false));
  }, [token]);

  const items = [
    { key: 'journals', icon: <BookOutlined />, label: 'Журналы' },
    ...(tempAccess
      ? [{ key: 'temp', icon: <HeartOutlined />, label: 'Температурный лист' }]
      : []),
    { key: 'max', label: 'Уведомления Max' },
  ];

  return (
    <div className="employee-cabinet">
      <Menu
        mode="inline"
        selectedKeys={[section]}
        onSelect={({ key }) => setSection(key as Section)}
        style={{ width: 220, flexShrink: 0 }}
        items={items}
      />
      <div className="employee-cabinet__content">
        {tempAccess === null && section === 'temp' ? (
          <Spin style={{ margin: 48 }} />
        ) : (
          <>
            {section === 'journals' && <EmployeeJournalsPage />}
            {section === 'temp' && tempAccess && <TempSheetsPage />}
            {section === 'max' && <MaxLinkCard />}
          </>
        )}
      </div>
    </div>
  );
}
