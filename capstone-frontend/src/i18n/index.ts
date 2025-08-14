import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// ตัวอย่างสตริงเริ่มต้น
const resources = {
  en: {
    common: {
      title: "KMALL – KMUTT Marketplace",
      login: "Login",
      buyNow: "Buy now",
      logout: "Logout",
      welcome: "Welcome, {{name}}",
      darkMode: "Dark mode",
      language: "Language",
    },
  },
  th: {
    common: {
      title: "KMALL – ตลาดนักศึกษา KMUTT",
      login: "เข้าสู่ระบบ",
      buyNow: "ซื้อเลย",
      logout: "ออกจากระบบ",
      welcome: "ยินดีต้อนรับ, {{name}}",
      darkMode: "โหมดมืด",
      language: "ภาษา",
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: localStorage.getItem("lang") || "th",
    fallbackLng: "en",
    ns: ["common"],
    defaultNS: "common",
    interpolation: { escapeValue: false },
  });

export default i18n;
