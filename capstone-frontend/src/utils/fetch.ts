// src/api/fetch.ts
import axios, { type AxiosRequestConfig, type AxiosInstance } from "axios";
import { API_BASE } from "../config";
import { getAccessToken } from "../auth/tokenStore";

type AuthMode = "auto" | "required" | "none";

type ExtraOptions = {
  auth?: AuthMode;
} & AxiosRequestConfig;

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");
  const p = path.replace(/^\/+/, "");
  return `${b}/${p}`;
}

export function useHttpClient(baseUrl: string) {
  const client: AxiosInstance = axios.create({
    // We don't set baseURL here because we want to use joinUrl dynamically or just let axios handle it if we passed it.
    // But to match previous logic, let's just use the full URL in request.
    headers: {
      "Content-Type": "application/json",
    },
  });

  async function request(
    path: string,
    options: ExtraOptions = {}
  ) {
    const { auth = "auto", headers = {}, ...config } = options;

    const fullUrl = joinUrl(baseUrl, path);
    const requestHeaders: Record<string, string> = { ...headers as Record<string, string> };

    if (auth !== "none") {
        const token = getAccessToken();
        if (token) {
            requestHeaders["Authorization"] = `Bearer ${token}`;
        }
    }

    try {
      const response = await client.request({
        url: fullUrl,
        headers: requestHeaders,
        ...config,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 && auth === "required") {
             // Handle 401 specific logic if needed
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

export function useCrudApi() {
  let baseUrl = import.meta.env.VITE_API_BASE || API_BASE;
  baseUrl = baseUrl.replace(/\/+$/, "");
  return useHttpClient(baseUrl);
}
