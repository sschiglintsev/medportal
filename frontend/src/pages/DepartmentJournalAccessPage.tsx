import { Alert, Button, Checkbox, Select, Space, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import {
  fetchDepartmentAccess,
  fetchJournalDepartments,
  updateDepartmentAccess,
} from '../Core/services/journal-access.service';
import { useAppStore } from '../Core/store/app.store';
import type { DepartmentAccessEmployee } from '../Core/types/common';
import './DepartmentJournalAccessPage.scss';

const { Title, Paragraph } = Typography;

type AccessState = { [userId: number]: boolean };

export function DepartmentJournalAccessPage() {
  const token = useAppStore((s) => s.token)!;

  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedDept, setSelectedDept] = useState<number | null>(null);
  const [employees, setEmployees] = useState<DepartmentAccessEmployee[]>([]);
  const [accessState, setAccessState] = useState<AccessState>({});
  const [accessVersion, setAccessVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchJournalDepartments(token)
      .then(setDepartments)
      .catch(() => {});
  }, [token]);

  const loadAccess = useCallback(
    async (deptId: number) => {
      setLoading(true);
      try {
        const data = await fetchDepartmentAccess(deptId, token);
        setEmployees(data.employees);
        setAccessVersion(data.accessVersion);
        const state: AccessState = {};
        for (const e of data.employees) {
          state[e.user_id] = e.has_access;
        }
        setAccessState(state);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  const handleDeptChange = (deptId: number) => {
    setSelectedDept(deptId);
    setEmployees([]);
    setAccessState({});
    void loadAccess(deptId);
  };

  const handleSave = async () => {
    if (!selectedDept) return;

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
      await updateDepartmentAccess(
        selectedDept,
        { expectedVersion: accessVersion, grantUserIds, revokeUserIds },
        token,
      );
      void message.success('Допуск обновлён');
      void loadAccess(selectedDept);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка сохранения';
      void message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const columns: ColumnsType<DepartmentAccessEmployee> = [
    { title: 'ФИО', dataIndex: 'full_name', key: 'name' },
    { title: 'Должность', dataIndex: 'position', key: 'pos' },
    {
      title: 'Допуск к журналам',
      key: 'access',
      render: (_: unknown, emp: DepartmentAccessEmployee) => (
        <Checkbox
          checked={accessState[emp.user_id] ?? emp.has_access}
          onChange={(e) =>
            setAccessState((prev) => ({ ...prev, [emp.user_id]: e.target.checked }))
          }
        />
      ),
    },
  ];

  const changeCount = employees.filter(
    (e) => (accessState[e.user_id] ?? e.has_access) !== e.has_access,
  ).length;

  return (
    <div className="dept-access-page">
      <Title level={4}>Доступ к журналам отделений</Title>

      <Alert
        type="info"
        showIcon
        message="Настройка применяется ко всем журналам выбранного отделения"
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Выберите отделение"
          style={{ minWidth: 240 }}
          onChange={handleDeptChange}
          options={departments.map((d) => ({ label: d.name, value: d.id }))}
        />
      </Space>

      {selectedDept && (
        <>
          <Table
            dataSource={employees}
            rowKey="user_id"
            columns={columns}
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: 'Нет сотрудников в этом отделении' }}
          />

          <div style={{ marginTop: 16 }}>
            {changeCount > 0 && (
              <Paragraph type="secondary" style={{ marginBottom: 8 }}>
                Изменений: {changeCount}
              </Paragraph>
            )}
            <Button type="primary" onClick={() => void handleSave()} loading={saving}>
              Сохранить
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
