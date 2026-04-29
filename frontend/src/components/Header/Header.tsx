import { DownOutlined, MenuOutlined } from '@ant-design/icons';
import { Button, Descriptions, Dropdown, Form, Input, Modal, Select, Tag, message } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useState } from 'react';

import { userHasCabinetAccess } from '../../Core/cabinetAccess';
import { fetchAhchRequestPublic } from '../../Core/services/ahch-request.service';
import type { PublicAhchRequest } from '../../Core/services/ahch-request.service';
import { fetchRegistrationRoles, login, register } from '../../Core/services/auth.service';
import { fetchItRequestPublic } from '../../Core/services/it-request.service';
import type { PublicItRequest } from '../../Core/services/it-request.service';
import { fetchMetrologistRequestPublic } from '../../Core/services/metrologist-request.service';
import type { PublicMetrologistRequest } from '../../Core/services/metrologist-request.service';
import { useAppStore } from '../../Core/store/app.store';
import type { RoleOption } from '../../Core/types/common';
import './Header.scss';

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

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';
const SHOW_REGISTRATION = import.meta.env.VITE_IS_SHOW_REGISTRATION === 'true';

type LoginValues = {
  username: string;
  password: string;
};

type RegisterValues = {
  username: string;
  fullName: string;
  role: string;
  password: string;
};

export function Header() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registrationRoles, setRegistrationRoles] = useState<RoleOption[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [loginForm] = Form.useForm<LoginValues>();
  const [registerForm] = Form.useForm<RegisterValues>();

  const [itStatusOpen, setItStatusOpen] = useState(false);
  const [itRequestId, setItRequestId] = useState('');
  const [itRequest, setItRequest] = useState<PublicItRequest | null>(null);
  const [itLoading, setItLoading] = useState(false);
  const [itError, setItError] = useState<string | null>(null);
  const [metrologistStatusOpen, setMetrologistStatusOpen] = useState(false);
  const [metrologistRequestId, setMetrologistRequestId] = useState('');
  const [metrologistRequest, setMetrologistRequest] = useState<PublicMetrologistRequest | null>(null);
  const [metrologistLoading, setMetrologistLoading] = useState(false);
  const [metrologistError, setMetrologistError] = useState<string | null>(null);
  const [ahchStatusOpen, setAhchStatusOpen] = useState(false);
  const [ahchRequestId, setAhchRequestId] = useState('');
  const [ahchRequest, setAhchRequest] = useState<PublicAhchRequest | null>(null);
  const [ahchLoading, setAhchLoading] = useState(false);
  const [ahchError, setAhchError] = useState<string | null>(null);

  const handleItRequestSearch = async () => {
    const id = Number(itRequestId.trim());
    if (!id || isNaN(id)) {
      setItError('Введите корректный номер заявки');
      return;
    }
    setItLoading(true);
    setItError(null);
    setItRequest(null);
    try {
      const data = await fetchItRequestPublic(id);
      setItRequest(data);
    } catch {
      setItError('Заявка не найдена. Проверьте номер и попробуйте снова.');
    } finally {
      setItLoading(false);
    }
  };

  const handleItStatusClose = () => {
    setItStatusOpen(false);
    setItRequestId('');
    setItRequest(null);
    setItError(null);
  };

  const handleMetrologistRequestSearch = async () => {
    const id = Number(metrologistRequestId.trim());
    if (!id || isNaN(id)) {
      setMetrologistError('Введите корректный номер заявки');
      return;
    }
    setMetrologistLoading(true);
    setMetrologistError(null);
    setMetrologistRequest(null);
    try {
      const data = await fetchMetrologistRequestPublic(id);
      setMetrologistRequest(data);
    } catch {
      setMetrologistError('Заявка не найдена. Проверьте номер и попробуйте снова.');
    } finally {
      setMetrologistLoading(false);
    }
  };

  const handleMetrologistStatusClose = () => {
    setMetrologistStatusOpen(false);
    setMetrologistRequestId('');
    setMetrologistRequest(null);
    setMetrologistError(null);
  };

  const handleAhchRequestSearch = async () => {
    const id = Number(ahchRequestId.trim());
    if (!id || isNaN(id)) {
      setAhchError('Введите корректный номер заявки');
      return;
    }
    setAhchLoading(true);
    setAhchError(null);
    setAhchRequest(null);
    try {
      const data = await fetchAhchRequestPublic(id);
      setAhchRequest(data);
    } catch {
      setAhchError('Заявка не найдена. Проверьте номер и попробуйте снова.');
    } finally {
      setAhchLoading(false);
    }
  };

  const handleAhchStatusClose = () => {
    setAhchStatusOpen(false);
    setAhchRequestId('');
    setAhchRequest(null);
    setAhchError(null);
  };
  const user = useAppStore((state) => state.user);
  const setAuth = useAppStore((state) => state.setAuth);
  const setPortalView = useAppStore((state) => state.setPortalView);
  const clearAuth = useAppStore((state) => state.clearAuth);
  const organization = useAppStore((state) => state.organization);
  const logoUrl = organization?.logo_url
    ? organization.logo_url.startsWith('http')
      ? organization.logo_url
      : `${API_BASE}${organization.logo_url}`
    : null;

  const roleOptions = registrationRoles.map((role) => ({ value: role.value, label: role.title }));

  useEffect(() => {
    if (!registerOpen || registrationRoles.length > 0) {
      return;
    }

    setRolesLoading(true);
    void fetchRegistrationRoles()
      .then(setRegistrationRoles)
      .catch(() => {
        message.error('Не удалось загрузить роли');
      })
      .finally(() => {
        setRolesLoading(false);
      });
  }, [registerOpen, registrationRoles.length]);

  const handleLogin = async (values: LoginValues) => {
    setLoading(true);
    try {
      const auth = await login(values);
      setAuth(auth);
      setLoginOpen(false);
      loginForm.resetFields();
      message.success('Вход выполнен');
    } catch {
      message.error('Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: RegisterValues) => {
    setLoading(true);
    try {
      await register(values);
      setRegisterOpen(false);
      registerForm.resetFields();
      message.success('Регистрация успешна, теперь войдите');
    } catch {
      message.error('Не удалось зарегистрировать пользователя');
    } finally {
      setLoading(false);
    }
  };

  const mobileMenuItems: MenuProps['items'] = [
    { key: 'hero', label: <a href="#hero">Главные</a> },
    { key: 'news', label: <a href="#news">Новости</a> },
    { key: 'documents', label: <a href="#documents">Документы</a> },
    {
      key: 'status-group',
      label: 'Статус заявок',
      children: [
        { key: 'it-status', label: 'Заявка в ИТ' },
        { key: 'metrologist-status', label: 'Заявка метрологу' },
        { key: 'ahch-status', label: 'Заявка в АХЧ' },
      ],
    },
    { type: 'divider' },
    ...(user
      ? [
          ...(userHasCabinetAccess(user.permissions)
            ? [{ key: 'cabinet', label: 'Личный кабинет' }]
            : []),
          { key: 'logout', label: 'Выйти' },
        ]
      : [
          { key: 'login', label: 'Вход' },
          ...(SHOW_REGISTRATION ? [{ key: 'register', label: 'Регистрация' }] : []),
        ]),
  ];

  const onMobileMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'login') {
      setLoginOpen(true);
      return;
    }
    if (key === 'register') {
      setRegisterOpen(true);
      return;
    }
    if (key === 'cabinet') {
      setPortalView('cabinet');
      return;
    }
    if (key === 'it-status') {
      setItStatusOpen(true);
      return;
    }
    if (key === 'metrologist-status') {
      setMetrologistStatusOpen(true);
      return;
    }
    if (key === 'ahch-status') {
      setAhchStatusOpen(true);
      return;
    }
    if (key === 'logout') {
      clearAuth();
    }
  };

  const statusMenuItems: MenuProps['items'] = [
    { key: 'it-status', label: 'Заявка в ИТ' },
    { key: 'metrologist-status', label: 'Заявка метрологу' },
    { key: 'ahch-status', label: 'Заявка в АХЧ' },
  ];

  const onStatusMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'it-status') {
      setItStatusOpen(true);
      return;
    }
    if (key === 'metrologist-status') {
      setMetrologistStatusOpen(true);
      return;
    }
    if (key === 'ahch-status') {
      setAhchStatusOpen(true);
    }
  };

  return (
    <>
      <header className="promo-header">
        <div className="promo-header__inner">
          <div className="promo-header__brand">
            <div className="promo-header__logo">
              {logoUrl ? (
                <img src={logoUrl} alt="Логотип" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }} />
              ) : (
                'Лого'
              )}
            </div>
            <div>
              <div className="promo-header__title">Медпортал</div>
              <div className="promo-header__subtitle">ГБУЗ РБ ГДКБ №17 гор. Уфа</div>
            </div>
          </div>

          <nav className="promo-header__menu">
            <a href="#hero">Главные</a>
            <a href="#news">Новости</a>
            <a href="#documents">Документы</a>
          </nav>

          <div className="promo-header__actions">
            <Dropdown menu={{ items: statusMenuItems, onClick: onStatusMenuClick }} trigger={['click']}>
              <Button>
                Статус заявок <DownOutlined />
              </Button>
            </Dropdown>
            {user ? (
              <>
                <span className="promo-header__user">{user.fullName}</span>
                {userHasCabinetAccess(user.permissions) ? (
                  <Button type="primary" onClick={() => setPortalView('cabinet')}>
                    Личный кабинет
                  </Button>
                ) : null}
                <Button onClick={clearAuth}>Выйти</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setLoginOpen(true)}>Вход</Button>
                <Button
                  type="primary"
                  onClick={() => setRegisterOpen(true)}
                  style={{ display: SHOW_REGISTRATION ? undefined : 'none' }}
                >
                  Регистрация
                </Button>
              </>
            )}
          </div>

          <div className="promo-header__mobile-actions">
            <Dropdown menu={{ items: mobileMenuItems, onClick: onMobileMenuClick }} trigger={['click']}>
              <Button
                type="text"
                icon={<MenuOutlined />}
                className="promo-header__mobile-menu-button"
                aria-label="Открыть меню"
              />
            </Dropdown>
          </div>
        </div>
      </header>

      <Modal
        title="Вход"
        open={loginOpen}
        onCancel={() => setLoginOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={loginForm} layout="vertical" onFinish={handleLogin}>
          <Form.Item name="username" label="Логин" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Войти
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Регистрация"
        open={registerOpen}
        onCancel={() => setRegisterOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
          <Form.Item
            name="username"
            label="Логин"
            rules={[{ required: true, message: 'Введите логин' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="ФИО"
            rules={[{ required: true, message: 'Введите ФИО' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="role" label="Роль" rules={[{ required: true, message: 'Выберите роль' }]}>
            <Select options={roleOptions} loading={rolesLoading} />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Зарегистрироваться
          </Button>
        </Form>
      </Modal>

      <Modal
        title="Статус заявки в ИТ"
        open={itStatusOpen}
        onCancel={handleItStatusClose}
        footer={null}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="Введите номер заявки"
            value={itRequestId}
            onChange={(e) => {
              setItRequestId(e.target.value);
              setItError(null);
              setItRequest(null);
            }}
            onPressEnter={() => void handleItRequestSearch()}
            type="number"
            min={1}
          />
          <Button type="primary" onClick={() => void handleItRequestSearch()} loading={itLoading}>
            Найти
          </Button>
        </div>

        {itError && (
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>{itError}</p>
        )}

        {itRequest && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Номер заявки">#{itRequest.id}</Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Tag color={STATUS_COLORS[itRequest.status] ?? 'default'}>
                {STATUS_LABELS[itRequest.status] ?? itRequest.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="ФИО">{itRequest.full_name}</Descriptions.Item>
            <Descriptions.Item label="Отделение">{itRequest.department}</Descriptions.Item>
            <Descriptions.Item label="Кабинет">{itRequest.location}</Descriptions.Item>
            <Descriptions.Item label="Описание">{itRequest.request_text}</Descriptions.Item>
            {itRequest.comment && (
              <Descriptions.Item label="Комментарий ИТ отдела">{itRequest.comment}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
      <Modal
        title="Статус заявки метрологу"
        open={metrologistStatusOpen}
        onCancel={handleMetrologistStatusClose}
        footer={null}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="Введите номер заявки"
            value={metrologistRequestId}
            onChange={(e) => {
              setMetrologistRequestId(e.target.value);
              setMetrologistError(null);
              setMetrologistRequest(null);
            }}
            onPressEnter={() => void handleMetrologistRequestSearch()}
            type="number"
            min={1}
          />
          <Button type="primary" onClick={() => void handleMetrologistRequestSearch()} loading={metrologistLoading}>
            Найти
          </Button>
        </div>

        {metrologistError && (
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>{metrologistError}</p>
        )}

        {metrologistRequest && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Номер заявки">#{metrologistRequest.id}</Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Tag color={STATUS_COLORS[metrologistRequest.status] ?? 'default'}>
                {STATUS_LABELS[metrologistRequest.status] ?? metrologistRequest.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="ФИО">{metrologistRequest.full_name}</Descriptions.Item>
            <Descriptions.Item label="Отделение">{metrologistRequest.department}</Descriptions.Item>
            <Descriptions.Item label="Кабинет">{metrologistRequest.location}</Descriptions.Item>
            <Descriptions.Item label="Описание">{metrologistRequest.request_text}</Descriptions.Item>
            {metrologistRequest.comment && (
              <Descriptions.Item label="Комментарий метролога">{metrologistRequest.comment}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
      <Modal
        title="Статус заявки в АХЧ"
        open={ahchStatusOpen}
        onCancel={handleAhchStatusClose}
        footer={null}
        destroyOnClose
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <Input
            placeholder="Введите номер заявки"
            value={ahchRequestId}
            onChange={(e) => {
              setAhchRequestId(e.target.value);
              setAhchError(null);
              setAhchRequest(null);
            }}
            onPressEnter={() => void handleAhchRequestSearch()}
            type="number"
            min={1}
          />
          <Button type="primary" onClick={() => void handleAhchRequestSearch()} loading={ahchLoading}>
            Найти
          </Button>
        </div>

        {ahchError && (
          <p style={{ color: '#ff4d4f', marginBottom: 12 }}>{ahchError}</p>
        )}

        {ahchRequest && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Номер заявки">#{ahchRequest.id}</Descriptions.Item>
            <Descriptions.Item label="Статус">
              <Tag color={STATUS_COLORS[ahchRequest.status] ?? 'default'}>
                {STATUS_LABELS[ahchRequest.status] ?? ahchRequest.status}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Адрес">{ahchRequest.address}</Descriptions.Item>
            <Descriptions.Item label="Отделение">{ahchRequest.department}</Descriptions.Item>
            <Descriptions.Item label="Описание">{ahchRequest.request_text}</Descriptions.Item>
            {ahchRequest.comment && (
              <Descriptions.Item label="Комментарий АХЧ">{ahchRequest.comment}</Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </>
  );
}
