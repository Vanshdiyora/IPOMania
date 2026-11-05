import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type AuthUiStatus = "initializing" | "ready" | "expired";
type AuthUiState = { status: AuthUiStatus; signingOut: boolean };
const initialState: AuthUiState = { status: "initializing", signingOut: false };

const authUiSlice = createSlice({
  name: "authUi",
  initialState,
  reducers: {
    setAuthUiStatus(state, action: PayloadAction<AuthUiStatus>) {
      state.status = action.payload;
    },
    setSigningOut(state, action: PayloadAction<boolean>) {
      state.signingOut = action.payload;
    },
    resetAuthUi: () => ({ status: "ready" as const, signingOut: false }),
  },
});

export const { setAuthUiStatus, setSigningOut, resetAuthUi } = authUiSlice.actions;
export const authUiReducer = authUiSlice.reducer;
