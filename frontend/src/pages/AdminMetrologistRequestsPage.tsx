import { List, Modal, Tag, Typography, message } from 'antd';
import { useCallback, useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import { fetchMetrologistRequests } from '../Core/services/metrologist-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { MetrologistRequest } from '../Core/types/common';
import './AdminMetrologistRequestsPage.scss';

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

function StatusTag({ status }: { status: string }) {
  return <Tag color={STATUS_COLORS[status] ?? 'default'}>{STATUS_LABELS[status] ?? status}</Tag>;
}

export function AdminMetrologistRequestsPage() {
  const token = useAppStore((state) => state.token);
  const [items, setItems] = useState<MetrologistRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MetrologistRequest | null>(null);

  const loadRequests = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    try {
      const data = await fetchMetrologistRequests({ token });
      setItems(data);
    } catch {
      message.error('Не удалось загрузить заявки метрологу');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  return (
    <section className="admin-metrologist-requests-page">
      <List
        loading={loading}
        dataSource={items}
        locale={{ emptyText: 'Пока нет заявок метрологу' }}
        renderItem={(item) => (
          <List.Item className="admin-metrologist-requests-page__item" onClick={() => setSelectedItem(item)}>
            <div className="admin-metrologist-requests-page__main">
              <div className="admin-metrologist-requests-page__request-title">#{item.id} — {item.full_name}</div>
              <div className="admin-metrologist-requests-page__meta">
                <span>{item.department}</span>
                <span>Кабинет: {item.location}</span>
                <span>{formatDateTime(item.created_at)}</span>
              </div>
              <Typography.Paragraph ellipsis={{ rows: 2 }} className="admin-metrologist-requests-page__text">
                {item.request_text}
              </Typography.Paragraph>
            </div>
            <StatusTag status={item.status} />
          </List.Item>
        )}
      />

      <Modal
        title={selectedItem ? `Заявка метрологу #${selectedItem.id}` : 'Заявка метрологу'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="admin-metrologist-requests-page__details">
            <p><strong>ФИО:</strong> {selectedItem.full_name}</p>
            <p><strong>Телефон:</strong> {selectedItem.phone}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Кабинет:</strong> {selectedItem.location}</p>
            <p><strong>Статус:</strong> <StatusTag status={selectedItem.status} /></p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            <p><strong>Описание:</strong></p>
            <Typography.Paragraph>{selectedItem.request_text}</Typography.Paragraph>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
