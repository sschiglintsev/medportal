import { PlusOutlined, UploadOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createEmployee,
  fetchEmployees,
  importCommit,
  importPreview,
  resetEmployeePassword,
  setEmployeeStatus,
} from '../Core/services/employee.service';
import { fetchRegistrationRoles } from '../Core/services/auth.service';
import { fetchDepartments } from '../Core/services/reference.service';
import { useAppStore } from '../Core/store/app.store';
import type { Department, EmployeeItem, RoleOption } from '../Core/types/common';
import {
  buildCredentialsWorkbook,
  downloadCredentialsXlsx,
} from '../Core/utils/exportEmployeeCredentials';
import {
  parseEmployeesSheet,
  readEmployeesExcel,
} from '../Core/utils/parseEmployeesExcel';
import type { ParsedEmployeeRow } from '../Core/utils/parseEmployeesExcel';
import type { ImportPreviewResponse } from '../Core/services/employee.service';
import './AdminEmployeesPage.scss';

const { Title, Text } = Typography;

const IMPORT_STATUS_LABELS: Record<string, string> = {
  new_user: 'Новый пользователь',
  existing_user: 'Уже существует',
  conflict: 'Конфликт',
  error: 'Ошибка',
};

type NewCredential = {
  fullName: string;
  username: string;
  temporaryPassword: string;
  employeeCode: string;
  department?: string;
  position?: string;
};

export function AdminEmployeesPage() {
  const token = useAppStore((s) => s.token)!;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);

  useEffect(() => {
    void fetchDepartments().then(setDepartments).catch(() => {});
    void fetchRegistrationRoles().then(setRoles).catch(() => {});
  }, []);

  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [filterRole, setFilterRole] = useState<string | undefined>(undefined);
  const [filterDepartmentId, setFilterDepartmentId] = useState<number | undefined>(undefined);

  // Создание
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form] = Form.useForm();

  // Одноразовые данные доступа (хранятся только в памяти)
  const credentialsRef = useRef<NewCredential[]>([]);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);

  // Импорт
  const [importStep, setImportStep] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [importBatchId, setImportBatchId] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importCreds, setImportCreds] = useState<NewCredential[]>([]);
  const [workbook, setWorkbook] = useState<ReturnType<typeof readEmployeesExcel> | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  /** Кэш распознанных строк для повторной отправки с исправлениями */
  const [parsedRowsCache, setParsedRowsCache] = useState<ParsedEmployeeRow[]>([]);
  /** Ручные исправления: sourceRow → departmentId из БД */
  const [deptCorrections, setDeptCorrections] = useState<Record<number, number>>({});

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchEmployees(token, {
        q: q || undefined,
        role: filterRole,
        departmentId: filterDepartmentId,
        page,
        limit: 50,
      });
      setEmployees(result.items);
      setTotal(result.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [token, q, filterRole, filterDepartmentId, page]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  // ── Ручное создание ───────────────────────────────────────

  const handleCreate = async (values: { fullName: string; employeeCode?: string; depts: Array<{ departmentId: number; position: string }> }) => {
    setCreateLoading(true);
    try {
      const result = await createEmployee(
        {
          fullName: values.fullName,
          employeeCode: values.employeeCode,
          departments: values.depts.map((d) => ({ departmentId: d.departmentId, position: d.position })),
        },
        token,
      );
      const activeDepts = values.depts;
      credentialsRef.current = [
        {
          fullName: values.fullName,
          username: result.credentials.username,
          temporaryPassword: result.credentials.temporaryPassword,
          employeeCode: result.employeeCode,
          department: activeDepts
            .map((d) => departments.find((dep) => dep.id === d.departmentId)?.name ?? '')
            .filter(Boolean)
            .join('; '),
          position: activeDepts.map((d) => d.position).filter(Boolean).join('; '),
        },
      ];
      setCreateOpen(false);
      form.resetFields();
      setCredentialsModalOpen(true);
      void loadEmployees();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка создания';
      void message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  // ── Блокировка/разблокировка ──────────────────────────────

  const toggleStatus = async (emp: EmployeeItem) => {
    try {
      await setEmployeeStatus(emp.id, !emp.is_active, token);
      void message.success(emp.is_active ? 'Сотрудник заблокирован' : 'Сотрудник разблокирован');
      void loadEmployees();
    } catch {
      void message.error('Ошибка');
    }
  };

  // ── Сброс пароля ──────────────────────────────────────────

  const handleResetPassword = async (emp: EmployeeItem) => {
    Modal.confirm({
      title: `Сбросить пароль для ${emp.full_name}?`,
      content: 'Все активные сессии будут завершены. Будет выдан новый временный пароль.',
      okText: 'Сбросить',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await resetEmployeePassword(emp.id, token);
          const activeDepts = emp.departments.filter((d) => d.is_active);
          credentialsRef.current = [
            {
              fullName: emp.full_name,
              username: emp.username,
              temporaryPassword: result.temporaryPassword,
              employeeCode: emp.employee_code ?? '',
              department: activeDepts.map((d) => d.name).join('; '),
              position: activeDepts.map((d) => d.position).join('; '),
            },
          ];
          setCredentialsModalOpen(true);
        } catch {
          void message.error('Ошибка сброса пароля');
        }
      },
    });
  };

  // ── Скачать доступы ──────────────────────────────────────

  const downloadCredentials = () => {
    const creds = credentialsRef.current;
    if (!creds.length) return;
    const portalUrl = window.location.origin;
    const rows = creds.map((c) => ({
      fullName: c.fullName,
      employeeCode: c.employeeCode,
      department: c.department ?? '',
      position: c.position ?? '',
      username: c.username,
      temporaryPassword: c.temporaryPassword,
    }));
    const wb = buildCredentialsWorkbook(rows, portalUrl);
    downloadCredentialsXlsx(wb, 'employee_credentials.xlsx');
  };

  const handleCloseCredentials = () => {
    // Очищаем из памяти
    credentialsRef.current = [];
    setCredentialsModalOpen(false);
  };

  // ── Excel-импорт ──────────────────────────────────────────

  const handleFileUpload = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const wb = readEmployeesExcel(buffer);
    setWorkbook(wb);
    setSelectedSheet(wb.SheetNames[0] ?? '');
    setImportStep(0);
    setImportPreviewData(null);
    setParsedRowsCache([]);
    setDeptCorrections({});
    setImportOpen(true);
    return false; // Не загружаем автоматически
  };

  /** Отправляет rows на preview. items — уже с применёнными исправлениями. */
  const runPreview = async (items: ParsedEmployeeRow[]) => {
    setImportLoading(true);
    try {
      const preview = await importPreview(
        { sourceSheet: selectedSheet, items },
        token,
      );
      setImportPreviewData(preview);
      setImportBatchId(preview.batchId);
      setImportStep(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка предварительной проверки';
      void message.error(msg);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportPreview = async () => {
    if (!workbook || !selectedSheet) return;
    const result = parseEmployeesSheet(workbook, selectedSheet);
    if (result.errors.length > 0 && result.rows.length === 0) {
      void message.error('Ошибки в файле: ' + result.errors.slice(0, 3).join('; '));
      return;
    }
    setParsedRowsCache(result.rows);
    setDeptCorrections({});
    await runPreview(result.rows);
  };

  /** Повторная проверка с применёнными ручными исправлениями отделений */
  const handleResubmitWithCorrections = async () => {
    if (!parsedRowsCache.length) return;
    const correctedItems = parsedRowsCache.map((row) => {
      const correctedDeptId = deptCorrections[row.sourceRow];
      if (correctedDeptId) {
        const dept = departments.find((d) => d.id === correctedDeptId);
        return { ...row, departmentName: dept?.name ?? row.departmentName };
      }
      return row;
    });
    await runPreview(correctedItems);
  };

  const handleImportCommit = async () => {
    if (!importBatchId) return;
    setImportLoading(true);
    try {
      const idempKey = `import_${importBatchId}_${Date.now()}`;
      const result = await importCommit(importBatchId, idempKey, token);
      setImportStep(2);
      if (result.newCredentials?.length) {
        setImportCreds(result.newCredentials);
      }
      void loadEmployees();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Ошибка импорта';
      void message.error(msg);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadImportCredentials = () => {
    if (!importCreds.length) return;
    const portalUrl = window.location.origin;
    const rows = importCreds.map((c) => ({
      fullName: c.fullName,
      employeeCode: c.employeeCode,
      department: c.department ?? '',
      position: c.position ?? '',
      username: c.username,
      temporaryPassword: c.temporaryPassword,
    }));
    const wb = buildCredentialsWorkbook(rows, portalUrl);
    downloadCredentialsXlsx(wb, 'import_credentials.xlsx');
  };

  // ── Таблица ───────────────────────────────────────────────

  const tableColumns: ColumnsType<EmployeeItem> = [
    {
      title: 'ФИО',
      dataIndex: 'full_name',
      key: 'name',
      render: (name: string, record: EmployeeItem) => (
        <Space>
          {name}
          {!record.is_active && <Tag color="red">Заблокирован</Tag>}
          {record.must_change_password && <Tag color="orange">Смена пароля</Tag>}
        </Space>
      ),
    },
    { title: 'Логин', dataIndex: 'username', key: 'login' },
    { title: 'Код', dataIndex: 'employee_code', key: 'code' },
    { title: 'Роль', dataIndex: 'role_title', key: 'role' },
    {
      title: 'Отделение',
      key: 'depts',
      render: (_: unknown, record: EmployeeItem) => {
        const active = record.departments.filter((d) => d.is_active);
        if (!active.length) return <Text type="secondary">—</Text>;
        return (
          <Space direction="vertical" size={0}>
            {active.map((d) => <div key={d.id}>{d.name}</div>)}
          </Space>
        );
      },
    },
    {
      title: 'Должность',
      key: 'positions',
      render: (_: unknown, record: EmployeeItem) => {
        const active = record.departments.filter((d) => d.is_active);
        if (!active.length) return <Text type="secondary">—</Text>;
        return (
          <Space direction="vertical" size={0}>
            {active.map((d) => <div key={d.id}>{d.position}</div>)}
          </Space>
        );
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: EmployeeItem) => (
        <Space>
          <Button size="small" onClick={() => void toggleStatus(record)}>
            {record.is_active ? 'Заблокировать' : 'Разблокировать'}
          </Button>
          <Button size="small" danger onClick={() => void handleResetPassword(record)}>
            Сбросить пароль
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="admin-employees-page">
      <div className="admin-employees-page__toolbar">
        <Space wrap>
          <Input.Search
            placeholder="Поиск по ФИО, логину, коду..."
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            onSearch={() => void loadEmployees()}
            allowClear
            style={{ width: 280 }}
          />
          <Select
            placeholder="Роль"
            allowClear
            value={filterRole}
            onChange={(value: string | undefined) => {
              setFilterRole(value);
              setPage(1);
            }}
            options={roles.map((r) => ({ value: r.value, label: r.title }))}
            style={{ width: 200 }}
            showSearch
            optionFilterProp="label"
          />
          <Select
            placeholder="Отделение"
            allowClear
            value={filterDepartmentId}
            onChange={(value: number | undefined) => {
              setFilterDepartmentId(value);
              setPage(1);
            }}
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            style={{ width: 240 }}
            showSearch
            optionFilterProp="label"
          />
          <Upload beforeUpload={(file) => { void handleFileUpload(file); return false; }} accept=".xlsx" showUploadList={false}>
            <Button icon={<UploadOutlined />}>Импорт Excel</Button>
          </Upload>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            Добавить
          </Button>
        </Space>
      </div>

      <Table
        dataSource={employees}
        rowKey="id"
        columns={tableColumns}
        loading={loading}
        size="small"
        pagination={{ total, current: page, pageSize: 50, onChange: setPage, showSizeChanger: false }}
      />

      {/* Создание сотрудника */}
      <Modal
        title="Новый сотрудник"
        open={createOpen}
        onCancel={() => { setCreateOpen(false); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={createLoading}
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="fullName" label="ФИО" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="employeeCode" label="Код сотрудника (необязательно)">
            <Input placeholder="Оставьте пустым для автогенерации" />
          </Form.Item>
          <Form.List name="depts" initialValue={[{}]}>
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...rest }) => (
                  <Space key={key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                    <Form.Item
                      {...rest}
                      name={[name, 'departmentId']}
                      rules={[{ required: true, message: 'Выберите отделение' }]}
                    >
                      <Select
                        placeholder="Отделение"
                        style={{ width: 200 }}
                        options={departments.map((d) => ({ label: d.name, value: d.id }))}
                        showSearch
                        filterOption={(input, opt) =>
                          (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>
                    <Form.Item
                      {...rest}
                      name={[name, 'position']}
                      rules={[{ required: true, message: 'Введите должность' }]}
                    >
                      <Input placeholder="Должность" style={{ width: 200 }} />
                    </Form.Item>
                    {fields.length > 1 && (
                      <Button danger size="small" onClick={() => remove(name)}>✕</Button>
                    )}
                  </Space>
                ))}
                <Button size="small" onClick={() => add()}>+ Добавить отделение</Button>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>

      {/* Отображение временного пароля */}
      <Modal
        title="Данные доступа"
        open={credentialsModalOpen}
        onCancel={handleCloseCredentials}
        footer={[
          <Button key="download" type="primary" onClick={downloadCredentials}>
            Скачать Excel
          </Button>,
          <Button key="close" onClick={handleCloseCredentials}>
            Закрыть
          </Button>,
        ]}
        destroyOnHidden
      >
        <Alert
          type="warning"
          message="Сохраните данные сейчас. После закрытия окна они будут недоступны."
          style={{ marginBottom: 12 }}
        />
        {credentialsRef.current.map((c, i) => (
          <div key={i} style={{ marginBottom: 8, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
            <div><strong>ФИО:</strong> {c.fullName}</div>
            <div><strong>Логин:</strong> {c.username}</div>
            <div><strong>Временный пароль:</strong> <code>{c.temporaryPassword}</code></div>
          </div>
        ))}
      </Modal>

      {/* Импорт Excel */}
      <Modal
        title="Импорт сотрудников из Excel"
        open={importOpen}
        onCancel={() => { setImportOpen(false); setImportStep(0); setImportCreds([]); }}
        footer={null}
        width={700}
        destroyOnHidden
      >
        <Steps
          current={importStep}
          items={[
            { title: 'Выбор листа' },
            { title: 'Предварительный просмотр' },
            { title: 'Итог' },
          ]}
          style={{ marginBottom: 24 }}
        />

        {importStep === 0 && workbook && (
          <>
            <Form.Item label="Выберите лист">
              <Select
                value={selectedSheet}
                onChange={setSelectedSheet}
                options={workbook.SheetNames.map((s) => ({ label: s, value: s }))}
                style={{ width: 200 }}
              />
            </Form.Item>
            <Button type="primary" loading={importLoading} onClick={() => void handleImportPreview()}>
              Проверить данные
            </Button>
          </>
        )}

        {importStep === 1 && importPreviewData && (
          <>
            <Alert
              type={importPreviewData.canCommit ? 'success' : 'warning'}
              message={
                importPreviewData.canCommit
                  ? 'Данные проверены. Нет конфликтов.'
                  : `Есть конфликты (${importPreviewData.summary.conflicts}) или ошибки (${importPreviewData.summary.errors}). Разрешите их перед импортом.`
              }
              style={{ marginBottom: 12 }}
            />
            <Text type="secondary">
              Новых пользователей: {importPreviewData.summary.newUsers} ·
              Новых привязок: {importPreviewData.summary.newMemberships} ·
              Конфликтов: {importPreviewData.summary.conflicts} ·
              Ошибок: {importPreviewData.summary.errors}
            </Text>
            <Table
              dataSource={importPreviewData.rows}
              rowKey="sourceRow"
              size="small"
              style={{ marginTop: 12 }}
              columns={[
                { title: '#', dataIndex: 'sourceRow', key: 'row', width: 46 },
                { title: 'ФИО', dataIndex: 'fullName', key: 'name', width: 220 },
                {
                  title: 'Отделение',
                  key: 'dept',
                  render: (_: unknown, r: { sourceRow: number; status: string; departmentName: string; message?: string }) => {
                    const isDeptError = r.status === 'error' && (r.message ?? '').includes('не найден');
                    if (isDeptError) {
                      return (
                        <Select
                          placeholder="Выберите отделение"
                          style={{ width: '100%', minWidth: 200 }}
                          value={deptCorrections[r.sourceRow]}
                          onChange={(id: number) =>
                            setDeptCorrections((prev) => ({ ...prev, [r.sourceRow]: id }))
                          }
                          options={departments.map((d) => ({ label: d.name, value: d.id }))}
                          showSearch
                          filterOption={(input, opt) =>
                            (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          size="small"
                        />
                      );
                    }
                    return r.departmentName;
                  },
                },
                { title: 'Должность', dataIndex: 'position', key: 'pos' },
                {
                  title: 'Статус',
                  key: 'status',
                  width: 160,
                  render: (_: unknown, r: { sourceRow: number; status: string; message?: string }) => {
                    const isDeptError = r.status === 'error' && (r.message ?? '').includes('не найден');
                    const isCorrected = isDeptError && deptCorrections[r.sourceRow];
                    return (
                      <Space direction="vertical" size={0}>
                        <Tag color={
                          isCorrected ? 'processing' :
                          r.status === 'new_user' ? 'blue' :
                          r.status === 'existing_user' ? 'green' :
                          r.status === 'error' ? 'red' :
                          r.status === 'conflict' ? 'orange' : 'default'
                        }>
                          {isCorrected ? 'Исправлено ↻' : (IMPORT_STATUS_LABELS[r.status] ?? r.status)}
                        </Tag>
                        {r.message && !isDeptError && (
                          <Text type="secondary" style={{ fontSize: 11 }}>{r.message}</Text>
                        )}
                      </Space>
                    );
                  },
                },
              ]}
              pagination={{ pageSize: 15, showSizeChanger: false }}
            />
            <Space style={{ marginTop: 16 }} wrap>
              <Button onClick={() => setImportStep(0)}>Назад</Button>
              {Object.keys(deptCorrections).length > 0 && (
                <Button
                  loading={importLoading}
                  onClick={() => void handleResubmitWithCorrections()}
                >
                  Проверить снова с исправлениями ({Object.keys(deptCorrections).length})
                </Button>
              )}
              <Button
                type="primary"
                disabled={!importPreviewData.canCommit}
                loading={importLoading}
                onClick={() => void handleImportCommit()}
              >
                Применить импорт
              </Button>
            </Space>
          </>
        )}

        {importStep === 2 && (
          <>
            <Alert type="success" message="Импорт выполнен успешно" style={{ marginBottom: 12 }} />
            {importCreds.length > 0 ? (
              <>
                <Alert
                  type="warning"
                  message={`Создано ${importCreds.length} новых аккаунтов. Скачайте данные доступа сейчас.`}
                  style={{ marginBottom: 12 }}
                />
                <Button type="primary" onClick={downloadImportCredentials}>
                  Скачать данные доступа (Excel)
                </Button>
              </>
            ) : (
              <Text type="secondary">Новых аккаунтов не создано (все уже существуют).</Text>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
