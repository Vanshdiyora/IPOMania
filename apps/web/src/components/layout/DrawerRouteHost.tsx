import { Route, Routes } from "react-router-dom";
import { AccountFormPage } from "../../pages/accounts/AccountPages";
import { ApplicationFormPage } from "../../pages/applications/ApplicationPages";
import { IpoCategoryConfigurationPage, IpoFormPage } from "../../pages/ipos/IpoPages";

export function DrawerRouteHost({ path }: { path: string | null }) {
  if (!path) return null;

  return (
    <Routes location={path}>
      <Route path="/accounts/new" element={<AccountFormPage />} />
      <Route path="/accounts/:accountId/edit" element={<AccountFormPage editing />} />
      <Route path="/applications/new" element={<ApplicationFormPage />} />
      <Route path="/applications/:applicationId/edit" element={<ApplicationFormPage editing />} />
      <Route path="/ipos/new" element={<IpoFormPage />} />
      <Route path="/ipos/:ipoId/edit" element={<IpoFormPage editing />} />
      <Route path="/ipos/:ipoId/categories" element={<IpoCategoryConfigurationPage />} />
    </Routes>
  );
}
