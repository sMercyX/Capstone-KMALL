import { useTranslation } from "react-i18next";

export default function LanguageSwitch() {
  const { i18n, t } = useTranslation();

  function setLang(lng: "th" | "en") {
    i18n.changeLanguage(lng);
    localStorage.setItem("lang", lng);
  }

  return (
    <div style={{ display: "inline-flex", gap: 8 }}>
      <span>{t("language")}:</span>
      <button onClick={() => setLang("th")}>TH</button>
      <button onClick={() => setLang("en")}>EN</button>
    </div>
  );
}