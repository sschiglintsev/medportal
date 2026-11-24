import { ArrowLeftOutlined } from '@ant-design/icons';
import { Alert, Button, Checkbox, Select, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  fetchTempSheetDepartments,
  fetchTempSheetModuleAccess,
  updateTempSheetModuleAccess,
} from '../Core/services/temp-sheet.service';
import { useAppStore } from '../Core/store/app.store';
import type { TempSheetAccessUser } from '../Core/types/common';
import './TempSheetsPage.scss';

const { Title, Paragraph } = Typography;

type Props = { onBack: () => void };

export function TempSheetAccessPage({ onBack }: Props) {
  const token = useAppStore((s) => s.token)!;
  const [employees, setEmployees] = useState<TempSheetAccessUser[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [departmentFilter, setDepartmentFilter] = useState<string | undefined>();
  const [accessState, setAccessState] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, depts] = await Promise.all([
        fetchTempSheetModuleAccess(token),
        fetchTempSheetDepartments(token),
      ]);
      setEmployees(data);
      setDepartments(depts);
      const state: Record<number, boolean> = {};
      for (const e of data) state[e.user_id] = e.has_access;
      setAccessState(state);
    } catch {
      void message.error('Не удалось загрузить доступы');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredEmployees = useMemo(() => {
    if (!departmentFilter) return employees;
    return employees.filter((e) =>
      (e.departments ?? []).some((name) => name === departmentFilter),
    );
  }, [employees, departmentFilter]);

  const handleSave = async () => {
    const grantUserIds: number[] = [];
    const revokeUserIds: number[] = [];
    for (const emp of employees) {
      const original = emp.has_access;
      const current = accessState[emp.user_id] ?? original;
      if (current && !original) grantUserIds.push(emp.user_id);
      if (!current && original) revokeUserIds.push(emp.user_id);
    }
    if (grantUserIds.length === 0 && revokeUserIds.length === 0) {
      void message.info('Нет изменений');
      return;
    }
    setSaving(true);
    try {
      await updateTempSheetModuleAccess(token, { grantUserIds, revokeUserIds });
      void message.success('Доступы обновлены');
      await load();
    } catch {
      void message.error('Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<TempSheetAccessUser> = [
    { title: 'Сотрудник', dataIndex: 'full_name', key: 'name' },
    {
      title: 'Отделения',
      key: 'depts',
      render: (_, r) => (r.departments?.filter(Boolean).join(', ') || '—'),
    },
    {
      title: 'Доступ',
      key: 'access',
      width: 120,
      render: (_, r) => (
        <Checkbox
          checked={accessState[r.user_id] ?? false}
          onChange={(e) =>
            setAccessState((prev) => ({ ...prev, [r.user_id]: e.target.checked }))
          }
        />
      ),
    },
  ];

  return (
    <div className="temp-sheets-page">
      <div className="temp-sheets-page__toolbar">
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
            Назад
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            Доступ к температурному листу
          </Title>
        </Space>
        <Button type="primary" loading={saving} onClick={() => void handleSave()}>
          Сохранить
        </Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Выдача разрешения сотрудникам"
        description={
          <Paragraph style={{ marginBottom: 0 }}>
            Сотрудник с доступом может создавать и заполнять листы только в своих отделениях.
            Отзыв доступа не удаляет листы и данные. Новых пользователей здесь создавать нельзя.
          </Paragraph>
        }
      />

      <div style={{ marginBottom: 12 }}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Фильтр по отделению"
          style={{ width: 320 }}
          value={departmentFilter}
          onChange={(v) => setDepartmentFilter(v)}
          options={departments.map((d) => ({ value: d.name, label: d.name }))}
        />
      </div>

      <Table
        rowKey="user_id"
        loading={loading}
        columns={columns}
        dataSource={filteredEmployees}
        pagination={{ pageSize: 50, showTotal: (t) => `Всего: ${t}` }}
      />
    </div>
  );
}
