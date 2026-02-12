// src/auth/msalConfig.ts
import { PublicClientApplication, type Configuration } from "@azure/msal-browser"
// หรือจะเขียนแยกก็ได้:
// import { PublicClientApplication } from "@azure/msal-browser"
// import type { Configuration } from "@azure/msal-browser"

const msalConfig: Configuration = {
  auth: {
    clientId: "48b742ee-fc8e-4c64-8d73-67548f807422",
    authority: "https://login.microsoftonline.com/6f4432dc-20d2-441d-b1db-ac3380ba633d",
    redirectUri:  import.meta.env.VITE_FE_BASE,
    // redirectUri: "https://bscit.sit.kmutt.ac.th/capstone25/cp25ssa2/",
    postLogoutRedirectUri: import.meta.env.VITE_FE_BASE,
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: true,
  },
}

export const msalInstance = new PublicClientApplication(msalConfig)
