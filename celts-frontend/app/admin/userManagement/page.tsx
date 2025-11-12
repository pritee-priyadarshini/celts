"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { UserManagement } from "@/components/admin/user-management"
import { navItems } from "@/components/admin/nav-items"
import { useState, useEffect } from "react"

export default function UserManage() {
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
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Admin" userName={userName}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">User Permission</h1>
          <p className="text-muted-foreground">Manage users & permissions</p>
        </div>

        <UserManagement />
      </div>
    </DashboardLayout>
  )
}
