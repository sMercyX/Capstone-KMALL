// src/api/fetch.ts
import { API_BASE } from "../config";
import { getAccessToken } from "../auth/tokenStore"; // ⭐ เพิ่ม

type AuthMode = "auto" | "required" | "none";

type ExtraOptions = {
  auth?: AuthMode;
  headers?: HeadersInit;
  credentials?: RequestCredentials;
};

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/, "");    // ตัด / ท้าย base
  const p = path.replace(/^\/+/, "");    // ตัด / หน้า path
  return `${b}/${p}`;                    // ต่อให้เหลือ / เดียว
}

export function useHttpClient(baseUrl: string) {
  async function fetchData(
    path: string,
    options: RequestInit & ExtraOptions = {}
  ) {
    const { auth = "auto", headers = {}, credentials, ...rest } = options;

    const url = joinUrl(baseUrl, path);
    const h = new Headers(headers);

    // ⭐ แนบ Bearer token ถ้าไม่ใช่ auth="none"
    if (auth !== "none") {
      const token = getAccessToken();
      if (token && !h.has("Authorization")) {
        h.set("Authorization", `Bearer ${token}`);
      }
    }

    // ตั้ง Content-Type ให้อัตโนมัติถ้าเป็น JSON
    if (rest.body && !h.has("Content-Type") && !isFormData(rest.body)) {
      h.set("Content-Type", "application/json");
    }

    // ใช้ same-origin พอ เพราะเรา auth ด้วย Bearer token แล้ว
    const finalCredentials: RequestCredentials | undefined =
      credentials ?? "same-origin";

    const res = await fetch(url, {
      ...rest,
      headers: h,
      credentials: finalCredentials,
    });

    if (res.status === 401 && auth === "required") {
      const err = new Error("Unauthorized");
      // @ts-expect-error
      err.code = 401;
      throw err;
    }

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) return res.json();
    return res.text();
  }

  const getItems = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "GET", ...opt });

  const postItem = (url: string, item?: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, {
      method: "POST",
      body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}),
      ...opt,
    });

  const putItem = (url: string, item: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, {
      method: "PUT",
      body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}),
      ...opt,
    });

  const deleteItem = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "DELETE", ...opt });

  return { getItems, postItem, putItem, deleteItem };
}

export function useCrudApi() {
  let baseUrl = import.meta.env.VITE_API_BASE || API_BASE;

  baseUrl = baseUrl.replace(/\/+$/, "");

  return useHttpClient(baseUrl);
}
