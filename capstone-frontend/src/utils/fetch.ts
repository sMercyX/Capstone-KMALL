// // src/hooks/useCrudApi.ts
// export function useHttpClient(baseUrl: string) {
//   async function fetchData(path: string, options: RequestInit = {}) {
//     try {
//       const url = new URL(path, baseUrl)
//       const response = await fetch(url, options)
//       if (!response.ok) {
//         throw new Error(`HTTP error! Status: ${response.status}`)
//       }
//       const contentType = response.headers.get("content-type")
//       if (contentType && contentType.includes("application/json")) {
//         return await response.json()
//       }
//       return response.text()
//     } catch (error) {
//       console.error("Fetch error:", error)
//       throw error
//     }
//   }

//   const getItems = async (url: string) => {
//     return fetchData(url, {
//       method: "GET",
//       headers: {
//         "Content-Type": "application/json",
//       },
//     })
//   }

//   const postItem = async (url: string, item: {}) => {
//     return fetchData(url, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(item),
//     })
//   }
 
//   return {
//     getItems,
//     postItem,
//   }
// }

// export function useCrudApi() {
//   const baseUrl =
//     (import.meta as any)?.env?.VITE_BASE_URL ||
//     process.env.NEXT_PUBLIC_BASE_URL ||
//     ""
//   return useHttpClient(baseUrl)
// }


// src/hooks/useCrudApi.ts
type AuthMode = "auto" | "required" | "none";

type ExtraOptions = {
  auth?: AuthMode;
  headers?: HeadersInit;
  // headers?: Record<string, string>;
  // ระบุว่าจะส่ง cookie ไปด้วยไหม (ถ้าหลังบ้านใช้ httpOnly cookie)
  credentials?: RequestCredentials;
};

function getToken() {
  try {
    const saved = localStorage.getItem("auth");
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return parsed?.token ?? null;
  } catch {
    return null;
  }
}

export function useHttpClient(baseUrl: string) {
  async function fetchData(
    path: string,
    options: RequestInit & ExtraOptions = {}
  ) {
    const {
      auth = "auto",
      headers = {},
      credentials, // optional
      ...rest
    } = options;

    const url = new URL(path, baseUrl);
    const token = getToken();

     // ✅ Normalize headers ให้เป็น Headers เสมอ
    const h = new Headers(headers);

    // ใส่ Content-Type อัตโนมัติถ้ามี body และยังไม่ได้ใส่
    if (rest.body && !h.has("Content-Type")) {
      h.set("Content-Type", "application/json");
    }
    if (auth !== "none") {
      if (token) {
        h.set("Authorization", `Bearer ${token}`);
      } else if (auth === "required") {
        // ไม่มี token แต่ต้องการ -> ให้โยน Unauthorized เพื่อให้ UI เด้ง Login
        const err = new Error("Unauthorized");
        // @ts-expect-error แนบ code เพื่อให้ส่วนอื่นเช็คได้
        err.code = 401;
        throw err;
      }
    }

    const response = await fetch(url, {
      ...rest,
      headers: h,
      // เปิดให้กำหนดได้กรณีใช้ cookie-based session
      ...(credentials ? { credentials } : {}),
    });

    if (response.status === 401) {
      const err = new Error("Unauthorized");
      // @ts-expect-error
      err.code = 401;
      throw err;
    }
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    return response.text();
  }

  const getItems = async (url: string, opt: ExtraOptions = {}) => {
    return fetchData(url, { method: "GET", ...opt });
  };

  const postItem = async (
    url: string,
    item: unknown,
    opt: ExtraOptions = {}
  ) => {
    return fetchData(url, {
      method: "POST",
      body: JSON.stringify(item ?? {}),
      ...opt,
    });
  };

  const putItem = async (
    url: string,
    item: unknown,
    opt: ExtraOptions = {}
  ) => {
    return fetchData(url, {
      method: "PUT",
      body: JSON.stringify(item ?? {}),
      ...opt,
    });
  };

  const deleteItem = async (url: string, opt: ExtraOptions = {}) => {
    return fetchData(url, { method: "DELETE", ...opt });
  };

  return { getItems, postItem, putItem, deleteItem };
}

export function useCrudApi() {
  const baseUrl =
    (import.meta as any)?.env?.VITE_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "";
  return useHttpClient(baseUrl);
}
