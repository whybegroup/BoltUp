import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  selectedGroupId: string | null;
  isOnline: boolean;
}

const initialState: AppState = {
  selectedGroupId: null,
  isOnline: true,
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setSelectedGroupId: (state, action: PayloadAction<string | null>) => {
      state.selectedGroupId = action.payload;
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
  },
});

export const { setSelectedGroupId, setOnlineStatus } = appSlice.actions;
export default appSlice.reducer;
