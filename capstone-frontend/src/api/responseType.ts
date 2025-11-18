// src/api/responseType.ts

export interface ApiResponse<T> {
  code: number;
  status: string;
  data: T;
}
