"use client"

import { Lock } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { navItems } from "@/components/admin/nav-items"
import { useState, useEffect } from "react"

const permissions = [
  {
    name: "View Dashboard",
    key: "view_dashboard",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "Manage Users",
    key: "manage_users",
    admin: true,
    faculty: false,
    student: false,
  },
  {
    name: "Create Tests",
    key: "create_tests",
    admin: true,
    faculty: true,
    student: false,
  },
  {
    name: "View Results",
    key: "view_results",
    admin: true,
    faculty: true,
    student: true,
  },
  {
    name: "Grade Tests",
    key: "grade_tests",
    admin: true,
    faculty: true,
    student: false,
  },
  {
    name: "View Analytics",
    key: "view_analytics",
    admin: true,
    faculty: true,
    student: false,
  },
]

export default function PermissionsPage() {
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
          <h1 className="text-3xl font-bold mb-2">Role Permissions</h1>
          <p className="text-muted-foreground">Manage permissions for each user role</p>
        </div>

        <Card className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Permission</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Admin</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Faculty</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Student</th>
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr key={perm.key} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{perm.name}</td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.admin} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.faculty} disabled />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Checkbox checked={perm.student} disabled />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Permission Notes
            </h3>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Admin: Full system access and user management</li>
              <li>• Faculty: Can create tests, grade submissions, and view analytics</li>
              <li>• Student: Can take tests and view personal results</li>
            </ul>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
