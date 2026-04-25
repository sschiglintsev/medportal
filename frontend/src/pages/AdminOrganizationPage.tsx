import { DeleteOutlined, PictureOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Image, Popconfirm, Typography, Upload, message } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { useState } from 'react';

import {
  deleteOrganizationHero,
  deleteOrganizationLogo,
  uploadOrganizationHero,
  uploadOrganizationLogo,
} from '../Core/services/organization.service';
import { useAppStore } from '../Core/store/app.store';
import './AdminOrganizationPage.scss';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

function absoluteUrl(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }
  if (url.startsWith('http')) {
    return url;
  }
  return `${API_BASE}${url}`;
}

export function AdminOrganizationPage() {
  const token = useAppStore((state) => state.token);
  const organization = useAppStore((state) => state.organization);
  const setOrganization = useAppStore((state) => state.setOrganization);
  const [logoLoading, setLogoLoading] = useState(false);
  const [heroLoading, setHeroLoading] = useState(false);

  const handleLogoUpload = async (file: RcFile): Promise<false> => {
    if (!token) {
      return false;
    }
    setLogoLoading(true);
    try {
      const updated = await uploadOrganizationLogo(file, token);
      setOrganization(updated);
      message.success('Логотип обновлён');
    } catch {
      message.error('Не удалось загрузить логотип');
    } finally {
      setLogoLoading(false);
    }
    return false;
  };

  const handleLogoDelete = async () => {
    if (!token) {
      return;
    }
    setLogoLoading(true);
    try {
      const updated = await deleteOrganizationLogo(token);
      setOrganization(updated);
      message.success('Логотип удалён');
    } catch {
      message.error('Не удалось удалить логотип');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleHeroUpload = async (file: RcFile): Promise<false> => {
    if (!token) {
      return false;
    }
    setHeroLoading(true);
    try {
      const updated = await uploadOrganizationHero(file, token);
      setOrganization(updated);
      message.success('Hero-изображение обновлено');
    } catch {
      message.error('Не удалось загрузить изображение');
    } finally {
      setHeroLoading(false);
    }
    return false;
  };

  const handleHeroDelete = async () => {
    if (!token) {
      return;
    }
    setHeroLoading(true);
    try {
      const updated = await deleteOrganizationHero(token);
      setOrganization(updated);
      message.success('Hero-изображение удалено');
    } catch {
      message.error('Не удалось удалить изображение');
    } finally {
      setHeroLoading(false);
    }
  };

  const logoUrl = absoluteUrl(organization?.logo_url);
  const heroUrl = absoluteUrl(organization?.hero_image_url);

  return (
    <div className="admin-organization-page">
      <Card className="admin-organization-page__card" title="Логотип организации">
        <Typography.Text type="secondary" className="admin-organization-page__hint">
          Отображается в шапке сайта. Рекомендуемый размер: 44×44 px, форматы: PNG, SVG, WebP.
        </Typography.Text>

        <div className="admin-organization-page__preview-row">
          <div className="admin-organization-page__preview">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Логотип"
                width={120}
                height={120}
                style={{ objectFit: 'contain', borderRadius: 8, border: '1px solid #e7eaf3' }}
              />
            ) : (
              <div className="admin-organization-page__empty">
                <PictureOutlined />
                <span>Нет логотипа</span>
              </div>
            )}
          </div>

          <div className="admin-organization-page__actions">
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleLogoUpload}>
              <Button icon={<UploadOutlined />} loading={logoLoading}>
                {logoUrl ? 'Заменить' : 'Загрузить'}
              </Button>
            </Upload>

            {logoUrl && (
              <Popconfirm
                title="Удалить логотип?"
                okText="Да"
                cancelText="Нет"
                onConfirm={handleLogoDelete}
              >
                <Button danger icon={<DeleteOutlined />} loading={logoLoading}>
                  Удалить
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
      </Card>

      <Card className="admin-organization-page__card" title="Hero-изображение промо-страницы">
        <Typography.Text type="secondary" className="admin-organization-page__hint">
          Отображается в правой части главного экрана промо-сайта. Рекомендуемый размер: 800×600 px, форматы: JPEG, PNG, WebP.
        </Typography.Text>

        <div className="admin-organization-page__preview-row">
          <div className="admin-organization-page__preview admin-organization-page__preview--hero">
            {heroUrl ? (
              <Image
                src={heroUrl}
                alt="Hero-изображение"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 8, border: '1px solid #e7eaf3' }}
              />
            ) : (
              <div className="admin-organization-page__empty admin-organization-page__empty--hero">
                <PictureOutlined />
                <span>Нет изображения</span>
              </div>
            )}
          </div>

          <div className="admin-organization-page__actions">
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleHeroUpload}>
              <Button icon={<UploadOutlined />} loading={heroLoading}>
                {heroUrl ? 'Заменить' : 'Загрузить'}
              </Button>
            </Upload>

            {heroUrl && (
              <Popconfirm
                title="Удалить изображение?"
                okText="Да"
                cancelText="Нет"
                onConfirm={handleHeroDelete}
              >
                <Button danger icon={<DeleteOutlined />} loading={heroLoading}>
                  Удалить
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
