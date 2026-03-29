import React from 'react';

const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="group block overflow-hidden rounded-lg bg-white shadow-md">
      {/* Image Skeleton - fixed 200px height to match ProductCard */}
      <div className="h-[200px] w-full bg-gray-200 animate-pulse rounded-t-lg" />

      {/* Content Skeleton */}
      <div className="px-2 py-3 space-y-3">
        {/* Product Name Skeleton */}
        <div className="h-4 bg-gray-200 animate-pulse rounded w-3/4" />

        {/* Store Name Skeleton */}
        <div className="h-3 bg-gray-100 animate-pulse rounded w-1/2" />

        {/* Price & Sold Count Skeleton */}
        <div className="flex items-end justify-between pt-1">
          {/* Price */}
          <div className="h-5 bg-orange-100 animate-pulse rounded w-1/4" />
          
          {/* Sold count */}
          <div className="h-3 bg-gray-100 animate-pulse rounded w-1/4" />
        </div>
      </div>
    </div>
  );
};

export default ProductCardSkeleton;
