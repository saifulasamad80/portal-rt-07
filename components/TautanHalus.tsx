import Link from "next/link";
import type { ComponentProps } from "react";
import IndikatorPendingNavigasi from "@/components/IndikatorPendingNavigasi";

export default function TautanHalus({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props} className={`relative touch-manipulation ${className ?? ""}`}>
      {children}
      <IndikatorPendingNavigasi ringkas />
    </Link>
  );
}
