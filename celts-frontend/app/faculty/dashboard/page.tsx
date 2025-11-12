"use client"

import { FileText, Users, BarChart3, Settings } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { FacultyStats } from "@/components/faculty/faculty-stats"
import { TestManagement } from "@/components/faculty/test-management"
import { useState } from "react"

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/tests", label: "Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
]

export default function FacultyDashboard() {
  const [currentTab, setCurrentTab] = useState<"overview" | "tests">("overview")

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName="Dr. John Smith">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Faculty Dashboard</h1>
          <p className="text-muted-foreground">Manage tests, students, and view scores</p>
        </div>

        <div className="flex gap-2 mb-6">
          <Button variant={currentTab === "overview" ? "default" : "outline"} onClick={() => setCurrentTab("overview")}>
            Overview
          </Button>
          <Button variant={currentTab === "tests" ? "default" : "outline"} onClick={() => setCurrentTab("tests")}>
            Test Management
          </Button>
        </div>

        {currentTab === "overview" && <FacultyStats />}
        {currentTab === "tests" && <TestManagement />}
      </div>
    </DashboardLayout>
  )
}
