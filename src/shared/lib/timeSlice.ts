import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { getServerTime } from './serverTime';

interface TimeState {
  currentTime: number;
}

const initialState: TimeState = {
  currentTime: getServerTime(), // UTC время
};

export const timeSlice = createSlice({
  name: 'time',
  initialState,
  reducers: {
    updateTime: (state) => {
      // Просто обновляем UTC время - единое для всех клиентов
      state.currentTime = getServerTime();
    },
    setTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
  },
});

export const { updateTime, setTime } = timeSlice.actions;
export default timeSlice.reducer;

