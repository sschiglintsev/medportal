import { Button, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import { fetchAhchRequests } from '../Core/services/ahch-request.service';
import type { AhchRequestStatus } from '../Core/services/ahch-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { AhchRequest } from '../Core/types/common';
import './AdminAhchRequestsPage.scss';

const STATUS_LABELS: Record<string, string> = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Готово',
  cancelled: 'Отменена',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'blue',
  in_progress: 'orange',
  done: 'green',
  cancelled: 'red',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as AhchRequestStatus[]).map((key) => ({
  value: key,
  label: STATUS_LABELS[key],
}));

function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLORS[status] ?? 'default'}>{STATUS_LABELS[status] ?? status}</Tag>;
}

export function AdminAhchRequestsPage() {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<AhchRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AhchRequest | null>(null);
  const [filterStatus, setFilterStatus] = useState<AhchRequestStatus | null>(null);
  const [filterDepartment, setFilterDepartment] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await fetchAhchRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить заявки в АХЧ');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const departmentOptions = useMemo(
    () =>
      Array.from(new Set(items.map((it) => it.department).filter(Boolean))).sort().map((d) => ({
        value: d,
        label: d,
      })),
    [items],
  );

  const filteredItems = useMemo(() => {
    let result = items;
    if (filterStatus) result = result.filter((it) => it.status === filterStatus);
    if (filterDepartment) result = result.filter((it) => it.department === filterDepartment);
    return result;
  }, [items, filterStatus, filterDepartment]);

  return (
    <section className="admin-ahch-requests-page">
      <Space size={10} wrap className="admin-ahch-requests-page__filters">
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
        locale={{ emptyText: 'Пока нет заявок в АХЧ' }}
        renderItem={(item) => (
          <List.Item className="admin-ahch-requests-page__item" onClick={() => setSelectedItem(item)}>
            <div className="admin-ahch-requests-page__main">
              <div className="admin-ahch-requests-page__title">#{item.id} — {item.address}</div>
              <div className="admin-ahch-requests-page__meta">
                <span>{item.department}</span>
                <span>Тел.: {item.employee_phone}</span>
                <span>{formatDateTime(item.created_at)}</span>
              </div>
              <Typography.Paragraph ellipsis={{ rows: 2 }} className="admin-ahch-requests-page__text">
                {item.request_text}
              </Typography.Paragraph>
            </div>
            <StatusTag status={item.status} />
          </List.Item>
        )}
      />

      <Modal
        title={selectedItem ? `Заявка в АХЧ #${selectedItem.id}` : 'Заявка в АХЧ'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="admin-ahch-requests-page__details">
            <p><strong>Адрес:</strong> {selectedItem.address}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Телефон сотрудника:</strong> {selectedItem.employee_phone}</p>
            <p><strong>Статус:</strong> <StatusTag status={selectedItem.status} /></p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            <p><strong>Описание:</strong></p>
            <Typography.Paragraph>{selectedItem.request_text}</Typography.Paragraph>
            {selectedItem.comment && (
              <>
                <p><strong>Комментарий АХЧ:</strong></p>
                <Typography.Paragraph>{selectedItem.comment}</Typography.Paragraph>
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
