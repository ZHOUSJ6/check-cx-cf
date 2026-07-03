"use client"

import { useLocation } from "react-router"

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation(); const pathname = location.pathname
  return (
    <div
      key={pathname}
      className="animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both"
    >
      {children}
    </div>
  )
}
