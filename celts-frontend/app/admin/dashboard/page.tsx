"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { AdminStats } from "@/components/admin/admin-stats"
import { UserManagement } from "@/components/admin/user-management"
import { useEffect, useState } from "react"
import { navItems } from "@/components/admin/nav-items"


export default function AdminDashboard() {

  const [userName, setUserName] = useState<string>("")

  useEffect(() => {
    const storedUser = localStorage.getItem("celts_user")
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser)
        setUserName(parsed.name || "")
      } catch (err) {
        console.error("Error parsing user from storage:", err)
      }
    }
  }, [])

  const [currentTab, setCurrentTab] = useState<"overview" | "users">("overview")

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName= {userName} >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, permissions, and system analytics</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button variant={currentTab === "overview" ? "default" : "outline"} onClick={() => setCurrentTab("overview")}>
            Overview
          </Button>
          <Button variant={currentTab === "users" ? "default" : "outline"} onClick={() => setCurrentTab("users")}>
            User Management
          </Button>
        </div>

        {currentTab === "overview" && <AdminStats />}
        {currentTab === "users" && <UserManagement />}
      </div>
    </DashboardLayout>
  )
}
