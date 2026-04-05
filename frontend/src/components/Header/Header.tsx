import { MenuOutlined } from '@ant-design/icons';
import { Button, Dropdown, Form, Input, Modal, Select, message } from 'antd';
import type { MenuProps } from 'antd';
import { useState } from 'react';

import { login, register } from '../../Core/services/auth.service';
import { useAppStore } from '../../Core/store/app.store';
import './Header.scss';

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

const roleOptions = [
  'Главный врач',
  'Администратор',
  'Контроль качества',
  'ИТ отдел',
  'АХЧ отдел',
  'Metrolog',
  'Сотрудник',
].map((role) => ({ value: role, label: role }));

export function Header() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginForm] = Form.useForm<LoginValues>();
  const [registerForm] = Form.useForm<RegisterValues>();
  const user = useAppStore((state) => state.user);
  const setAuth = useAppStore((state) => state.setAuth);
  const setPortalView = useAppStore((state) => state.setPortalView);
  const clearAuth = useAppStore((state) => state.clearAuth);

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
    { type: 'divider' },
    ...(user
      ? [
          ...(user.role === 'Администратор' || user.role === 'Контроль качества'
            ? [{ key: 'cabinet', label: 'Личный кабинет' }]
            : []),
          { key: 'logout', label: 'Выйти' },
        ]
      : [
          { key: 'login', label: 'Вход' },
          { key: 'register', label: 'Регистрация' },
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
    if (key === 'logout') {
      clearAuth();
    }
  };

  return (
    <>
      <header className="promo-header">
        <div className="promo-header__inner">
          <div className="promo-header__brand">
            <div className="promo-header__logo">Лого</div>
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
            {user ? (
              <>
                <span className="promo-header__user">{user.fullName}</span>
                {user.role === 'Администратор' || user.role === 'Контроль качества' ? (
                  <Button type="primary" onClick={() => setPortalView('cabinet')}>
                    Личный кабинет
                  </Button>
                ) : null}
                <Button onClick={clearAuth}>Выйти</Button>
              </>
            ) : (
              <>
                <Button onClick={() => setLoginOpen(true)}>Вход</Button>
                <Button type="primary" onClick={() => setRegisterOpen(true)}>
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
            <Select options={roleOptions} />
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
    </>
  );
}
