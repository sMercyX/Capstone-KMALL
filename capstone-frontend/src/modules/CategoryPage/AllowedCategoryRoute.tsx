
import type { JSX } from "react";
import { useParams, Navigate } from "react-router-dom";

const allowed = ["food", "clothe", "handmade"];

export default function AllowedCategoryRoute({ children }: { children: JSX.Element }) {
  const { category } = useParams();

  if (!category || !allowed.includes(category)) {
    return <Navigate to="*" replace />;
  }

  return children;
}
