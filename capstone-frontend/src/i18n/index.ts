import i18n from "i18next"
import { initReactI18next } from "react-i18next"

// ตัวอย่างสตริงเริ่มต้น
const resources = {
  en: {
    common: {
      title: "KMALL – KMUTT Marketplace",
      buyNow: "Buy Now",
      welcome: "Welcome, {{name}}",
      darkMode: "Dark mode",
      language: "Language",
    },
    login: {
      login: "Sign In",
      logout: "Sign Out",
      loginMicrosoft: "Sign in with your KMUTT email"
    },
  },
  th: {
    common: {
      title: "KMALL – ตลาดนักศึกษา KMUTT",
      buyNow: "ซื้อเลย",
      welcome: "ยินดีต้อนรับ, {{name}}",
      darkMode: "โหมดมืด",
      language: "ภาษา",
    },
    login: {
      login: "ล็อกอิน",
      logout: "ออกจากระบบ",
      loginMicrosoft: "ล็อกอินด้วยอีเมลบางมด"

    },
  },
}

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem("lang") || "th",
  fallbackLng: "en",
  ns: ["common","login"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
})

export default i18n
