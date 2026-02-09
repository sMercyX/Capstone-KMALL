// src/components/SwitchTabs/SwitchTabs.tsx
import { NavLink } from "react-router-dom";

export type SwitchTabItem = {
  key: string;
  label: string;
  href?: string; // href อาจไม่ต้องมีก็ได้ในโหมด internal
};

interface SwitchTabsProps {
  tabs: SwitchTabItem[];
  className?: string;
  rootPath?: string;
  // เพิ่มสำหรับโหมด internal tab (ไม่ผูก router)
  useNavLink?: boolean;        // default = true
  activeKey?: string;          // ใช้คู่กับ useNavLink = false
  onChange?: (key: string) => void;
}

export default function SwitchTabs({
  tabs,
  className = "",
  rootPath,
  useNavLink = true,
  activeKey,
  onChange,
}: SwitchTabsProps) {
  // โหมด internal tab (ไม่ใช้ NavLink)
  if (!useNavLink && activeKey) {
    return (
      <div className={`flex justify-center gap-10 ${className}`}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChange?.(tab.key)}
              className="group"
            >
              <span className="relative inline-block pb-2 px-1 font-semibold text-sm md:text-base">
                <span
                  className={`transition-colors ${
                    isActive
                      ? "text-black"
                      : "text-gray-400 group-hover:text-orange-400"
                  }`}
                >
                  {tab.label}
                </span>
                <span
                  className={`
                    absolute left-1/2 -bottom-1 h-[3px] w-full rounded-full bg-black
                    transition-transform duration-700 ease-out
                    ${
                      isActive
                        ? "scale-x-100 -translate-x-1/2"
                        : "scale-x-0 -translate-x-1/2"
                    }
                    origin-center
                  `}
                />
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  // โหมดเดิมที่ใช้ NavLink (OrderPage, StorePage)
  return (
    <div className={`flex justify-center gap-10 ${className}`}>
      {tabs.map((tab) => (
        <NavLink
          key={tab.key}
          to={tab.href ?? "/"}
          end={rootPath ? tab.href === rootPath : undefined}
          className="group"
        >
          {({ isActive }) => (
            <span className="relative inline-block pb-2 px-1 font-semibold text-sm md:text-base">
              <span
                className={`transition-colors ${
                  isActive
                    ? "text-black"
                    : "text-gray-400 group-hover:text-orange-400"
                }`}
              >
                {tab.label}
              </span>
              <span
                className={`
                  absolute left-1/2 -bottom-1 h-[3px] w-full rounded-full bg-black
                  transition-transform duration-700 ease-out
                  ${
                    isActive
                      ? "scale-x-100 -translate-x-1/2"
                      : "scale-x-0 -translate-x-1/2"
                  }
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
