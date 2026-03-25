import React from 'react';
import { FiSearch } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  isSearching?: boolean;
  className?: string;
  containerClassName?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "Search...",
  isSearching = false,
  className = "",
  containerClassName = "w-full sm:w-[300px]"
}) => {
  return (
    <div className={`relative ${containerClassName}`}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        {isSearching ? (
          <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
        ) : (
          <FiSearch size={18} />
        )}
      </span>
      <input
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:border-orange-500 transition-colors shadow-sm ${className}`}
      />
    </div>
  );
};

export default SearchInput;
