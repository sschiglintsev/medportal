import { Button } from 'antd';

import { useAppStore } from '../Core/store/app.store';
import './HeaderBar.scss';

export function HeaderBar() {
  const user = useAppStore((state) => state.user);
  const setPortalView = useAppStore((state) => state.setPortalView);
  const clearAuth = useAppStore((state) => state.clearAuth);

  return (
    <header className="header-bar">
      <div className="header-bar__inner">
        <div className="header-bar__brand">
          <div className="header-bar__logo">Лого</div>
          <div>
            <div className="header-bar__title">Медпортал</div>
            <div className="header-bar__subtitle">ГБУЗ РБ ГДКБ №17 гор. Уфа</div>
          </div>
        </div>
        {user ? (
          <div className="header-bar__profile">
            <span className="header-bar__user-name">{user.fullName}</span>
            <span className="header-bar__user-role">{user.role}</span>
            <Button onClick={() => setPortalView('promo')}>На промо</Button>
            <Button onClick={clearAuth}>Выйти</Button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
