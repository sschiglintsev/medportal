import {
  BookOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EyeOutlined,
  PlusOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

import { fetchDepartments } from '../Core/services/reference.service';
import {
  addJournalRow,
  archiveJournal,
  copyJournalRow,
  createJournal,
  deleteJournalRow,
  fetchJournal,
  fetchJournalRows,
  fetchJournals,
  publishJournal,
  restoreJournal,
  updateJournal,
  updateJournalColumns,
  updateJournalRow,
} from '../Core/services/journal.service';
import { useAppStore } from '../Core/store/app.store';
import type { Department, Journal, JournalColumn, JournalRow } from '../Core/types/common';
import './ManagedJournalsPage.scss';

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  published: 'green',
  archived: 'orange',
};
const STATUS_LABELS: Record<string, string> = {
  draft: 'Черновик',
  published: 'Опубликован',
  archived: 'Архив',
};

const COL_TYPE_LABELS: Record<string, string> = {
  text: 'Текст',
  date: 'Дата',
  confirmation: 'Подтверждение',
};

// ─── Просмотрщик журнала (read-only, с подписями) ────────────────────────────

type ViewerProps = {
  journal: Journal;
  token: string;
  onDone: () => void;
};

function JournalViewer({ journal, token, onDone }: ViewerProps) {
  const [cols, setCols] = useState<Omit<JournalColumn, 'journal_id'>[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void Promise.all([
      fetchJournal(journal.id, token),
      fetchJournalRows(journal.id, token),
    ])
      .then(([j, r]) => {
        setCols((j.columns ?? []).map(({ journal_id: _, ...rest }) => rest));
        setRows(r.rows);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [journal.id, token]);

  const dataCols = cols.filter((c) => c.type !== 'confirmation');
  const confirmCol = cols.find((c) => c.type === 'confirmation');

  // ── Экспорт в Excel ──────────────────────────────────────────────────────
  const exportToExcel = () => {
    const header = [
      ...dataCols.map((c) => c.title),
      ...(confirmCol ? [confirmCol.title || 'Подтверждение', 'Дата подтверждения', 'Подписал'] : []),
    ];
    const dataRows = rows.map((row) => {
      const cells: (string | null)[] = dataCols.map((col) => {
        const val = row.values?.[col.id] ?? null;
        if (!val) return null;
        if (col.type === 'date') return dayjs(val).isValid() ? dayjs(val).format('DD.MM.YYYY') : val;
        return val;
      });
      if (confirmCol) {
        if (row.confirmation_status === 'active') {
          cells.push('✓');
          cells.push(row.confirmed_at ? dayjs(row.confirmed_at).format('DD.MM.YYYY HH:mm') : '');
          cells.push(row.signer_full_name ?? '');
        } else {
          cells.push('', '', '');
        }
      }
      return cells;
    });
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    XLSX.writeFile(wb, `${journal.title}.xlsx`);
  };

  // ── Колонки таблицы ──────────────────────────────────────────────────────
  const tableCols: ColumnsType<JournalRow> = [
    ...dataCols.map((col) => ({
      key: col.id,
      title: col.title || <Text type="secondary">(без названия)</Text>,
      render: (_: unknown, row: JournalRow) => {
        const val = row.values?.[col.id];
        if (!val) return <Text type="secondary">—</Text>;
        if (col.type === 'date') return dayjs(val).isValid() ? dayjs(val).format('DD.MM.YYYY') : val;
        return val;
      },
    })),
    {
      key: '_confirm',
      title: confirmCol?.title ?? 'Подтверждение',
      width: 200,
      render: (_: unknown, row: JournalRow) => {
        if (row.confirmation_status === 'active') {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="green">✓ Подписано</Tag>
              <Text style={{ fontSize: 12 }}>{row.signer_full_name}</Text>
              {row.signer_position && (
                <Text type="secondary" style={{ fontSize: 11 }}>{row.signer_position}</Text>
              )}
              <Text type="secondary" style={{ fontSize: 11 }}>
                {row.confirmed_at ? dayjs(row.confirmed_at).format('DD.MM.YYYY HH:mm') : ''}
              </Text>
            </Space>
          );
        }
        return <Tag color="default">Не подписано</Tag>;
      },
    },
  ];

  const signedCount = rows.filter((r) => r.confirmation_status === 'active').length;

  return (
    <div className="journal-editor">
      <div className="journal-editor__back">
        <Button onClick={onDone}>← Назад к списку</Button>
        <Title level={5} style={{ display: 'inline', marginLeft: 12 }}>
          {journal.title}
          <Tag color={STATUS_COLORS[journal.status]} style={{ marginLeft: 8, fontSize: 12 }}>
            {STATUS_LABELS[journal.status]}
          </Tag>
        </Title>
        <Space style={{ marginLeft: 'auto' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Подписано: {signedCount} / {rows.length}
          </Text>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={exportToExcel}
            disabled={rows.length === 0}
          >
            Экспорт в Excel
          </Button>
        </Space>
      </div>

      <div className="journal-editor__section">
        <Table
          dataSource={rows}
          rowKey="id"
          columns={tableCols}
          loading={loading}
          size="small"
          tableLayout="fixed"
          pagination={{ pageSize: 50, showSizeChanger: true }}
          locale={{ emptyText: 'Строк нет' }}
          rowClassName={(row) =>
            row.confirmation_status === 'active' ? 'journal-viewer__row--signed' : ''
          }
        />
      </div>
    </div>
  );
}

// ─── Редактор журнала ────────────────────────────────────────────────────────

type EditorProps = {
  journal: Journal;
  token: string;
  onDone: () => void;
};

function JournalEditor({ journal, token, onDone }: EditorProps) {
  const [cols, setCols] = useState<Omit<JournalColumn, 'journal_id'>[]>([]);
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [colsSaving, setColsSaving] = useState(false);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addRowLoading, setAddRowLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<JournalRow | null>(null);
  const [rowForm] = Form.useForm<Record<string, string | dayjs.Dayjs | null>>();

  // Загружаем актуальный журнал с колонками
  useEffect(() => {
    void fetchJournal(journal.id, token).then((j) => {
      setCols((j.columns ?? []).map(({ journal_id: _, ...rest }) => rest));
    });
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journal.id]);

  const loadRows = useCallback(async () => {
    setRowsLoading(true);
    try {
      const data = await fetchJournalRows(journal.id, token);
      setRows(data.rows);
    } catch {
      /* ignore */
    } finally {
      setRowsLoading(false);
    }
  }, [journal.id, token]);

  // ── Импорт колонок из Excel ──────────────────────────────────────────────

  const importColsFromExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // Первая строка — заголовки колонок
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
        const headers = (rows[0] ?? []) as unknown[];
        const newCols = headers
          .map((h) => String(h ?? '').trim())
          .filter(Boolean)
          .map((title, i) => ({
            id: `new_${Date.now()}_${i}`,
            title,
            type: 'text' as const,
            sort_order: cols.length + i,
            is_editable_by_employee: true,
          }));

        if (newCols.length === 0) {
          void message.warning('В первой строке файла не найдено заголовков');
          return;
        }

        setCols((prev) => [
          ...prev,
          ...newCols.map((c, i) => ({ ...c, sort_order: prev.length + i })),
        ]);
        void message.success(`Добавлено ${newCols.length} колонок из Excel`);
      } catch {
        void message.error('Не удалось прочитать файл');
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // не загружать автоматически
  };

  // ── Экспорт журнала в Excel ───────────────────────────────────────────────

  const exportToExcel = () => {
    const dataCols = cols.filter((c) => c.type !== 'confirmation');
    const confirmCol = cols.find((c) => c.type === 'confirmation');

    // Заголовки
    const header = [
      ...dataCols.map((c) => c.title),
      ...(confirmCol ? [confirmCol.title || 'Подтверждение', 'Дата подтверждения', 'Подписал'] : []),
    ];

    // Строки данных
    const dataRows = rows.map((row) => {
      const cells: (string | null)[] = dataCols.map((col) => {
        const val = row.values?.[col.id] ?? null;
        if (!val) return null;
        if (col.type === 'date') {
          return dayjs(val).isValid() ? dayjs(val).format('DD.MM.YYYY') : val;
        }
        return val;
      });

      if (confirmCol) {
        if (row.confirmation_status === 'active') {
          cells.push('✓');
          cells.push(row.confirmed_at ? dayjs(row.confirmed_at).format('DD.MM.YYYY HH:mm') : '');
          cells.push(row.signer_full_name ?? '');
        } else {
          cells.push('', '', '');
        }
      }
      return cells;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // Ширина столбцов
    ws['!cols'] = header.map((h) => ({ wch: Math.max(h.length + 2, 14) }));

    XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
    XLSX.writeFile(wb, `${journal.title}.xlsx`);
  };

  // ── Колонки ─────────────────────────────────────────────────────────────

  const addCol = () => {
    setCols((prev) => [
      ...prev,
      {
        id: `new_${Date.now()}`,
        title: '',
        type: 'text',
        sort_order: prev.length,
        is_editable_by_employee: true,
      },
    ]);
  };

  const removeCol = (idx: number) => {
    setCols((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, sort_order: i })));
  };

  const updateColField = (idx: number, field: 'title' | 'type', value: string) => {
    // Если ставим confirmation — проверяем что её ещё нет
    if (field === 'type' && value === 'confirmation') {
      const existing = cols.findIndex((c) => c.type === 'confirmation');
      if (existing !== -1 && existing !== idx) {
        void message.warning('В журнале может быть только одна колонка «Подтверждение»');
        return;
      }
    }
    setCols((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  };

  const saveCols = async () => {
    if (cols.some((c) => !c.title.trim())) {
      void message.error('Заполните названия всех колонок');
      return;
    }
    setColsSaving(true);
    try {
      await updateJournalColumns(journal.id, cols, token);
      void message.success('Колонки сохранены');
      // Обновляем id (сервер мог присвоить новые UUID)
      const updated = await fetchJournal(journal.id, token);
      setCols((updated.columns ?? []).map(({ journal_id: _, ...rest }) => rest));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка сохранения';
      void message.error(msg);
    } finally {
      setColsSaving(false);
    }
  };

  // ── Строки ───────────────────────────────────────────────────────────────

  const openAddRow = () => {
    setEditingRow(null);
    rowForm.resetFields();
    setAddRowOpen(true);
  };

  const openEditRow = (row: JournalRow) => {
    setEditingRow(row);
    // DatePicker принимает dayjs, текстовые поля — строки
    const vals: Record<string, string | dayjs.Dayjs | null> = {};
    for (const col of cols) {
      const raw = row.values?.[col.id] ?? '';
      if (col.type === 'date') {
        vals[col.id] = raw && dayjs(raw).isValid() ? dayjs(raw) : null;
      } else {
        vals[col.id] = raw;
      }
    }
    rowForm.setFieldsValue(vals);
    setAddRowOpen(true);
  };

  const handleSaveRow = async (values: Record<string, unknown>) => {
    setAddRowLoading(true);
    try {
      const payload: Record<string, string | null> = {};
      for (const col of cols) {
        if (col.type === 'confirmation') continue; // подтверждение не редактируется вручную
        const raw = values[col.id];
        if (col.type === 'date') {
          // DatePicker отдаёт dayjs — сохраняем как YYYY-MM-DD
          payload[col.id] =
            raw && dayjs.isDayjs(raw) && raw.isValid()
              ? raw.format('YYYY-MM-DD')
              : typeof raw === 'string' && raw
                ? raw
                : null;
        } else {
          payload[col.id] = typeof raw === 'string' ? raw : raw != null ? String(raw) : null;
        }
      }

      if (editingRow) {
        await updateJournalRow(journal.id, editingRow.id, payload, editingRow.current_revision, token);
        void message.success('Строка обновлена');
      } else {
        await addJournalRow(journal.id, payload, token);
        void message.success('Строка добавлена');
      }
      setAddRowOpen(false);
      rowForm.resetFields();
      setEditingRow(null);
      await loadRows();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка';
      void message.error(msg);
    } finally {
      setAddRowLoading(false);
    }
  };

  const handleDeleteRow = async (rowId: number) => {
    try {
      await deleteJournalRow(journal.id, rowId, token);
      void message.success('Строка удалена');
      await loadRows();
    } catch {
      void message.error('Ошибка удаления');
    }
  };

  const handleCopyRow = async (row: JournalRow) => {
    try {
      await copyJournalRow(
        journal.id,
        row.id,
        {
          count: 1,
          expectedRevision: row.current_revision,
          idempotencyKey: `copy_${row.id}_${Date.now()}`,
        },
        token,
      );
      void message.success('Строка скопирована');
      await loadRows();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка копирования';
      void message.error(msg);
    }
  };

  // ── Таблица строк ────────────────────────────────────────────────────────

  const dataCols = cols.filter((c) => c.type !== 'confirmation');

  const rowTableCols: ColumnsType<JournalRow> = [
    ...dataCols.map((col) => ({
      key: col.id,
      title: col.title || <Text type="secondary">(без названия)</Text>,
      dataIndex: col.id,
      render: (_: unknown, row: JournalRow) => {
        const val = row.values?.[col.id];
        if (!val) return <Text type="secondary">—</Text>;
        if (col.type === 'date') return dayjs(val).isValid() ? dayjs(val).format('DD.MM.YYYY') : val;
        return val;
      },
    })),
    {
      key: '_actions',
      title: '',
      width: 110,
      render: (_: unknown, row: JournalRow) => (
        <Space>
          <Tooltip title="Редактировать">
            <Button size="small" onClick={() => openEditRow(row)}>✎</Button>
          </Tooltip>
          <Tooltip title="Копировать строку">
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => void handleCopyRow(row)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить строку?"
            okText="Да"
            cancelText="Нет"
            onConfirm={() => void handleDeleteRow(row.id)}
          >
            <Tooltip title="Удалить">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const hasUnsavedNewCols = cols.some((c) => c.id.startsWith('new_'));

  return (
    <div className="journal-editor">
      <div className="journal-editor__back">
        <Button onClick={onDone}>← Назад к списку</Button>
        <Title level={5} style={{ display: 'inline', marginLeft: 12 }}>
          {journal.title}
          <Tag color={STATUS_COLORS[journal.status]} style={{ marginLeft: 8, fontSize: 12 }}>
            {STATUS_LABELS[journal.status]}
          </Tag>
        </Title>
        <Button
          size="small"
          icon={<DownloadOutlined />}
          onClick={exportToExcel}
          disabled={rows.length === 0 && cols.length === 0}
          style={{ marginLeft: 'auto' }}
        >
          Экспорт в Excel
        </Button>
      </div>

      {/* ── Колонки ─────────────────────────────────────────────── */}
      <div className="journal-editor__section">
        <div className="journal-editor__section-header">
          <Text strong>Колонки</Text>
          {journal.status === 'draft' && (
            <Space wrap>
              <Button size="small" icon={<PlusOutlined />} onClick={addCol}>
                Добавить колонку
              </Button>
              <Upload
                accept=".xlsx,.xls"
                showUploadList={false}
                beforeUpload={importColsFromExcel}
              >
                <Button size="small" icon={<UploadOutlined />}>
                  Загрузить из Excel
                </Button>
              </Upload>
              <Button
                size="small"
                type="primary"
                onClick={() => void saveCols()}
                loading={colsSaving}
                disabled={cols.length === 0}
              >
                Сохранить колонки
              </Button>
            </Space>
          )}
        </div>

        {cols.length === 0 ? (
          <Alert
            type="info"
            message="Колонок нет. Добавьте хотя бы одну перед публикацией."
            style={{ marginBottom: 8 }}
          />
        ) : (
          <div className="journal-editor__cols-list">
            {cols.map((col, idx) => (
              <div key={col.id} className="journal-editor__col-row">
                <span className="journal-editor__col-num">{idx + 1}</span>
                <Input
                  value={col.title}
                  placeholder="Название колонки"
                  onChange={(e) => updateColField(idx, 'title', e.target.value)}
                  disabled={journal.status !== 'draft'}
                  style={{ flex: 1 }}
                />
                <Select
                  value={col.type}
                  onChange={(v: string) => updateColField(idx, 'type', v)}
                  disabled={journal.status !== 'draft'}
                  style={{ width: 160 }}
                  options={[
                    { value: 'text', label: 'Текст' },
                    { value: 'date', label: 'Дата' },
                    { value: 'confirmation', label: 'Подтверждение' },
                  ]}
                />
                {col.type !== 'confirmation' && (
                  <Tooltip title={col.is_editable_by_employee ? 'Медсестра заполняет' : 'Только просмотр для медсестры'}>
                    <Space size={4}>
                      <Switch
                        size="small"
                        checked={col.is_editable_by_employee}
                        onChange={(checked) =>
                          setCols((prev) =>
                            prev.map((c, i) => (i === idx ? { ...c, is_editable_by_employee: checked } : c)),
                          )
                        }
                        disabled={journal.status !== 'draft'}
                      />
                      <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>
                        {col.is_editable_by_employee ? 'Вводит медсестра' : 'Только просмотр'}
                      </span>
                    </Space>
                  </Tooltip>
                )}
                {journal.status === 'draft' && (
                  <Tooltip title="Удалить колонку">
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeCol(idx)}
                    />
                  </Tooltip>
                )}
                <Tag style={{ marginLeft: 4 }}>{COL_TYPE_LABELS[col.type]}</Tag>
              </div>
            ))}
          </div>
        )}

        {hasUnsavedNewCols && (
          <Alert type="warning" message="Есть несохранённые колонки. Нажмите «Сохранить колонки»." style={{ marginTop: 8 }} showIcon />
        )}
      </div>

      {/* ── Строки ──────────────────────────────────────────────── */}
      {cols.filter((c) => c.type !== 'confirmation').length > 0 && !hasUnsavedNewCols && (
        <div className="journal-editor__section">
          <div className="journal-editor__section-header">
            <Text strong>Строки</Text>
            {journal.status !== 'archived' && (
              <Button size="small" icon={<PlusOutlined />} onClick={openAddRow}>
                Добавить строку
              </Button>
            )}
          </div>

          <Table
            dataSource={rows}
            rowKey="id"
            columns={rowTableCols}
            loading={rowsLoading}
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            tableLayout="fixed"
            locale={{ emptyText: 'Строк нет' }}
          />
        </div>
      )}

      {/* ── Модалка добавления/редактирования строки ────────────── */}
      <Modal
        title={editingRow ? 'Редактировать строку' : 'Новая строка'}
        open={addRowOpen}
        onCancel={() => { setAddRowOpen(false); rowForm.resetFields(); setEditingRow(null); }}
        onOk={() => rowForm.submit()}
        okText={editingRow ? 'Сохранить' : 'Добавить'}
        cancelText="Отмена"
        confirmLoading={addRowLoading}
        destroyOnHidden
      >
        <Form form={rowForm} layout="vertical" onFinish={handleSaveRow}>
          {dataCols.map((col) => (
            <Form.Item key={col.id} name={col.id} label={col.title || '(без названия)'}>
              {col.type === 'date' ? (
                <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  );
}

// ─── Список журналов ─────────────────────────────────────────────────────────

export function ManagedJournalsPage() {
  const token = useAppStore((s) => s.token)!;
  const permissions = useAppStore((s) => s.user?.permissions);
  const scope = permissions?.canManageAllJournals ? 'all' : 'own';

  const [journals, setJournals] = useState<Journal[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm<{ title: string; departmentId: number }>();
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null);
  const [viewingJournal, setViewingJournal] = useState<Journal | null>(null);

  const loadJournals = useCallback(() => {
    setLoading(true);
    void fetchJournals(token, scope)
      .then(setJournals)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, scope]);

  useEffect(() => {
    loadJournals();
    void fetchDepartments().then(setDepartments).catch(() => {});
  }, [loadJournals]);

  const handleCreate = async (values: { title: string; departmentId: number }) => {
    setCreateLoading(true);
    try {
      await createJournal({ title: values.title, departmentId: values.departmentId, columns: [] }, token);
      setCreateOpen(false);
      form.resetFields();
      void message.success('Журнал создан');
      loadJournals();
    } catch {
      void message.error('Ошибка создания');
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePublish = async (journal: Journal) => {
    try {
      await publishJournal(journal.id, token);
      void message.success('Журнал опубликован');
      loadJournals();
      if (editingJournal?.id === journal.id) setEditingJournal(null);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка';
      void message.error(msg);
    }
  };

  const handleArchive = async (id: number) => {
    try {
      await archiveJournal(id, token);
      void message.success('Журнал архивирован');
      loadJournals();
    } catch { void message.error('Ошибка'); }
  };

  const handleRestore = async (id: number) => {
    try {
      await restoreJournal(id, token);
      void message.success('Журнал восстановлен');
      loadJournals();
    } catch { void message.error('Ошибка'); }
  };

  // Если открыт просмотрщик — показываем его
  if (viewingJournal) {
    return (
      <div className="managed-journals-page">
        <JournalViewer
          journal={viewingJournal}
          token={token}
          onDone={() => setViewingJournal(null)}
        />
      </div>
    );
  }

  // Если открыт редактор — показываем его
  if (editingJournal) {
    return (
      <div className="managed-journals-page">
        <JournalEditor
          journal={editingJournal}
          token={token}
          onDone={() => { setEditingJournal(null); loadJournals(); }}
        />
      </div>
    );
  }

  const columns: ColumnsType<Journal> = [
    { title: 'Название', dataIndex: 'title', key: 'title' },
    { title: 'Отделение', dataIndex: 'department_name', key: 'dept' },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (s: string) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>,
    },
    { title: 'Строк', dataIndex: 'row_count', key: 'rows', width: 80 },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: Journal) => (
        <Space>
          {record.status !== 'draft' && (
            <Tooltip title="Просмотр строк и подписей">
              <Button
                size="small"
                icon={<EyeOutlined />}
                onClick={() => void fetchJournal(record.id, token).then(setViewingJournal)}
              >
                Просмотр
              </Button>
            </Tooltip>
          )}
          <Button
            size="small"
            onClick={() => void fetchJournal(record.id, token).then(setEditingJournal)}
          >
            Редактировать
          </Button>
          {record.status === 'draft' && (
            <Button size="small" type="primary" onClick={() => void handlePublish(record)}>
              Опубликовать
            </Button>
          )}
          {record.status === 'published' && (
            <Button size="small" onClick={() => void handleArchive(record.id)}>В архив</Button>
          )}
          {record.status === 'archived' && (
            <Button size="small" onClick={() => void handleRestore(record.id)}>Восстановить</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="managed-journals-page">
      <div className="managed-journals-page__header">
        <Title level={4}>
          <BookOutlined style={{ marginRight: 8 }} />
          Мои журналы
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          Создать журнал
        </Button>
      </div>

      <Table
        dataSource={journals}
        rowKey="id"
        columns={columns}
        loading={loading}
        size="small"
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title="Новый журнал"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createLoading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="title" label="Название журнала" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="departmentId" label="Отделение" rules={[{ required: true }]}>
            <Select
              options={departments.map((d) => ({ label: d.name, value: d.id }))}
              showSearch
              filterOption={(input, opt) =>
                (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
