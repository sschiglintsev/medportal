import {
  EditOutlined,
  EyeOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  PlusOutlined,
  PrinterOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TempSheetForm } from '../components/TempSheetForm/TempSheetForm';
import {
  createOrGetTempSheet,
  createTempSheetPatient,
  fetchTempSheet,
  fetchTempSheetDepartments,
  fetchTempSheetMyAccess,
  fetchTempSheets,
  searchTempSheetPatients,
  type TempSheetMyAccess,
} from '../Core/services/temp-sheet.service';
import { useAppStore } from '../Core/store/app.store';
import type { Patient, TempSheet, TempSheetColumnData } from '../Core/types/common';
import {
  downloadTempSheetExcel,
  downloadTempSheetPdf,
  printTempSheetElement,
} from '../Core/utils/tempSheetExport';
import { normalizeColumns } from '../Core/utils/tempSheetForm';
import { TempSheetAccessPage } from './TempSheetAccessPage';
import { TempSheetEditorPage } from './TempSheetEditorPage';
import './TempSheetsPage.scss';

const { Title, Text } = Typography;

type Mode = 'list' | 'edit' | 'access';

export function TempSheetsPage() {
  const token = useAppStore((s) => s.token)!;

  const [access, setAccess] = useState<TempSheetMyAccess | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [items, setItems] = useState<TempSheet[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [deptId, setDeptId] = useState<number | undefined>();
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [createForm] = Form.useForm();

  const [viewSheet, setViewSheet] = useState<(TempSheet & { columns: TempSheetColumnData[] }) | null>(
    null,
  );
  const [viewLoading, setViewLoading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const user = useAppStore((s) => s.user);
  const isManagerByRole =
    user?.role === 'head_nurse' ||
    user?.role === 'administrator' ||
    user?.permissions?.canManageTempSheet === true ||
    user?.permissions?.canAccessAdminCabinet === true;

  useEffect(() => {
    if (isManagerByRole) {
      setAccess({
        hasAccess: true,
        role: 'manager',
        canEdit: true,
        canManageAccess: true,
      });
    }

    void fetchTempSheetMyAccess(token)
      .then((data) => {
        // Не затираем доступ менеджера ответом со старым JWT без флага
        if (isManagerByRole) {
          setAccess({
            hasAccess: true,
            role: 'manager',
            canEdit: true,
            canManageAccess: true,
          });
          return;
        }
        setAccess(data);
      })
      .catch(() => {
        if (isManagerByRole) {
          setAccess({
            hasAccess: true,
            role: 'manager',
            canEdit: true,
            canManageAccess: true,
          });
          return;
        }
        setAccess({ hasAccess: false, role: 'employee', canEdit: false, canManageAccess: false });
      });
  }, [token, isManagerByRole]);

  useEffect(() => {
    if (!access?.hasAccess) return;
    void fetchTempSheetDepartments(token)
      .then(setDepartments)
      .catch(() => {});
  }, [access, token]);

  const loadList = useCallback(async () => {
    if (!access?.hasAccess) return;
    setLoading(true);
    try {
      const data = await fetchTempSheets(token, {
        q: q || undefined,
        departmentId: deptId,
        page,
        limit: 20,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch {
      void message.error('Не удалось загрузить список');
    } finally {
      setLoading(false);
    }
  }, [access, token, q, deptId, page]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const openCreate = () => {
    createForm.resetFields();
    setPatients([]);
    setCreateOpen(true);
  };

  const handlePatientSearch = async (value: string) => {
    try {
      const list = await searchTempSheetPatients(token, value);
      setPatients(list);
    } catch {
      // ignore
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      let patientId = values.patient_id as number | undefined;

      if (!patientId && !values.new_patient_name?.trim()) {
        void message.error('Выберите ребёнка или укажите ФИО нового');
        return;
      }

      if (!patientId && values.new_patient_name) {
        const created = await createTempSheetPatient(token, {
          full_name: values.new_patient_name,
          birth_date: values.new_birth_date
            ? (values.new_birth_date as dayjs.Dayjs).format('YYYY-MM-DD')
            : null,
        });
        patientId = created.id;
      }

      if (!patientId || !values.department_id) {
        void message.error('Выберите ребёнка и отделение');
        return;
      }

      const sheet = await createOrGetTempSheet(token, {
        patient_id: patientId,
        department_id: values.department_id,
        height_cm: values.height_cm ?? null,
      });

      setCreateOpen(false);
      setEditingId(sheet.id);
      setMode('edit');
      void message.success('Лист открыт');
    } catch {
      void message.error('Не удалось создать / открыть лист');
    }
  };

  const openView = async (id: number) => {
    setViewLoading(true);
    try {
      const data = await fetchTempSheet(token, id);
      setViewSheet({
        ...data,
        columns: normalizeColumns(data.columns),
      });
    } catch {
      void message.error('Не удалось открыть лист');
    } finally {
      setViewLoading(false);
    }
  };

  const ensureViewFresh = async (): Promise<(TempSheet & { columns: TempSheetColumnData[] }) | null> => {
    if (!viewSheet) return null;
    try {
      const data = await fetchTempSheet(token, viewSheet.id);
      const fresh = { ...data, columns: normalizeColumns(data.columns) };
      setViewSheet(fresh);
      return fresh;
    } catch {
      void message.error('Не удалось обновить данные перед выгрузкой');
      return null;
    }
  };

  const handleExcel = async () => {
    const fresh = await ensureViewFresh();
    if (!fresh) return;
    downloadTempSheetExcel(fresh, fresh.columns);
  };

  const handlePdf = async () => {
    const fresh = await ensureViewFresh();
    if (!fresh || !printRef.current) return;
    // дождаться отрисовки обновлённых данных
    await new Promise((r) => setTimeout(r, 50));
    try {
      const safe = fresh.patient_name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
      await downloadTempSheetPdf(printRef.current, `temperaturnyy_list_${safe}`);
    } catch {
      void message.error('Не удалось сформировать PDF');
    }
  };

  const handlePrint = async () => {
    const fresh = await ensureViewFresh();
    if (!fresh || !printRef.current) return;
    await new Promise((r) => setTimeout(r, 50));
    printTempSheetElement(printRef.current);
  };

  if (access && !access.hasAccess) {
    return (
      <div className="temp-sheets-page">
        <AlertNoAccess />
      </div>
    );
  }

  if (mode === 'access' && access?.canManageAccess) {
    return <TempSheetAccessPage onBack={() => setMode('list')} />;
  }

  if (mode === 'edit' && editingId != null) {
    return (
      <TempSheetEditorPage
        sheetId={editingId}
        onBack={() => {
          setMode('list');
          setEditingId(null);
          void loadList();
        }}
      />
    );
  }

  const columns: ColumnsType<TempSheet> = [
    { title: 'Ребёнок', dataIndex: 'patient_name', key: 'name' },
    { title: 'Отделение', dataIndex: 'department_name', key: 'dept' },
    {
      title: 'Обновлён',
      dataIndex: 'updated_at',
      key: 'upd',
      render: (v: string) => (v ? dayjs(v).format('DD.MM.YYYY HH:mm') : '—'),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_, record) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} loading={viewLoading} onClick={() => void openView(record.id)}>
            Просмотр
          </Button>
          {access?.canEdit && (
            <Button
              size="small"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                setEditingId(record.id);
                setMode('edit');
              }}
            >
              Заполнить
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="temp-sheets-page">
      <div className="temp-sheets-page__toolbar">
        <Title level={4} style={{ margin: 0 }}>
          Температурный лист
        </Title>
        <Space wrap>
          <Input.Search
            placeholder="Поиск по ФИО ребёнка"
            allowClear
            style={{ width: 260 }}
            onSearch={(value) => {
              setPage(1);
              setQ(value);
            }}
          />
          {access?.role === 'manager' && (
            <Select
              allowClear
              placeholder="Отделение"
              style={{ width: 220 }}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              onChange={(v) => {
                setPage(1);
                setDeptId(v);
              }}
            />
          )}
          {access?.canEdit && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Создать / открыть
            </Button>
          )}
          {access?.canManageAccess && (
            <Button icon={<TeamOutlined />} onClick={() => setMode('access')}>
              Доступ сотрудников
            </Button>
          )}
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        pagination={{
          current: page,
          total,
          pageSize: 20,
          onChange: setPage,
          showTotal: (t) => `Всего: ${t}`,
        }}
      />

      <Modal
        title="Создать / открыть температурный лист"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="Открыть"
        destroyOnHidden
        width={560}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item label="Отделение" name="department_id" rules={[{ required: true, message: 'Укажите отделение' }]}>
            <Select
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Отделение"
            />
          </Form.Item>
          <Form.Item label="Ребёнок из базы" name="patient_id">
            <Select
              showSearch
              filterOption={false}
              onSearch={(v) => void handlePatientSearch(v)}
              onFocus={() => void handlePatientSearch('')}
              allowClear
              placeholder="Начните вводить ФИО"
              options={patients.map((p) => ({
                value: p.id,
                label: `${p.full_name}${p.birth_date ? ` (${dayjs(p.birth_date).format('DD.MM.YYYY')})` : ''}`,
              }))}
            />
          </Form.Item>
          <Text type="secondary">Или создайте новую карточку ребёнка (если нет в базе):</Text>
          <Form.Item label="ФИО нового ребёнка" name="new_patient_name" style={{ marginTop: 8 }}>
            <Input placeholder="ФИО" maxLength={255} />
          </Form.Item>
          <Form.Item label="Дата рождения" name="new_birth_date">
            <DatePicker style={{ width: '100%' }} format="DD.MM.YYYY" />
          </Form.Item>
          <Form.Item label="Рост, см (необязательно)" name="height_cm">
            <InputNumber min={0} max={300} step={0.1} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Просмотр температурного листа"
        open={!!viewSheet}
        onCancel={() => setViewSheet(null)}
        width="95vw"
        style={{ top: 16 }}
        footer={
          <Space wrap>
            <Button icon={<PrinterOutlined />} onClick={() => void handlePrint()}>
              Печать
            </Button>
            <Button icon={<FilePdfOutlined />} onClick={() => void handlePdf()}>
              Скачать PDF
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={() => void handleExcel()}>
              Скачать Excel
            </Button>
            {access?.canEdit && viewSheet && (
              <Button
                type="primary"
                icon={<EditOutlined />}
                onClick={() => {
                  setEditingId(viewSheet.id);
                  setViewSheet(null);
                  setMode('edit');
                }}
              >
                Заполнить
              </Button>
            )}
            <Button onClick={() => setViewSheet(null)}>Закрыть</Button>
          </Space>
        }
        destroyOnHidden
      >
        {viewSheet && (
          <div ref={printRef}>
            <TempSheetForm sheet={viewSheet} columns={viewSheet.columns} mode="view" />
          </div>
        )}
      </Modal>
    </div>
  );
}

function AlertNoAccess() {
  return (
    <div style={{ padding: 24 }}>
      <Title level={4}>Температурный лист</Title>
      <Text type="secondary">
        Нет доступа к модулю. Обратитесь к главной медсестре для выдачи разрешения.
      </Text>
    </div>
  );
}
