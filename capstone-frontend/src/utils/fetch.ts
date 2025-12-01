// src/api/fetch.ts
import axios, { type AxiosRequestConfig, type AxiosInstance } from "axios";
import { API_BASE } from "../config";

type AuthMode = "auto" | "required" | "none";

type ExtraOptions = {
  auth?: AuthMode;
} & AxiosRequestConfig;

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export function useHttpClient(baseUrl: string) {
  const client: AxiosInstance = axios.create({
    baseURL: baseUrl,
    headers: {
      "Content-Type": "application/json",
    },
    withCredentials: true, // Default to include cookies
  });

  async function request(
    path: string,
    options: ExtraOptions = {}
  ) {
    const { auth = "auto", ...config } = options;

    // Adjust withCredentials based on auth mode if needed
    // In the original fetch, auth="none" meant credentials="same-origin" (no cookies for cross-origin)
    // auth="auto" or "required" meant "include"
    // Axios withCredentials: true sends cookies. false doesn't.
    if (auth === "none") {
        config.withCredentials = false;
    }

    try {
      const response = await client.request({
        url: path,
        ...config,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 && auth === "required") {
             // Handle 401 specific logic if needed, or just let it throw
             // The original code threw a custom error with code 401
             // We can just let the AxiosError propagate, handleApiError will catch it
        }
      }
      throw error;
    }
  }

  const getItems = (url: string, opt: ExtraOptions = {}) =>
    request(url, { method: "GET", ...opt });

  const postItem = (url: string, item?: unknown, opt: ExtraOptions = {}) => {
    const isForm = isFormData(item);
    return request(url, {
      method: "POST",
      data: item,
      headers: isForm ? { "Content-Type": "multipart/form-data" } : undefined,
      ...opt,
    });
  };

  const putItem = (url: string, item: unknown, opt: ExtraOptions = {}) => {
    const isForm = isFormData(item);
    return request(url, {
      method: "PUT",
      data: item,
      headers: isForm ? { "Content-Type": "multipart/form-data" } : undefined,
      ...opt,
    });
  };

  const deleteItem = (url: string, opt: ExtraOptions = {}) =>
    request(url, { method: "DELETE", ...opt });

  return { getItems, postItem, putItem, deleteItem };
}

// ใช้ที่อื่นเรียกแบบนี้
export function useCrudApi() {
  const baseUrl =
    (import.meta as unknown as { env: { VITE_API_BASE: string } })?.env?.VITE_API_BASE ||
    (process.env as unknown as { NEXT_PUBLIC_BASE_URL: string })?.NEXT_PUBLIC_BASE_URL ||
    API_BASE ||
    "";
  return useHttpClient(baseUrl);
}
