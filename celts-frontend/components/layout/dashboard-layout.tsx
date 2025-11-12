"use client"

import type { ReactNode } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface DashboardLayoutProps {
  children: ReactNode
  navItems: Array<{ href: string; label: string; icon: ReactNode }>
  sidebarHeader: string
  userName?: string
}

export function DashboardLayout({ children, navItems, sidebarHeader, userName }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar items={navItems} header={sidebarHeader} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header userName={userName} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
