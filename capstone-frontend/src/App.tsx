import { Link } from "react-router-dom"
import "./App.css"
import ExampleAuthButton from "./components/Buttons/ExampleAuthButton"
import { useTranslation } from "react-i18next"
import ThemeSwitch from "./components/ThemeSwitch/ThemeSwitch"
import LanguageSwitch from "./components/LanguageSwitch/LanguageSwitch"

function App() {
  const { t } = useTranslation()
  return (
    <>
      <h1>{t("title")}</h1>

      <div
        className="card"
      >
        <ThemeSwitch />
        <LanguageSwitch />
      </div>

      <p className="read-the-docs" >
        {t("welcome", { name: "Student" })}
      </p>
      <div className="card">
        <Link to="/dashboard">ไป Dashboard (ต้องล็อกอิน)</Link>
      </div>
      <div className="card">
        <ExampleAuthButton />
      </div>
    </>
  )
}

export default App
