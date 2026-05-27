import { Button, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import { fetchTransportRequests } from '../Core/services/transport-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { TransportRequest } from '../Core/types/common';
import './AdminTransportRequestsPage.scss';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

const STATUS_OPTIONS = Object.keys(STATUS_LABELS).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLORS[status] ?? 'default'}>{STATUS_LABELS[status] ?? status}</Tag>;
}

export function AdminTransportRequestsPage() {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<TransportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransportRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchTransportRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить транспортные заявки');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(items.map((it) => it.department).filter(Boolean)))
        .sort()
        .map((d) => ({ value: d, label: d })),
    [items],
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatus) result = result.filter((it) => it.status === filterStatus);
    if (filterDepartment) result = result.filter((it) => it.department === filterDepartment);
    return result;
  }, [items, filterStatus, filterDepartment]);

  return (
    <section className="admin-transport-requests-page">
      <Space size={10} wrap className="admin-transport-requests-page__filters">
        <Select
          placeholder="Фильтр по статусу"
          allowClear
          value={filterStatus ?? undefined}
          options={STATUS_OPTIONS}
          onChange={(val) => setFilterStatus(val ?? null)}
          style={{ minWidth: 180 }}
        />
        <Select
          placeholder="Фильтр по отделению"
          allowClear
          showSearch
          value={filterDepartment ?? undefined}
          options={departmentOptions}
          onChange={(val) => setFilterDepartment(val ?? null)}
          style={{ minWidth: 220 }}
        />
        <Button onClick={() => { setFilterStatus(null); setFilterDepartment(null); }}>Сбросить</Button>
        <Button type="primary" onClick={() => void loadRequests()} loading={loading}>
          Обновить
        </Button>
      </Space>

      <List
        loading={loading}
        dataSource={filteredItems}
        locale={{ emptyText: 'Пока нет транспортных заявок' }}
        renderItem={(item) => (
          <List.Item
            className="admin-transport-requests-page__item"
            onClick={() => setSelectedItem(item)}
          >
            <div className="admin-transport-requests-page__main">
              <div className="admin-transport-requests-page__title">
                #{item.id} — {item.initiator}
              </div>
              <div className="admin-transport-requests-page__meta">
                <span>{item.department}</span>
                <span>{item.route_from} → {item.route_to}</span>
                <span>{item.submission_date} {item.submission_time}</span>
                <span>{formatDateTime(item.created_at)}</span>
              </div>
              <Typography.Paragraph ellipsis={{ rows: 1 }} className="admin-transport-requests-page__text">
                {item.purpose}
              </Typography.Paragraph>
            </div>
            <StatusTag status={item.status} />
          </List.Item>
        )}
      />

      <Modal
        title={selectedItem ? `Транспортная заявка #${selectedItem.id}` : 'Транспортная заявка'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
        width={560}
      >
        {selectedItem && (
          <div className="admin-transport-requests-page__details">
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Инициатор:</strong> {selectedItem.initiator}</p>
            <p><strong>Дата/время подачи:</strong> {selectedItem.submission_date} {selectedItem.submission_time}</p>
            <p><strong>Маршрут:</strong> {selectedItem.route_from} → {selectedItem.route_to}</p>
            <p><strong>Цель поездки:</strong> {selectedItem.purpose}</p>
            <p><strong>Пассажиров:</strong> {selectedItem.passenger_count}</p>
            {selectedItem.special_notes && (
              <p><strong>Особые отметки:</strong> {selectedItem.special_notes}</p>
            )}
            <p><strong>Статус:</strong> <StatusTag status={selectedItem.status} /></p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            {selectedItem.comment && (
              <>
                <p><strong>Комментарий диспетчера:</strong></p>
                <Typography.Paragraph>{selectedItem.comment}</Typography.Paragraph>
              </>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
