import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

type UiState = { mobileNavigationOpen: boolean };
const initialState: UiState = { mobileNavigationOpen: false };

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    setMobileNavigationOpen(state, action: PayloadAction<boolean>) {
      state.mobileNavigationOpen = action.payload;
    },
    resetUi: () => initialState,
  },
});

export const { setMobileNavigationOpen, resetUi } = uiSlice.actions;
export const uiReducer = uiSlice.reducer;
