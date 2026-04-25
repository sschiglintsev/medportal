import { Button } from 'antd';

import { useAppStore } from '../Core/store/app.store';
import './HeaderBar.scss';

const API_BASE = import.meta.env.VITE_API_URL?.replace('/api', '') ?? 'http://localhost:4000';

export function HeaderBar() {
  const user = useAppStore((state) => state.user);
  const setPortalView = useAppStore((state) => state.setPortalView);
  const clearAuth = useAppStore((state) => state.clearAuth);
  const organization = useAppStore((state) => state.organization);

  const logoUrl = organization?.logo_url
    ? organization.logo_url.startsWith('http')
      ? organization.logo_url
      : `${API_BASE}${organization.logo_url}`
    : null;

  return (
    <header className="header-bar">
      <div className="header-bar__inner">
        <div className="header-bar__brand">
          <div className="header-bar__logo">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Логотип"
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '50%' }}
              />
            ) : (
              'Лого'
            )}
          </div>
          <div>
            <div className="header-bar__title">Медпортал</div>
            <div className="header-bar__subtitle">ГБУЗ РБ ГДКБ №17 гор. Уфа</div>
          </div>
        </div>
        {user ? (
          <div className="header-bar__profile">
            <span className="header-bar__user-name">{user.fullName}</span>
            <span className="header-bar__user-role">{user.roleTitle}</span>
            <Button onClick={() => setPortalView('promo')}>На промо</Button>
            <Button onClick={clearAuth}>Выйти</Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
