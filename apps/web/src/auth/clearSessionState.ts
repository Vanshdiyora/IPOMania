import type { QueryClient } from "@tanstack/react-query";
import type { AppDispatch } from "../store";
import { resetAuthUi } from "../store/slices/authUiSlice";
import { resetDashboardFilters } from "../store/slices/dashboardFiltersSlice";
import { resetUi } from "../store/slices/uiSlice";

export function clearSessionState(queryClient: QueryClient, dispatch: AppDispatch) {
  void queryClient.cancelQueries();
  queryClient.clear();
  dispatch(resetAuthUi());
  dispatch(resetDashboardFilters());
  dispatch(resetUi());
}
