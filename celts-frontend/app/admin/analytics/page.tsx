"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import {
  LineChart as LineChartComponent,
  Line,
  PieChart as PieChartComponent,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { navItems } from "@/components/admin/nav-items"
import { useEffect, useState } from "react"

const systemUsage = [
  { day: "Mon", users: 120, tests: 45, submissions: 38 },
  { day: "Tue", users: 150, tests: 52, submissions: 44 },
  { day: "Wed", users: 175, tests: 65, submissions: 58 },
  { day: "Thu", users: 200, tests: 72, submissions: 65 },
  { day: "Fri", users: 220, tests: 85, submissions: 75 },
]

const roleDistribution = [
  { name: "Admin", value: 5 },
  { name: "Faculty", value: 25 },
  { name: "Student", value: 1220 },
]

const COLORS = ["#8b5cf6", "#3b82f6", "#10b981"]

export default function AnalyticsPage() {
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
          <h1 className="text-3xl font-bold mb-2">System Analytics</h1>
          <p className="text-muted-foreground">Monitor platform usage and performance metrics</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Users</p>
            <p className="text-2xl font-bold">1,250</p>
            <p className="text-xs text-green-600 mt-2">+5.2% this week</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Tests</p>
            <p className="text-2xl font-bold">845</p>
            <p className="text-xs text-green-600 mt-2">+12.3% this week</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Completion Rate</p>
            <p className="text-2xl font-bold">87.2%</p>
            <p className="text-xs text-green-600 mt-2">+3.1% this week</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Avg. Score</p>
            <p className="text-2xl font-bold">6.8/9</p>
            <p className="text-xs text-green-600 mt-2">+0.5 this week</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Weekly System Usage</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChartComponent data={systemUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="users" stroke="var(--color-primary)" name="Active Users" />
                <Line type="monotone" dataKey="tests" stroke="var(--color-accent)" name="Tests Created" />
                <Line type="monotone" dataKey="submissions" stroke="var(--color-secondary)" name="Submissions" />
              </LineChartComponent>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">User Distribution by Role</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChartComponent>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {roleDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChartComponent>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
