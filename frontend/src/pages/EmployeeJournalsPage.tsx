import { Table, Select, Space, Typography, Tag, Button, Modal, Form, Input, DatePicker, Alert, Empty } from 'antd';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';

import { fetchJournalDepartments } from '../Core/services/journal-access.service';
import {
  confirmJournalRow,
  fetchJournal,
  fetchJournalRows,
  fetchJournals,
} from '../Core/services/journal.service';
import { useAppStore } from '../Core/store/app.store';
import type { Journal, JournalColumn, JournalRow } from '../Core/types/common';
import './EmployeeJournalsPage.scss';

const { Title, Text } = Typography;

/** Кабинет сотрудника — просмотр и подтверждение строк журналов */
export function EmployeeJournalsPage() {
  const token = useAppStore((s) => s.token)!;

  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [selectedDept, setSelectedDept] = useState<number | undefined>();
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [columns, setColumns] = useState<JournalColumn[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmRow, setConfirmRow] = useState<JournalRow | null>(null);
  const [password, setPassword] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  /** Значения для editable-колонок, заполняемых сотрудником при подтверждении */
  const [editableValues, setEditableValues] = useState<Record<string, string>>({});

  useEffect(() => {
    void fetchJournalDepartments(token)
      .then(setDepartments)
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void fetchJournals(token, 'available')
      .then(setJournals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filteredJournals = selectedDept
    ? journals.filter((j) => j.department_id === selectedDept)
    : journals;

  const openJournal = useCallback(
    async (journal: Journal) => {
      setRowsLoading(true);
      try {
        const full = await fetchJournal(journal.id, token);
        setSelectedJournal(full);
        setColumns((full.columns ?? []).filter((c) => c.type !== 'confirmation'));
        const data = await fetchJournalRows(journal.id, token);
        setRows(data.rows);
      } catch {
        // ignore
      } finally {
        setRowsLoading(false);
      }
    },
    [token],
  );

  const openConfirm = (row: JournalRow) => {
    setConfirmRow(row);
    setPassword('');
    setConfirmError(null);
    // Предзаполняем editable-поля текущими значениями строки
    const initVals: Record<string, string> = {};
    for (const col of columns) {
      if (col.is_editable_by_employee) {
        initVals[col.id] = row.values?.[col.id] ?? '';
      }
    }
    setEditableValues(initVals);
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    if (!confirmRow || !selectedJournal || !password) return;
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      const idempKey = `confirm_${confirmRow.id}_${confirmRow.current_revision}_${Date.now()}`;

      // Собираем значения editable-колонок (пустые строки → null)
      const hasEditables = columns.some((c) => c.is_editable_by_employee);
      const payload: Parameters<typeof confirmJournalRow>[2] = {
        expectedRevision: confirmRow.current_revision,
        password,
        idempotencyKey: idempKey,
      };
      if (hasEditables) {
        const ev: Record<string, string | null> = {};
        for (const col of columns) {
          if (col.is_editable_by_employee) {
            const raw = editableValues[col.id] ?? '';
            ev[col.id] = raw === '' ? null : raw;
          }
        }
        payload.editableValues = ev;
      }

      await confirmJournalRow(selectedJournal.id, confirmRow.id, payload, token);
      setConfirmOpen(false);
      setPassword('');
      setEditableValues({});
      // Перезагружаем строки
      const data = await fetchJournalRows(selectedJournal.id, token);
      setRows(data.rows);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string; code?: string } } })?.response?.data?.message
        ?? 'Ошибка подтверждения';
      setConfirmError(msg);
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCloseConfirm = () => {
    setConfirmOpen(false);
    setPassword('');
    setConfirmError(null);
    setEditableValues({});
  };

  // Динамические колонки таблицы строк
  const tableColumns: ColumnsType<JournalRow> = [
    ...columns.map((col) => ({
      key: col.id,
      title: col.title,
      dataIndex: col.id,
      render: (_: unknown, row: JournalRow) => row.values?.[col.id] ?? '—',
    })),
    {
      key: 'confirmation',
      title: selectedJournal?.columns?.find((c) => c.type === 'confirmation')?.title ?? 'Подтверждение',
      render: (_: unknown, row: JournalRow) => {
        if (row.confirmation_status === 'active') {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="green">✓ {row.signer_full_name}</Tag>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {row.confirmed_at ? new Date(row.confirmed_at).toLocaleString('ru') : ''}
              </Text>
            </Space>
          );
        }
        return (
          <Button size="small" type="primary" onClick={() => openConfirm(row)}>
            Подтвердить выполнение
          </Button>
        );
      },
    },
  ];

  return (
    <div className="employee-journals-page">
      <Title level={4}>Журналы</Title>

      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Все отделения"
          allowClear
          style={{ minWidth: 200 }}
          onChange={(v: number | undefined) => setSelectedDept(v)}
          options={departments.map((d) => ({ label: d.name, value: d.id }))}
        />
      </Space>

      {!selectedJournal ? (
        loading ? (
          <Text>Загрузка...</Text>
        ) : filteredJournals.length === 0 ? (
          <Empty
            description={
              <span>
                Нет доступных журналов.
                <br />
                Доступ настраивает главная медсестра или администратор.
              </span>
            }
          />
        ) : (
          <Table
            dataSource={filteredJournals}
            rowKey="id"
            size="small"
            columns={[
              { title: 'Название', dataIndex: 'title', key: 'title' },
              { title: 'Отделение', dataIndex: 'department_name', key: 'dept' },
              {
                title: 'Строк',
                dataIndex: 'row_count',
                key: 'rows',
                width: 80,
              },
              {
                key: 'action',
                width: 120,
                render: (_: unknown, record: Journal) => (
                  <Button size="small" onClick={() => void openJournal(record)}>
                    Открыть
                  </Button>
                ),
              },
            ]}
          />
        )
      ) : (
        <>
          <div className="employee-journals-page__back">
            <Button onClick={() => { setSelectedJournal(null); setRows([]); }}>
              ← Назад к списку
            </Button>
            <Title level={5} style={{ marginLeft: 12, display: 'inline' }}>
              {selectedJournal.title}
              <Text type="secondary" style={{ marginLeft: 8, fontSize: 13 }}>
                {selectedJournal.department_name}
              </Text>
            </Title>
          </div>

          <Table
            dataSource={rows}
            rowKey="id"
            columns={tableColumns}
            loading={rowsLoading}
            size="small"
            tableLayout="fixed"
            pagination={{ pageSize: 50, showSizeChanger: true }}
          />
        </>
      )}

      {/* Модальное окно подтверждения */}
      <Modal
        title="Подтвердить выполнение"
        open={confirmOpen}
        onCancel={handleCloseConfirm}
        onOk={() => void handleConfirm()}
        okText="Подтвердить"
        cancelText="Отмена"
        confirmLoading={confirmLoading}
        destroyOnHidden
      >
        {confirmRow && selectedJournal && (() => {
          const readOnlyCols = columns.filter((c) => !c.is_editable_by_employee);
          const editableCols = columns.filter((c) => c.is_editable_by_employee);
          return (
            <div className="employee-journals-page__confirm-modal">
              <p><strong>Журнал:</strong> {selectedJournal.title}</p>
              <p><strong>Отделение:</strong> {selectedJournal.department_name}</p>

              {readOnlyCols.length > 0 && (
                <>
                  <p style={{ marginBottom: 4 }}><strong>Данные строки:</strong></p>
                  <ul style={{ marginBottom: 12 }}>
                    {readOnlyCols.map((col) => (
                      <li key={col.id}>
                        <strong>{col.title}:</strong>{' '}
                        {col.type === 'date' && confirmRow.values?.[col.id]
                          ? dayjs(confirmRow.values[col.id]).format('DD.MM.YYYY')
                          : (confirmRow.values?.[col.id] ?? '—')}
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {editableCols.length > 0 && (
                <>
                  <p style={{ marginBottom: 4 }}><strong>Заполните перед подтверждением:</strong></p>
                  {editableCols.map((col) => (
                    <Form.Item key={col.id} label={col.title} style={{ marginBottom: 8 }}>
                      {col.type === 'date' ? (
                        <DatePicker
                          style={{ width: '100%' }}
                          format="DD.MM.YYYY"
                          value={editableValues[col.id] ? dayjs(editableValues[col.id]) : null}
                          onChange={(d) =>
                            setEditableValues((prev) => ({
                              ...prev,
                              [col.id]: d ? d.format('YYYY-MM-DD') : '',
                            }))
                          }
                        />
                      ) : (
                        <Input
                          value={editableValues[col.id] ?? ''}
                          onChange={(e) =>
                            setEditableValues((prev) => ({ ...prev, [col.id]: e.target.value }))
                          }
                        />
                      )}
                    </Form.Item>
                  ))}
                </>
              )}

              <p style={{ color: '#888', fontSize: 12 }}>
                Система зафиксирует ваши ФИО и текущее время автоматически.
              </p>

              {confirmError && (
                <Alert type="error" message={confirmError} style={{ marginBottom: 8 }} showIcon />
              )}

              <Form.Item label="Введите действующий пароль" required style={{ marginBottom: 0 }}>
                <Input.Password
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  onPressEnter={() => void handleConfirm()}
                />
              </Form.Item>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
