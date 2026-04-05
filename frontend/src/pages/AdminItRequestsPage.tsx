import { List, Modal, Tag, Typography, message } from 'antd';
import { useEffect, useState } from 'react';

import { formatDateTime } from '../Core/date.utils';
import { fetchItRequests } from '../Core/services/it-request.service';
import { useAppStore } from '../Core/store/app.store';
import type { ItRequest } from '../Core/types/common';
import './AdminItRequestsPage.scss';

export function AdminItRequestsPage() {
  const [items, setItems] = useState<ItRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItRequest | null>(null);
  const token = useAppStore((state) => state.token);

  useEffect(() => {
    const loadRequests = async () => {
      if (!token) {
        return;
      }

      setLoading(true);
      try {
        const data = await fetchItRequests({ token });
        setItems(data);
      } catch {
        message.error('Не удалось загрузить заявки в ИТ');
      } finally {
        setLoading(false);
      }
    };

    void loadRequests();
  }, [token]);

  return (
    <section className="admin-it-requests-page">
      <List
        loading={loading}
        dataSource={items}
        locale={{ emptyText: 'Пока нет заявок в ИТ' }}
        renderItem={(item) => (
          <List.Item className="admin-it-requests-page__item" onClick={() => setSelectedItem(item)}>
            <div className="admin-it-requests-page__main">
              <div className="admin-it-requests-page__title">#{item.id} — {item.full_name}</div>
              <div className="admin-it-requests-page__meta">
                <span>{item.department}</span>
                <span>Кабинет: {item.location}</span>
                <span>{formatDateTime(item.created_at)}</span>
              </div>
              <Typography.Paragraph ellipsis={{ rows: 2 }} className="admin-it-requests-page__text">
                {item.request_text}
              </Typography.Paragraph>
            </div>
            <Tag color="blue">{item.status}</Tag>
          </List.Item>
        )}
      />

      <Modal
        title={selectedItem ? `Заявка в ИТ #${selectedItem.id}` : 'Заявка в ИТ'}
        open={Boolean(selectedItem)}
        onCancel={() => setSelectedItem(null)}
        footer={null}
        destroyOnClose
      >
        {selectedItem ? (
          <div className="admin-it-requests-page__details">
            <p><strong>ФИО:</strong> {selectedItem.full_name}</p>
            <p><strong>Телефон:</strong> {selectedItem.phone}</p>
            <p><strong>Отделение:</strong> {selectedItem.department}</p>
            <p><strong>Кабинет:</strong> {selectedItem.location}</p>
            <p><strong>Статус:</strong> {selectedItem.status}</p>
            <p><strong>Создано:</strong> {formatDateTime(selectedItem.created_at)}</p>
            <p><strong>Описание:</strong></p>
            <Typography.Paragraph>{selectedItem.request_text}</Typography.Paragraph>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
