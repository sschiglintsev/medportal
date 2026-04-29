import { ConfigProvider } from 'antd';
import { useEffect } from 'react';

import { userHasCabinetAccess } from './Core/cabinetAccess';
import { fetchOrganization } from './Core/services/organization.service';
import { useAppStore } from './Core/store/app.store';
import { MainLayout } from './layouts/MainLayout';
import { AdminCabinetPage } from './pages/AdminCabinetPage';
import { ChiefCabinetPage } from './pages/ChiefCabinetPage';
import { FacilityCabinetPage } from './pages/FacilityCabinetPage';
import { ItDepartmentCabinetPage } from './pages/ItDepartmentCabinetPage';
import { MetrologistCabinetPage } from './pages/MetrologistCabinetPage';
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
    return <AdminCabinetPage />;
  })();

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#4C4FEA',
        },
      }}
    >
      {userHasCabinetAccess(permissions) && portalView === 'cabinet' ? (
        <MainLayout>{cabinetContent}</MainLayout>
      ) : (
        <PromoPage />
      )}
    </ConfigProvider>
  );
}

export default App;
