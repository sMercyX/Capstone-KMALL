import React, { useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  X, 
  User, 
  ShoppingBag, 
  ClipboardList, 
  MapPin, 
  LogOut, 
  Bell,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useAuth } from '../../auth/AuthContext';
import ThemeSwitch2 from '../ThemeSwitch/ThemeSwitch2';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  storeLink: string;
  isStoreActive: boolean;
  isCartActive: boolean;
  isReportActive: boolean;
  isAddressActive: boolean;
  unreadNotifications: number;
}

const MobileMenu: React.FC<MobileMenuProps> = ({
  isOpen,
  onClose,
  storeLink,
  isStoreActive,
  isCartActive,
  isReportActive,
  isAddressActive,
  unreadNotifications
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const { name, email, roles } = useUserStore();
  const { logout } = useAuth();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const getDisplayRole = () => {
    if (!roles || roles.length === 0) return "Guest";
    if (roles.includes("admin")) return "Admin";
    if (roles.includes("seller")) return "Seller";
    return "Buyer";
  };

  return (
    <div className="fixed inset-0 z-[100] md:hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      {/* Menu Content */}
      <div 
        ref={menuRef}
        className="absolute right-0 top-0 bottom-0 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800">Menu</h2>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* User Profile */}
        <div className="p-6 bg-orange-50/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 border-2 border-white shadow-sm">
              <User size={28} />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight">{name}</p>
              <p className="text-xs text-gray-500 truncate max-w-[180px]">{email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded text-[10px] font-bold uppercase tracking-wider">
                {getDisplayRole()}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-orange-100/50">
            <span className="text-sm text-gray-600">Appearance</span>
            <ThemeSwitch2 />
          </div>
        </div>

        {/* Main Links */}
        <div className="flex-1 px-4 py-6 space-y-1">
          <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Navigation</p>
          
          {roles?.includes("admin") && (
            <MenuLink 
              to="/admin" 
              icon={<ShieldCheck size={20} />} 
              label="Admin Panel" 
              onClick={onClose}
              external
            />
          )}

          <MenuLink 
            to={storeLink} 
            icon={<ShoppingBag size={20} />} 
            label="My Store" 
            active={isStoreActive}
            onClick={onClose}
            external
          />

          <MenuLink 
            to="/orders/ongoing" 
            icon={<ClipboardList size={20} />} 
            label="My Orders" 
            active={isCartActive}
            onClick={onClose}
          />

          <MenuLink 
            to="/reports" 
            icon={<Bell size={20} />} 
            label="My Reports" 
            active={isReportActive}
            onClick={onClose}
            badge={unreadNotifications > 0 ? unreadNotifications : undefined}
          />

          <MenuLink 
            to="/addresses" 
            icon={<MapPin size={20} />} 
            label="My Addresses" 
            active={isAddressActive}
            onClick={onClose}
          />
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50">
          <button 
            onClick={() => {
              logout();
              onClose();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-xl text-gray-600 font-medium hover:bg-red-50 hover:text-red-500 hover:border-red-100 transition-all duration-200"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};

interface MenuLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  external?: boolean;
  badge?: number;
}

const MenuLink: React.FC<MenuLinkProps> = ({ to, icon, label, active, onClick, external, badge }) => {
  const content = (
    <div className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
      active 
        ? "bg-orange-500 text-white shadow-md shadow-orange-200" 
        : "text-gray-600 hover:bg-gray-100"
    }`}>
      <div className="flex items-center gap-3">
        <span className={`${active ? "text-white" : "text-gray-400"}`}>{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {badge !== undefined && (
          <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            {badge > 9 ? "9+" : badge}
          </span>
        )}
        {!active && <ChevronRight size={16} className="text-gray-300" />}
      </div>
    </div>
  );

  if (external) {
    return (
      <Link to={to} target="_blank" onClick={onClick} className="block no-underline">
        {content}
      </Link>
    );
  }

  return (
    <Link to={to} onClick={onClick} className="block no-underline">
      {content}
    </Link>
  );
};

export default MobileMenu;
