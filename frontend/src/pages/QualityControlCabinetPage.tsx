import { FileTextOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, DatePicker, Descriptions, Menu, Modal, Select, Space, Table, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

import { formatDate, formatDateTime, formatTime } from '../Core/date.utils';
import { fetchIncidents } from '../Core/services/incident.service';
import { useAppStore } from '../Core/store/app.store';
import type { Incident } from '../Core/types/common';
import { AdminDocumentsPage } from './AdminDocumentsPage';
import './QualityControlCabinetPage.scss';

export function QualityControlCabinetPage() {
  const [activeSection, setActiveSection] = useState('incidents');
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedIncidentType, setSelectedIncidentType] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const token = useAppStore((state) => state.token);

  const loadIncidents = useCallback(async () => {
    if (!token) {
      return;
    }

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
      Array.from(new Set(items.map((item) => item.department_name).filter(Boolean))).map((name) => ({
        value: name as string,
        label: name as string,
      })),
    [items],
  );

  const incidentTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.incident_type_name).filter(Boolean))).map((name) => ({
        value: name as string,
        label: name as string,
      })),
    [items],
  );

  const statusOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.status))).map((status) => ({
        value: status,
        label: status,
      })),
    [items],
  );

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (selectedDate && item.incident_date !== selectedDate) {
          return false;
        }
        if (selectedDepartment && item.department_name !== selectedDepartment) {
          return false;
        }
        if (selectedIncidentType && item.incident_type_name !== selectedIncidentType) {
          return false;
        }
        if (selectedStatus && item.status !== selectedStatus) {
          return false;
        }
        return true;
      }),
    [items, selectedDate, selectedDepartment, selectedIncidentType, selectedStatus],
  );

  const resetFilters = () => {
    setSelectedDate(null);
    setSelectedDepartment(null);
    setSelectedIncidentType(null);
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
      Место: item.place,
      Пациент: item.patient_fio,
      'Дата рождения пациента': formatDate(item.patient_birth_date),
      Сотрудник: item.employee_fio,
      Должность: item.employee_position,
      'Юридическое присутствие': item.legal_presence,
      Отделение: item.department_name ?? '',
      'Тип инцидента': item.incident_type_name ?? '',
      Обстоятельства: item.circumstances,
      Последствия: item.consequences,
      Статус: item.status,
      Создано: formatDateTime(item.created_at),
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Инциденты');

    const now = new Date();
    const fileSuffix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate(),
    ).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(
      2,
      '0',
    )}`;
    XLSX.writeFile(workbook, `incidents_${fileSuffix}.xlsx`);
  };

  return (
    <section className="quality-control-cabinet-page">
      <div className="quality-control-cabinet-page__layout">
        <aside className="quality-control-cabinet-page__sidebar">
          <Menu
            mode="inline"
            selectedKeys={[activeSection]}
            onClick={({ key }) => setActiveSection(key)}
            items={[
              { key: 'incidents', icon: <UnorderedListOutlined />, label: 'Нежелательные события' },
              { key: 'documents', icon: <FileTextOutlined />, label: 'Документы' },
            ]}
          />
        </aside>

        <div className="quality-control-cabinet-page__content">
          {activeSection === 'documents' ? (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Документы
              </Typography.Title>
              <AdminDocumentsPage />
            </>
          ) : (
            <>
              <Typography.Title level={4} className="quality-control-cabinet-page__title">
                Нежелательные события
              </Typography.Title>

              <Space size={10} wrap className="quality-control-cabinet-page__filters">
                <DatePicker
                  placeholder="Дата инцидента"
                  format="DD.MM.YYYY"
                  allowClear
                  onChange={(date) => {
                    setSelectedDate(date ? date.format('YYYY-MM-DD') : null);
                  }}
                />
                <Select
                  placeholder="Отделение"
                  allowClear
                  options={departmentOptions}
                  value={selectedDepartment ?? undefined}
                  onChange={(value) => setSelectedDepartment(value ?? null)}
                  style={{ minWidth: 200 }}
                />
                <Select
                  placeholder="Тип инцидента"
                  allowClear
                  options={incidentTypeOptions}
                  value={selectedIncidentType ?? undefined}
                  onChange={(value) => setSelectedIncidentType(value ?? null)}
                  style={{ minWidth: 200 }}
                />
                <Select
                  placeholder="Статус"
                  allowClear
                  options={statusOptions}
                  value={selectedStatus ?? undefined}
                  onChange={(value) => setSelectedStatus(value ?? null)}
                  style={{ minWidth: 160 }}
                />
                <Button onClick={resetFilters}>Сбросить фильтры</Button>
                <Button type="primary" onClick={() => void loadIncidents()} loading={loading}>
                  Обновить
                </Button>
                <Button onClick={exportToExcel}>Экспорт в Excel</Button>
              </Space>

              <Table
                rowKey="id"
                loading={loading}
                dataSource={filteredItems}
                scroll={{ x: 760 }}
                onRow={(record) => ({
                  onClick: () => setSelectedIncident(record),
                  className: 'quality-control-cabinet-page__clickable-row',
                })}
                columns={[
                  { title: 'ID', dataIndex: 'id', key: 'id', width: '10%' },
                  {
                    title: 'Дата',
                    dataIndex: 'incident_date',
                    key: 'incident_date',
                    width: '18%',
                    render: (value: string) => formatDate(value),
                  },
                  {
                    title: 'Время',
                    dataIndex: 'incident_time',
                    key: 'incident_time',
                    width: '16%',
                    render: (value: string) => formatTime(value),
                  },
                  { title: 'Место', dataIndex: 'place', key: 'place', width: '32%' },
                  { title: 'Отделение', dataIndex: 'department_name', key: 'department_name', width: '24%' },
                ]}
              />
            </>
          )}
        </div>
      </div>

      <Modal
        title={selectedIncident ? `Инцидент #${selectedIncident.id}` : 'Инцидент'}
        open={Boolean(selectedIncident)}
        onCancel={() => setSelectedIncident(null)}
        footer={null}
        width={900}
        destroyOnClose
      >
        {selectedIncident ? (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Дата">{formatDate(selectedIncident.incident_date)}</Descriptions.Item>
            <Descriptions.Item label="Время">{formatTime(selectedIncident.incident_time)}</Descriptions.Item>
            <Descriptions.Item label="Место">{selectedIncident.place}</Descriptions.Item>
            <Descriptions.Item label="Отделение">
              {selectedIncident.department_name ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Тип инцидента">
              {selectedIncident.incident_type_name ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="Статус">{selectedIncident.status}</Descriptions.Item>
            <Descriptions.Item label="Пациент">{selectedIncident.patient_fio}</Descriptions.Item>
            <Descriptions.Item label="Дата рождения пациента">
              {formatDate(selectedIncident.patient_birth_date)}
            </Descriptions.Item>
            <Descriptions.Item label="Сотрудник">{selectedIncident.employee_fio}</Descriptions.Item>
            <Descriptions.Item label="Должность">{selectedIncident.employee_position}</Descriptions.Item>
            <Descriptions.Item label="Юридическое присутствие">
              {selectedIncident.legal_presence}
            </Descriptions.Item>
            <Descriptions.Item label="Обстоятельства">
              {selectedIncident.circumstances}
            </Descriptions.Item>
            <Descriptions.Item label="Последствия">
              {selectedIncident.consequences}
            </Descriptions.Item>
            <Descriptions.Item label="Создано">
              {formatDateTime(selectedIncident.created_at)}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </section>
  );
}
