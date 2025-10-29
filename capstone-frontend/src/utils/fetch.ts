// // // src/hooks/useCrudApi.ts
// // export function useHttpClient(baseUrl: string) {
// //   async function fetchData(path: string, options: RequestInit = {}) {
// //     try {
// //       const url = new URL(path, baseUrl)
// //       const response = await fetch(url, options)
// //       if (!response.ok) {
// //         throw new Error(`HTTP error! Status: ${response.status}`)
// //       }
// //       const contentType = response.headers.get("content-type")
// //       if (contentType && contentType.includes("application/json")) {
// //         return await response.json()
// //       }
// //       return response.text()
// //     } catch (error) {
// //       console.error("Fetch error:", error)
// //       throw error
// //     }
// //   }

// //   const getItems = async (url: string) => {
// //     return fetchData(url, {
// //       method: "GET",
// //       headers: {
// //         "Content-Type": "application/json",
// //       },
// //     })
// //   }

// //   const postItem = async (url: string, item: {}) => {
// //     return fetchData(url, {
// //       method: "POST",
// //       headers: {
// //         "Content-Type": "application/json",
// //       },
// //       body: JSON.stringify(item),
// //     })
// //   }
 
// //   return {
// //     getItems,
// //     postItem,
// //   }
// // }

// // export function useCrudApi() {
// //   const baseUrl =
// //     (import.meta as any)?.env?.VITE_BASE_URL ||
// //     process.env.NEXT_PUBLIC_BASE_URL ||
// //     ""
// //   return useHttpClient(baseUrl)
// // }


// // src/hooks/useCrudApi.ts
// type AuthMode = "auto" | "required" | "none";

// type ExtraOptions = {
//   auth?: AuthMode;
//   headers?: HeadersInit;
//   // headers?: Record<string, string>;
//   // ระบุว่าจะส่ง cookie ไปด้วยไหม (ถ้าหลังบ้านใช้ httpOnly cookie)
//   credentials?: RequestCredentials;
// };

// function getToken() {
//   try {
//     const saved = localStorage.getItem("auth");
//     if (!saved) return null;
//     const parsed = JSON.parse(saved);
//     return parsed?.token ?? null;
//   } catch {
//     return null;
//   }
// }

// export function useHttpClient(baseUrl: string) {
//   async function fetchData(
//     path: string,
//     options: RequestInit & ExtraOptions = {}
//   ) {
//     const {
//       auth = "auto",
//       headers = {},
//       credentials, // optional
//       ...rest
//     } = options;

//     const url = new URL(path, baseUrl);
//     const token = getToken();

//      // ✅ Normalize headers ให้เป็น Headers เสมอ
//     const h = new Headers(headers);

//     // ใส่ Content-Type อัตโนมัติถ้ามี body และยังไม่ได้ใส่
//     if (rest.body && !h.has("Content-Type")) {
//       h.set("Content-Type", "application/json");
//     }
//     if (auth !== "none") {
//       if (token) {
//         h.set("Authorization", `Bearer ${token}`);
//       } else if (auth === "required") {
//         // ไม่มี token แต่ต้องการ -> ให้โยน Unauthorized เพื่อให้ UI เด้ง Login
//         const err = new Error("Unauthorized");
//         // @ts-expect-error แนบ code เพื่อให้ส่วนอื่นเช็คได้
//         err.code = 401;
//         throw err;
//       }
//     }

//     const response = await fetch(url, {
//       ...rest,
//       headers: h,
//       // เปิดให้กำหนดได้กรณีใช้ cookie-based session
//       ...(credentials ? { credentials } : {}),
//     });

//     if (response.status === 401) {
//       const err = new Error("Unauthorized");
//       // @ts-expect-error
//       err.code = 401;
//       throw err;
//     }
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }

//     const contentType = response.headers.get("content-type");
//     if (contentType && contentType.includes("application/json")) {
//       return await response.json();
//     }
//     return response.text();
//   }

//   const getItems = async (url: string, opt: ExtraOptions = {}) => {
//     return fetchData(url, { method: "GET", ...opt });
//   };

//   const postItem = async (
//     url: string,
//     item: unknown,
//     opt: ExtraOptions = {}
//   ) => {
//     return fetchData(url, {
//       method: "POST",
//       body: JSON.stringify(item ?? {}),
//       ...opt,
//     });
//   };

//   const putItem = async (
//     url: string,
//     item: unknown,
//     opt: ExtraOptions = {}
//   ) => {
//     return fetchData(url, {
//       method: "PUT",
//       body: JSON.stringify(item ?? {}),
//       ...opt,
//     });
//   };

//   const deleteItem = async (url: string, opt: ExtraOptions = {}) => {
//     return fetchData(url, { method: "DELETE", ...opt });
//   };

//   return { getItems, postItem, putItem, deleteItem };
// }

// export function useCrudApi() {
//   const baseUrl =
//     (import.meta as any)?.env?.VITE_BASE_URL ||
//     process.env.NEXT_PUBLIC_BASE_URL ||
//     "";
//   return useHttpClient(baseUrl);
// }


// src/hooks/useCrudApi.ts
import { API_BASE } from "../config"; // ใช้ค่าเดียวกับ FE
import { useAuth } from "../auth/AuthContext";

type AuthMode = "auto" | "required" | "none";

type ExtraOptions = {
  auth?: AuthMode;
  headers?: HeadersInit;
  credentials?: RequestCredentials; // ใส่ "include" ถ้าอยากให้ส่ง cookie rt ไปด้วย
};

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

export function useHttpClient(baseUrl: string, ensureFreshToken: () => Promise<string | null>) {
  async function fetchData(
    path: string,
    options: RequestInit & ExtraOptions = {}
  ) {
    const { auth = "auto", headers = {}, credentials, ...rest } = options;

    const url = new URL(path, baseUrl);
    const h = new Headers(headers);

    // ---- เติม Authorization จาก token สดเสมอ ----
    let token: string | null = null;
    if (auth !== "none") {
      token = await ensureFreshToken(); // ถ้าใกล้หมดอายุจะ refresh ให้
      if (token) h.set("Authorization", `Bearer ${token}`);
      else if (auth === "required") {
        const err = new Error("Unauthorized");
        // @ts-expect-error
        err.code = 401;
        throw err;
      }
    }

    // ตั้ง Content-Type อัตโนมัติถ้าเป็น JSON (แต่ไม่แตะ FormData)
    if (rest.body && !h.has("Content-Type") && !isFormData(rest.body)) {
      h.set("Content-Type", "application/json");
    }

    // ยิงจริง (รอบที่ 1)
    let res = await fetch(url, {
      ...rest,
      headers: h,
      ...(credentials ? { credentials } : {}),
    });

    // ถ้า access หมดอายุพอดี → ลอง refresh แล้ว retry 1 ครั้ง
    if (res.status === 401 && auth !== "none") {
      // ขอ access ใหม่ด้วย cookie rt
      const ok = await refreshAccessToken(); // จะใช้ cookie rt อัตโนมัติ
      if (ok) {
        const fresh = await ensureFreshToken();
        if (fresh) {
          h.set("Authorization", `Bearer ${fresh}`);
          res = await fetch(url, {
            ...rest,
            headers: h,
            ...(credentials ? { credentials } : {}),
          });
        }
      }
    }

    if (res.status === 401) {
      const err = new Error("Unauthorized");
      // @ts-expect-error
      err.code = 401;
      throw err;
    }
    if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) return res.json();
    return res.text();
  }

  const getItems = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "GET", ...opt });

  const postItem = (url: string, item: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "POST", body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}), ...opt });

  const putItem = (url: string, item: unknown, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "PUT", body: isFormData(item) ? (item as any) : JSON.stringify(item ?? {}), ...opt });

  const deleteItem = (url: string, opt: ExtraOptions = {}) =>
    fetchData(url, { method: "DELETE", ...opt });

  return { getItems, postItem, putItem, deleteItem };
}

// เรียก /auth/refresh เพื่อนำ rt (HttpOnly cookie) มาแลก access ใหม่
async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include", // <<< สำคัญ ให้ส่ง cookie rt ไปด้วย
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const newToken = data?.access_token as string | undefined;
    if (!newToken) return false;
    // เก็บลง localStorage ให้ AuthContext อ่านรอบต่อไป
    const saved = localStorage.getItem("auth");
    const user = saved ? JSON.parse(saved).user ?? null : null;
    localStorage.setItem("auth", JSON.stringify({ user, token: newToken }));
    return true;
  } catch {
    return false;
  }
}

export function useCrudApi() {
  const { ensureFreshToken } = useAuth(); // จาก AuthContext เวอร์ชันที่เราทำไว้
  const baseUrl =
    (import.meta as any)?.env?.VITE_API_BASE ||
    (process.env as any)?.NEXT_PUBLIC_BASE_URL ||
    "";
  return useHttpClient(baseUrl, ensureFreshToken);
}
