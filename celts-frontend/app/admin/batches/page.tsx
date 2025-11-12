"use client"


import { useEffect, useState } from "react";
import { BatchManagement} from "@/components/admin/batch-management";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { navItems } from "@/components/admin/nav-items";


export default function BatchManage() {
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
          <h1 className="text-3xl font-bold mb-2">Batch Management</h1>
          <p className="text-muted-foreground">Manage Batches </p>
        </div>

        <BatchManagement />
      </div>
    </DashboardLayout>
  );
}
