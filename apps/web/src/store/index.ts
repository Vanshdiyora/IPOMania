import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector, type TypedUseSelectorHook } from "react-redux";
import { authUiReducer } from "./slices/authUiSlice";
import { dashboardFiltersReducer } from "./slices/dashboardFiltersSlice";
import { uiReducer } from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    authUi: authUiReducer,
    dashboardFilters: dashboardFiltersReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
