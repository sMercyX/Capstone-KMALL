// src/api/responseType.ts

// wrapper หลัก (ของเดิม)
export interface ApiResponse<T> {
  code: number;
  status: string;
  message?: string;
  data: T;
}
export interface ApiCreateResponse<T> {
  code: number;
  created: boolean;
  status: string;
  message?: string;
  data: T;
}
export interface ApiUpdatedResponse<T> {
  code: number;
  updated: boolean;
  status: string;
  message?: string;
  data: T;
}

// generic สำหรับ pagination
export interface PaginatedData<T> {
  items: T[];
  pageIndex: number;
  pageSize: number;
  total: number;
}

// response ของ API แบบมี pagination
export type PaginatedResponse<T> = ApiResponse<PaginatedData<T>>;
