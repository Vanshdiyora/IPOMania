import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type DashboardFilters = {
  date_from: string;
  date_to: string;
  ipo_id: string;
  catalog_ipo_id: string;
  category: string;
  account_id: string;
};

export const emptyDashboardFilters: DashboardFilters = {
  date_from: "",
  date_to: "",
  ipo_id: "",
  catalog_ipo_id: "",
  category: "",
  account_id: "",
};

const dashboardFiltersSlice = createSlice({
  name: "dashboardFilters",
  initialState: emptyDashboardFilters,
  reducers: {
    setDashboardFilters: (_state, action: PayloadAction<DashboardFilters>) => action.payload,
    resetDashboardFilters: () => emptyDashboardFilters,
  },
});

export const { setDashboardFilters, resetDashboardFilters } = dashboardFiltersSlice.actions;
export const dashboardFiltersReducer = dashboardFiltersSlice.reducer;
