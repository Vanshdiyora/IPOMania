import { Navigate, useLocation } from "react-router-dom";

export function ListTabRedirect({ path }: { path: string }) {
  const { search, hash } = useLocation();
  return <Navigate to={`${path}${search}${hash}`} replace />;
}
