import { ConfigProvider } from 'antd';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import { userHasCabinetAccess } from './Core/cabinetAccess';
import { fetchOrganization } from './Core/services/organization.service';
import { useAppStore } from './Core/store/app.store';
import { MainLayout } from './layouts/MainLayout';
import { AdminCabinetPage } from './pages/AdminCabinetPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ChiefCabinetPage } from './pages/ChiefCabinetPage';
import { DispatcherCabinetPage } from './pages/DispatcherCabinetPage';
import { EmployeeCabinetPage } from './pages/EmployeeCabinetPage';
import { FacilityCabinetPage } from './pages/FacilityCabinetPage';
import { HeadNurseCabinetPage } from './pages/HeadNurseCabinetPage';
import { ItDepartmentCabinetPage } from './pages/ItDepartmentCabinetPage';
import { MetrologistCabinetPage } from './pages/MetrologistCabinetPage';
import { DocumentsPage } from './pages/Promo/DocumentsPage';
import { PromoPage } from './pages/Promo/PromoPage';
import { QualityControlCabinetPage } from './pages/QualityControlCabinetPage';

function App() {
  const user = useAppStore((state) => state.user);
  const portalView = useAppStore((state) => state.portalView);
  const setOrganization = useAppStore((state) => state.setOrganization);

  useEffect(() => {
    void fetchOrganization()
      .then(setOrganization)
      .catch(() => {});
  }, [setOrganization]);

  const permissions = user?.permissions;

  // Если пользователь вошёл, но обязан сменить пароль — показываем только этот экран.
  // НЕ переводим любой 403 в этот сценарий — только явный флаг mustChangePassword.
  if (user && user.mustChangePassword) {
    return (
      <ConfigProvider theme={{ token: { colorPrimary: '#4C4FEA' } }}>
        <ChangePasswordPage />
      </ConfigProvider>
    );
  }

  const cabinetContent = (() => {
    if (!permissions) {
      return <AdminCabinetPage />;
    }
    if (permissions.canAccessQualityCabinet) {
      return <QualityControlCabinetPage />;
    }
    if (permissions.canAccessAdminCabinet) {
      return <AdminCabinetPage />;
    }
    if (permissions.canAccessCabinetChief) {
      return <ChiefCabinetPage />;
    }
    if (permissions.canManageItRequests) {
      return <ItDepartmentCabinetPage />;
    }
    if (user?.role === 'facility') {
      return <FacilityCabinetPage />;
    }
    if (user?.role === 'metrologist') {
      return <MetrologistCabinetPage />;
    }
    if (user?.role === 'dispatcher') {
      return <DispatcherCabinetPage />;
    }
    // Новые кабинеты (этап 5)
    if (user?.role === 'head_nurse') {
      return <HeadNurseCabinetPage />;
    }
    if (user?.role === 'employee' || permissions.canAccessCabinet) {
      return <EmployeeCabinetPage />;
    }
    return <AdminCabinetPage />;
  })();

  const mainContent =
    userHasCabinetAccess(permissions) && portalView === 'cabinet' ? (
      <MainLayout>{cabinetContent}</MainLayout>
    ) : (
      <PromoPage />
    );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4C4FEA',
        },
      }}
    >
      <Routes>
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/*" element={mainContent} />
      </Routes>
    </ConfigProvider>
  );
}

export default App;
