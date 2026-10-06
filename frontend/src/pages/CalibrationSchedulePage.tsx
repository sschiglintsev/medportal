import { DeleteOutlined, DownloadOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Collapse, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Upload, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { formatDate } from '../Core/date.utils';
import { fetchDepartments } from '../Core/services/incident.service';
import {
  clearCalibrationSchedule,
  createCalibrationItem,
  deleteCalibrationItem,
  fetchCalibrationSchedule,
  importCalibrationSchedule,
  updateCalibrationItem,
  type CalibrationSchedulePayload,
} from '../Core/services/calibration-schedule.service';
import { useAppStore } from '../Core/store/app.store';
import type { CalibrationScheduleItem, Department } from '../Core/types/common';
import {
  CALIBRATION_SORT_OPTIONS,
  sortCalibrationItems,
  type CalibrationSortKey,
} from '../Core/utils/calibrationSchedule.view';
import { parseCalibrationExcel } from '../Core/utils/parseCalibrationExcel';
import './CalibrationSchedulePage.scss';

type FormValues = {
  commissioning_date?: Dayjs;
  nomenclature: string;
  type?: string;
  inventory_number?: string;
  serial_number?: string;
  manufacture_date?: Dayjs;
  department_id?: number;
  quantity?: number;
  verification_kind?: string;
  current_verification_date?: Dayjs;
  next_verification_date?: Dayjs;
  note?: string;
};

type CalibrationSchedulePageProps = {
  compact?: boolean;
};

type Filters = {
  commissioning_date?: Dayjs;
  nomenclature: string;
  type: string;
  inventory_number: string;
  serial_number: string;
  manufacture_date?: Dayjs;
  department_id?: number;
  quantity?: number | null;
  verification_kind: string;
  current_verification_date?: Dayjs;
  next_verification_date?: Dayjs;
  note: string;
};

const EMPTY_FILTERS: Filters = {
  nomenclature: '',
  type: '',
  inventory_number: '',
  serial_number: '',
  verification_kind: '',
  note: '',
};

function matchesText(value: string | null | undefined, query: string): boolean {
  if (!query.trim()) return true;
  return (value ?? '').toLowerCase().includes(query.trim().toLowerCase());
}

function matchesDate(value: string | null | undefined, date?: Dayjs): boolean {
  if (!date) return true;
  return value === date.format('YYYY-MM-DD');
}

function exportDate(value: string | null | undefined): string {
  if (!value) return '';
  const formatted = formatDate(value);
  return formatted === '-' ? '' : formatted;
}

function toDateString(value?: Dayjs): string | null {
  return value ? value.format('YYYY-MM-DD') : null;
}

function toDayjs(value: string | null | undefined): Dayjs | undefined {
  if (!value) return undefined;
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
}

export function CalibrationSchedulePage({ compact = false }: CalibrationSchedulePageProps) {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<CalibrationScheduleItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalibrationScheduleItem | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sortKey, setSortKey] = useState<CalibrationSortKey | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [form] = Form.useForm<FormValues>();

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCalibrationSchedule();
      setItems(data);
    } catch {
      message.error('Не удалось загрузить график поверок');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
    void fetchDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, [loadItems]);

  const openAddModal = () => {
    setEditingItem(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEditModal = (item: CalibrationScheduleItem) => {
    setEditingItem(item);
    form.setFieldsValue({
      commissioning_date: toDayjs(item.commissioning_date),
      nomenclature: item.nomenclature,
      type: item.type ?? undefined,
      inventory_number: item.inventory_number ?? undefined,
      serial_number: item.serial_number ?? undefined,
      manufacture_date: toDayjs(item.manufacture_date),
      department_id: item.department_id ?? undefined,
      quantity: item.quantity ?? undefined,
      verification_kind: item.verification_kind ?? undefined,
      current_verification_date: toDayjs(item.current_verification_date),
      next_verification_date: toDayjs(item.next_verification_date),
      note: item.note ?? undefined,
    });
    setModalOpen(true);
  };

  const handleCancel = () => {
    setModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const buildPayload = (values: FormValues): CalibrationSchedulePayload => ({
    commissioning_date: toDateString(values.commissioning_date),
    nomenclature: values.nomenclature.trim(),
    type: values.type?.trim() || null,
    inventory_number: values.inventory_number?.trim() || null,
    serial_number: values.serial_number?.trim() || null,
    manufacture_date: toDateString(values.manufacture_date),
    department_id: values.department_id ?? null,
    quantity: values.quantity ?? null,
    verification_kind: values.verification_kind?.trim() || null,
    current_verification_date: toDateString(values.current_verification_date),
    next_verification_date: toDateString(values.next_verification_date),
    note: values.note?.trim() || null,
  });

  const onFinish = async (values: FormValues) => {
    if (!token) {
      message.error('Требуется авторизация');
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      if (editingItem) {
        await updateCalibrationItem(editingItem.id, payload, { token });
        message.success('Запись обновлена');
      } else {
        await createCalibrationItem(payload, { token });
        message.success('Запись добавлена');
      }
      handleCancel();
      await loadItems();
    } catch {
      message.error(editingItem ? 'Не удалось сохранить запись' : 'Не удалось добавить запись');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!token) return;
    try {
      await deleteCalibrationItem(id, { token });
      message.success('Запись удалена');
      await loadItems();
    } catch {
      message.error('Не удалось удалить запись');
    }
  };

  const handleExcelUpload = async (file: File) => {
    if (!token) {
      message.error('Требуется авторизация');
      return false;
    }
    setImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseCalibrationExcel(buffer);
      if (parsed.length === 0) {
        message.error('В файле не найдены строки графика поверок');
        return false;
      }
      const result = await importCalibrationSchedule(parsed, { token });
      message.success(`Загружено записей: ${result.imported}`);
      await loadItems();
    } catch {
      message.error('Не удалось загрузить Excel');
    } finally {
      setImporting(false);
    }
    return false;
  };

  const handleClearAll = async () => {
    if (!token) return;
    setClearing(true);
    try {
      const result = await clearCalibrationSchedule({ token });
      message.success(`Удалено записей: ${result.deleted}`);
      await loadItems();
    } catch {
      message.error('Не удалось удалить данные');
    } finally {
      setClearing(false);
    }
  };

  const filtered = useMemo(() => {
    const next = items.filter((item) =>
      matchesDate(item.commissioning_date, filters.commissioning_date)
      && matchesText(item.nomenclature, filters.nomenclature)
      && matchesText(item.type, filters.type)
      && matchesText(item.inventory_number, filters.inventory_number)
      && matchesText(item.serial_number, filters.serial_number)
      && matchesDate(item.manufacture_date, filters.manufacture_date)
      && (filters.department_id == null || item.department_id === filters.department_id)
      && (filters.quantity == null || item.quantity === filters.quantity)
      && matchesText(item.verification_kind, filters.verification_kind)
      && matchesDate(item.current_verification_date, filters.current_verification_date)
      && matchesDate(item.next_verification_date, filters.next_verification_date)
      && matchesText(item.note, filters.note),
    );
    return sortCalibrationItems(next, sortKey, sortDirection);
  }, [items, filters, sortKey, sortDirection]);

  const handleExcelDownload = () => {
    if (filtered.length === 0) return;
    const rows = filtered.map((item) => ({
      'Дата ввода в эксплуатацию': exportDate(item.commissioning_date),
      'Номенклатура (наименование)': item.nomenclature,
      'Тип': item.type ?? '',
      'Инвентарный номер': item.inventory_number ?? '',
      'Заводской номер': item.serial_number ?? '',
      'Дата выпуска': exportDate(item.manufacture_date),
      'Отделение': item.department_name ?? '',
      'Количество': item.quantity ?? '',
      'Поверка, МКС, ПИ': item.verification_kind ?? '',
      'Дата действующей поверки, МКС или ПИ': exportDate(item.current_verification_date),
      'Дата следующей поверки, МКС или ПИ': exportDate(item.next_verification_date),
      'Примечание': item.note ?? '',
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'График поверок');
    XLSX.writeFile(workbook, `grafik_poverok_${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const columns: ColumnsType<CalibrationScheduleItem> = compact
    ? [
        {
          title: 'Дата действующей поверки',
          dataIndex: 'current_verification_date',
          key: 'current_verification_date',
          width: 180,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        {
          title: 'Дата следующей поверки',
          dataIndex: 'next_verification_date',
          key: 'next_verification_date',
          width: 180,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        { title: 'Номенклатура (наименование)', dataIndex: 'nomenclature', key: 'nomenclature', ellipsis: true },
        { title: 'Тип', dataIndex: 'type', key: 'type', width: 160, render: (value: string | null) => value ?? '—' },
        {
          title: 'Дата ввода в эксплуатацию',
          dataIndex: 'commissioning_date',
          key: 'commissioning_date',
          width: 180,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
      ]
    : [
        {
          title: 'Дата ввода в эксплуатацию',
          dataIndex: 'commissioning_date',
          key: 'commissioning_date',
          width: 150,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        { title: 'Номенклатура (наименование)', dataIndex: 'nomenclature', key: 'nomenclature', width: 280, ellipsis: true },
        { title: 'Тип', dataIndex: 'type', key: 'type', width: 140, render: (value: string | null) => value ?? '—' },
        { title: 'Инв. номер', dataIndex: 'inventory_number', key: 'inventory_number', width: 140, render: (value: string | null) => value ?? '—' },
        { title: 'Зав. номер', dataIndex: 'serial_number', key: 'serial_number', width: 140, render: (value: string | null) => value ?? '—' },
        {
          title: 'Дата выпуска',
          dataIndex: 'manufacture_date',
          key: 'manufacture_date',
          width: 130,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        { title: 'Отделение', dataIndex: 'department_name', key: 'department_name', width: 180, render: (value: string | null) => value ?? '—' },
        { title: 'Кол-во', dataIndex: 'quantity', key: 'quantity', width: 80, render: (value: number | null) => value ?? '—' },
        { title: 'Поверка, МКС, ПИ', dataIndex: 'verification_kind', key: 'verification_kind', width: 140, render: (value: string | null) => value ?? '—' },
        {
          title: 'Дата действующей поверки',
          dataIndex: 'current_verification_date',
          key: 'current_verification_date',
          width: 170,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        {
          title: 'Дата следующей поверки',
          dataIndex: 'next_verification_date',
          key: 'next_verification_date',
          width: 170,
          render: (value: string | null) => (value ? formatDate(value) : '—'),
        },
        { title: 'Примечание', dataIndex: 'note', key: 'note', width: 160, ellipsis: true, render: (value: string | null) => value ?? '—' },
      ];

  columns.push({
    title: '',
    key: 'actions',
    width: 90,
    fixed: 'right',
    render: (_: unknown, record: CalibrationScheduleItem) => (
      <Space className="calibration-schedule-page__table-actions">
        <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
        <Popconfirm
          title="Удалить запись?"
          okText="Удалить"
          cancelText="Отмена"
          okButtonProps={{ danger: true }}
          onConfirm={() => void handleDelete(record.id)}
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
  });

  return (
    <section className="calibration-schedule-page">
      <div className="calibration-schedule-page__toolbar">
        <Space wrap>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={(file) => {
              void handleExcelUpload(file);
              return false;
            }}
          >
            <Button icon={<UploadOutlined />} loading={importing}>
              Загрузить Excel
            </Button>
          </Upload>
          <Button
            icon={<DownloadOutlined />}
            onClick={handleExcelDownload}
            disabled={filtered.length === 0}
          >
            Выгрузить в Excel
          </Button>
          <Popconfirm
            title="Удалить все данные графика поверок?"
            description="Будет очищена вся таблица. Это действие нельзя отменить."
            okText="Удалить всё"
            cancelText="Отмена"
            okButtonProps={{ danger: true }}
            onConfirm={() => void handleClearAll()}
          >
            <Button danger icon={<DeleteOutlined />} loading={clearing} disabled={items.length === 0}>
              Удалить все данные
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal}>
            Добавить
          </Button>
        </Space>
      </div>

      <Collapse
        className="calibration-schedule-page__collapse"
        items={[
          {
            key: 'filters',
            label: 'Фильтры',
            children: (
              <div className="calibration-schedule-page__filters">
                <DatePicker
                  allowClear
                  size="small"
                  format="DD.MM.YYYY"
                  placeholder="Дата ввода в эксплуатацию"
                  value={filters.commissioning_date}
                  onChange={(value) => setFilters((prev) => ({ ...prev, commissioning_date: value ?? undefined }))}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Номенклатура (наименование)"
                  value={filters.nomenclature}
                  onChange={(event) => setFilters((prev) => ({ ...prev, nomenclature: event.target.value }))}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Тип"
                  value={filters.type}
                  onChange={(event) => setFilters((prev) => ({ ...prev, type: event.target.value }))}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Инвентарный номер"
                  value={filters.inventory_number}
                  onChange={(event) => setFilters((prev) => ({ ...prev, inventory_number: event.target.value }))}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Заводской номер"
                  value={filters.serial_number}
                  onChange={(event) => setFilters((prev) => ({ ...prev, serial_number: event.target.value }))}
                />
                <DatePicker
                  allowClear
                  size="small"
                  format="DD.MM.YYYY"
                  placeholder="Дата выпуска"
                  value={filters.manufacture_date}
                  onChange={(value) => setFilters((prev) => ({ ...prev, manufacture_date: value ?? undefined }))}
                />
                <Select
                  allowClear
                  showSearch
                  size="small"
                  optionFilterProp="label"
                  placeholder="Отделение"
                  value={filters.department_id}
                  onChange={(value) => setFilters((prev) => ({ ...prev, department_id: value }))}
                  options={departments.map((department) => ({ value: department.id, label: department.name }))}
                />
                <InputNumber
                  size="small"
                  placeholder="Количество"
                  value={filters.quantity ?? undefined}
                  onChange={(value) => setFilters((prev) => ({ ...prev, quantity: value }))}
                  min={0}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Поверка, МКС, ПИ"
                  value={filters.verification_kind}
                  onChange={(event) => setFilters((prev) => ({ ...prev, verification_kind: event.target.value }))}
                />
                <DatePicker
                  allowClear
                  size="small"
                  format="DD.MM.YYYY"
                  placeholder="Дата действующей поверки"
                  value={filters.current_verification_date}
                  onChange={(value) => setFilters((prev) => ({ ...prev, current_verification_date: value ?? undefined }))}
                />
                <DatePicker
                  allowClear
                  size="small"
                  format="DD.MM.YYYY"
                  placeholder="Дата следующей поверки"
                  value={filters.next_verification_date}
                  onChange={(value) => setFilters((prev) => ({ ...prev, next_verification_date: value ?? undefined }))}
                />
                <Input
                  allowClear
                  size="small"
                  placeholder="Примечание"
                  value={filters.note}
                  onChange={(event) => setFilters((prev) => ({ ...prev, note: event.target.value }))}
                />
                <Button size="small" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Сбросить
                </Button>
              </div>
            ),
          },
        ]}
      />

      <div className="calibration-schedule-page__sort">
        <Select
          allowClear
          size="small"
          placeholder="Сортировать по"
          value={sortKey ?? undefined}
          onChange={(value) => setSortKey(value ?? null)}
          options={CALIBRATION_SORT_OPTIONS}
        />
        <Select
          size="small"
          value={sortDirection}
          onChange={setSortDirection}
          options={[
            { value: 'asc', label: 'По возрастанию' },
            { value: 'desc', label: 'По убыванию' },
          ]}
        />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filtered}
        columns={columns}
        pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Всего: ${total}` }}
        scroll={{ x: compact ? 980 : 1900 }}
        locale={{ emptyText: 'График поверок пока пуст' }}
      />

      <Modal
        title={editingItem ? 'Изменить запись' : 'Добавить запись'}
        open={modalOpen}
        onCancel={handleCancel}
        footer={null}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" onFinish={(values) => void onFinish(values)} style={{ marginTop: 8 }}>
          <div className="calibration-schedule-page__form-grid">
            <Form.Item name="commissioning_date" label="Дата ввода в эксплуатацию">
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="manufacture_date" label="Дата выпуска">
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item
            name="nomenclature"
            label="Номенклатура (наименование)"
            rules={[{ required: true, message: 'Введите номенклатуру (наименование)' }]}
          >
            <Input />
          </Form.Item>
          <div className="calibration-schedule-page__form-grid">
            <Form.Item name="type" label="Тип">
              <Input />
            </Form.Item>
            <Form.Item name="quantity" label="Количество">
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div className="calibration-schedule-page__form-grid">
            <Form.Item name="inventory_number" label="Инвентарный номер">
              <Input />
            </Form.Item>
            <Form.Item name="serial_number" label="Заводской номер">
              <Input />
            </Form.Item>
          </div>
          <div className="calibration-schedule-page__form-grid">
            <Form.Item name="department_id" label="Отделение">
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Выберите отделение"
                options={departments.map((department) => ({ value: department.id, label: department.name }))}
              />
            </Form.Item>
            <Form.Item name="verification_kind" label="Поверка, МКС, ПИ">
              <Input />
            </Form.Item>
          </div>
          <div className="calibration-schedule-page__form-grid">
            <Form.Item name="current_verification_date" label="Дата действующей поверки, МКС или ПИ">
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="next_verification_date" label="Дата следующей поверки, МКС или ПИ">
              <DatePicker format="DD.MM.YYYY" style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="note" label="Примечание">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting}>
              {editingItem ? 'Сохранить' : 'Добавить'}
            </Button>
            <Button onClick={handleCancel}>Отмена</Button>
          </Space>
        </Form>
      </Modal>
    </section>
  );
}
