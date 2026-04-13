import type rootReducer from "@/reducers";
import type { ThunkDispatch } from "redux-thunk";
import type { AnyAction } from "redux";

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = ThunkDispatch<RootState, undefined, AnyAction>;
