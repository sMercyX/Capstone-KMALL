import { NavLink } from "react-router-dom";

export type SwitchTabItem = {
  key: string;
  label: string;
  href: string;
};

interface SwitchTabsProps {
  tabs: SwitchTabItem[];
  className?: string;
  rootPath?: string;
}

export default function SwitchTabs({ tabs, className = "" }: SwitchTabsProps) {
  return (
    <div className={`flex justify-center gap-10 ${className}`}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.href}
          end={tab.href === "/store"}
          className="group"
        >
          {({ isActive }) => (
            <span className="relative inline-block pb-2 px-1 font-semibold text-sm md:text-base">
              {/* ข้อความ */}
              <span
                className={`transition-colors ${
                  isActive
                    ? "text-black"
                    : "text-gray-400 group-hover:text-orange-400"
                }`}
              >
                {tab.label}
              </span>

              {/* ❗ เส้นใต้เริ่มจากตรงกลาง และกระจายออกสองข้าง */}
              <span
                className={`
                  absolute left-1/2 -bottom-1 h-[3px] w-full rounded-full bg-black
                  transition-transform duration-1000 ease-out
                  ${isActive ? "scale-x-100 -translate-x-1/2" : "scale-x-0 -translate-x-1/2"}
                  origin-center
                `}
              />
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}
