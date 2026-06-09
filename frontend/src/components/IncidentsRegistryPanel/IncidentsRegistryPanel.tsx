import { Button, DatePicker, Descriptions, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { formatDate, formatDateTime, formatTime } from '../../Core/date.utils';
import { fetchIncidents } from '../../Core/services/incident.service';
import { useAppStore } from '../../Core/store/app.store';
import type { Incident } from '../../Core/types/common';
import './IncidentsRegistryPanel.scss';

const SEVERITY_LABELS: Record<string, string> = {
  light: 'Лёгкий',
  medium: 'Средний',
  severe: 'Тяжёлый',
};

const SEVERITY_COLORS: Record<string, string> = {
  light: 'green',
  medium: 'orange',
  severe: 'red',
};

const LEGAL_PRESENCE_LABELS: Record<string, string> = {
  YES: 'Да',
  NO: 'Нет',
  UNKNOWN: 'Неизвестно',
};

function SeverityTag({ value }: { value: string | null }) {
  if (!value) return <span>—</span>;
  return <Tag color={SEVERITY_COLORS[value] ?? 'default'}>{SEVERITY_LABELS[value] ?? value}</Tag>;
}

export function IncidentsRegistryPanel({ hideTitle }: { hideTitle?: boolean } = {}) {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCareType, setSelectedCareType] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedViewType, setSelectedViewType] = useState<string | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const token = useAppStore((state) => state.token);

  const loadIncidents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchIncidents({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить инциденты');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.department_name).filter(Boolean))).map((n) => ({
        value: n as string, label: n as string,
      })),
    [items],
  );

  const viewTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.incident_view_type_name).filter(Boolean))).map((n) => ({
        value: n as string, label: n as string,
      })),
    [items],
  );

  const incidentTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((i) => i.incident_type_name).filter(Boolean))).map((n) => ({
        value: n as string, label: n as string,
      })),
    [items],
  );

  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.status))).map((s) => ({ value: s, label: s })),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (selectedDate && item.incident_date !== selectedDate) return false;
        if (selectedCareType && item.care_type !== selectedCareType) return false;
        if (selectedDepartment && item.department_name !== selectedDepartment) return false;
        if (selectedViewType && item.incident_view_type_name !== selectedViewType) return false;
        if (selectedIncidentType && item.incident_type_name !== selectedIncidentType) return false;
        if (selectedSeverity && item.severity_level !== selectedSeverity) return false;
        if (selectedStatus && item.status !== selectedStatus) return false;
        return true;
      }),
    [items, selectedDate, selectedCareType, selectedDepartment, selectedViewType, selectedIncidentType, selectedSeverity, selectedStatus],
  );

  const resetFilters = () => {
    setSelectedDate(null);
    setSelectedCareType(null);
    setSelectedDepartment(null);
    setSelectedViewType(null);
    setSelectedIncidentType(null);
    setSelectedSeverity(null);
    setSelectedStatus(null);
  };

  const exportToExcel = () => {
    if (filteredItems.length === 0) {
      message.warning('Нет данных для экспорта');
      return;
    }

    const exportRows = filteredItems.map((item) => ({
      ID: item.id,
      Дата: formatDate(item.incident_date),
      Время: formatTime(item.incident_time),
      'Вид медицинской помощи': item.care_type ?? '',
      Отделение: item.department_name ?? '',
      'Вид нежелательного события': item.incident_view_type_name ?? '',
      'Тип инцидента': item.incident_type_name ?? '',
      'Уровень тяжести': SEVERITY_LABELS[item.severity_level ?? ''] ?? '',
      Пациент: item.patient_fio,
      'Дата рождения пациента': formatDate(item.patient_birth_date),
      Обстоятельства: item.circumstances,
      'Присутствие законного представителя': LEGAL_PRESENCE_LABELS[item.legal_presence] ?? item.legal_presence,
      Сотрудник: item.employee_fio,
      Должность: item.employee_position,
      Статус: item.status,
      Создано: formatDateTime(item.created_at),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Инциденты');

    const now = new Date();
    const fileSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    XLSX.writeFile(workbook, `incidents_${fileSuffix}.xlsx`);
  };

  return (
    <div className="incidents-registry-panel">
      {!hideTitle && (
        <Typography.Title level={4} className="incidents-registry-panel__title">
          Нежелательные события
        </Typography.Title>
      )}

      <Space size={10} wrap className="incidents-registry-panel__filters">
        <DatePicker
          placeholder="Дата события"
          format="DD.MM.YYYY"
          allowClear
          onChange={(date) => setSelectedDate(date ? date.format('YYYY-MM-DD') : null)}
        />
        <Select
          placeholder="Вид мед. помощи"
          allowClear
          value={selectedCareType ?? undefined}
          onChange={(v) => setSelectedCareType(v ?? null)}
          style={{ minWidth: 170 }}
          options={[
            { value: 'Стационар', label: 'Стационар' },
            { value: 'Поликлиника', label: 'Поликлиника' },
          ]}
        />
        <Select
          placeholder="Отделение"
          allowClear
          options={departmentOptions}
          value={selectedDepartment ?? undefined}
          onChange={(v) => setSelectedDepartment(v ?? null)}
          style={{ minWidth: 180 }}
        />
        <Select
          placeholder="Вид нежелательного события"
          allowClear
          options={viewTypeOptions}
          value={selectedViewType ?? undefined}
          onChange={(v) => setSelectedViewType(v ?? null)}
          style={{ minWidth: 220 }}
        />
        <Select
          placeholder="Тип инцидента"
          allowClear
          options={incidentTypeOptions}
          value={selectedIncidentType ?? undefined}
          onChange={(v) => setSelectedIncidentType(v ?? null)}
          style={{ minWidth: 180 }}
        />
        <Select
          placeholder="Уровень тяжести"
          allowClear
          value={selectedSeverity ?? undefined}
          onChange={(v) => setSelectedSeverity(v ?? null)}
          style={{ minWidth: 160 }}
          options={[
            { value: 'light', label: 'Лёгкий' },
            { value: 'medium', label: 'Средний' },
            { value: 'severe', label: 'Тяжёлый' },
          ]}
        />
        <Select
          placeholder="Статус"
          allowClear
          options={statusOptions}
          value={selectedStatus ?? undefined}
          onChange={(v) => setSelectedStatus(v ?? null)}
          style={{ minWidth: 140 }}
        />
        <Button onClick={resetFilters}>Сбросить</Button>
        <Button type="primary" onClick={() => void loadIncidents()} loading={loading}>
          Обновить
        </Button>
        <Button onClick={exportToExcel}>Экспорт в Excel</Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredItems}
        scroll={{ x: 900 }}
        onRow={(record) => ({
          onClick: () => setSelectedIncident(record),
          className: 'incidents-registry-panel__clickable-row',
        })}
        columns={[
          { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
          {
            title: 'Дата',
            dataIndex: 'incident_date',
            key: 'incident_date',
            width: 110,
            render: (v: string) => formatDate(v),
          },
          {
            title: 'Вид мед. помощи',
            dataIndex: 'care_type',
            key: 'care_type',
            width: 130,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: 'Отделение',
            dataIndex: 'department_name',
            key: 'department_name',
            width: 160,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: 'Вид нежелательного события',
            dataIndex: 'incident_view_type_name',
            key: 'incident_view_type_name',
            width: 200,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: 'Тип инцидента',
            dataIndex: 'incident_type_name',
            key: 'incident_type_name',
            width: 160,
            render: (v: string | null) => v ?? '—',
          },
          {
            title: 'Уровень тяжести',
            dataIndex: 'severity_level',
            key: 'severity_level',
            width: 140,
            render: (v: string | null) => <SeverityTag value={v} />,
          },
        ]}
      />

      <Modal
        title={selectedIncident ? `Нежелательное событие #${selectedIncident.id}` : ''}
        open={Boolean(selectedIncident)}
        onCancel={() => setSelectedIncident(null)}
        footer={null}
        width={760}
        destroyOnClose
      >
        {selectedIncident && (
          <Descriptions bordered column={1} size="small" className="incidents-registry-panel__desc">
            <Descriptions.Item label="Дата">{formatDate(selectedIncident.incident_date)}</Descriptions.Item>
            <Descriptions.Item label="Время">{formatTime(selectedIncident.incident_time)}</Descriptions.Item>
            {selectedIncident.care_type
              ? <Descriptions.Item label="Вид медицинской помощи">{selectedIncident.care_type}</Descriptions.Item>
              : null}
            {selectedIncident.department_name
              ? <Descriptions.Item label="Отделение">{selectedIncident.department_name}</Descriptions.Item>
              : null}
            {selectedIncident.incident_view_type_name
              ? <Descriptions.Item label="Вид нежелательного события">{selectedIncident.incident_view_type_name}</Descriptions.Item>
              : null}
            {selectedIncident.incident_type_name
              ? <Descriptions.Item label="Тип инцидента">{selectedIncident.incident_type_name}</Descriptions.Item>
              : null}
            {selectedIncident.severity_level
              ? <Descriptions.Item label="Уровень тяжести"><SeverityTag value={selectedIncident.severity_level} /></Descriptions.Item>
              : null}
            <Descriptions.Item label="Пациент">{selectedIncident.patient_fio}</Descriptions.Item>
            <Descriptions.Item label="Дата рождения пациента">
              {formatDate(selectedIncident.patient_birth_date)}
            </Descriptions.Item>
            {selectedIncident.circumstances
              ? <Descriptions.Item label="Обстоятельства">{selectedIncident.circumstances}</Descriptions.Item>
              : null}
            {selectedIncident.place
              ? <Descriptions.Item label="Место">{selectedIncident.place}</Descriptions.Item>
              : null}
            {selectedIncident.consequences
              ? <Descriptions.Item label="Последствия">{selectedIncident.consequences}</Descriptions.Item>
              : null}
            <Descriptions.Item label="Присутствие законного представителя">
              {LEGAL_PRESENCE_LABELS[selectedIncident.legal_presence] ?? selectedIncident.legal_presence}
            </Descriptions.Item>
            <Descriptions.Item label="Сотрудник">{selectedIncident.employee_fio}</Descriptions.Item>
            <Descriptions.Item label="Должность">{selectedIncident.employee_position}</Descriptions.Item>
            <Descriptions.Item label="Статус">{selectedIncident.status}</Descriptions.Item>
            <Descriptions.Item label="Создано">{formatDateTime(selectedIncident.created_at)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
