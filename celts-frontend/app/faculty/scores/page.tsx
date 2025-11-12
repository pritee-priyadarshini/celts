"use client"

import { BarChart3, FileText, Users, Settings } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  BarChart as BarChartComponent,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart as LineChartComponent,
  Line,
  Legend,
} from "recharts"

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/tests", label: "Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
]

const scoreDistribution = [
  { range: "1-2", count: 5 },
  { range: "3-4", count: 18 },
  { range: "5-6", count: 45 },
  { range: "7-8", count: 52 },
  { range: "9", count: 12 },
]

const skillBreakdown = [
  { skill: "Listening", average: 6.8, passRate: 85 },
  { skill: "Reading", average: 7.2, passRate: 88 },
  { skill: "Writing", average: 5.9, passRate: 72 },
  { skill: "Speaking", average: 6.1, passRate: 75 },
]

const trendData = [
  { week: "Week 1", avg: 6.2, total: 25 },
  { week: "Week 2", avg: 6.4, total: 32 },
  { week: "Week 3", avg: 6.7, total: 38 },
  { week: "Week 4", avg: 6.9, total: 42 },
]

export default function ScoreManagementPage() {
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName="Dr. John Smith">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Score Management</h1>
          <p className="text-muted-foreground">Monitor and analyze student performance</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Overall Average</p>
            <p className="text-3xl font-bold">6.8/9</p>
            <p className="text-xs text-green-600 mt-2">+0.3 from last week</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Pass Rate</p>
            <p className="text-3xl font-bold">80.2%</p>
            <p className="text-xs text-green-600 mt-2">+2.1% from last week</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Tests Graded</p>
            <p className="text-3xl font-bold">152</p>
            <p className="text-xs text-muted-foreground mt-2">Pending: 8</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Highest Score</p>
            <p className="text-3xl font-bold">9.0</p>
            <p className="text-xs text-muted-foreground mt-2">by Carol Davis</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChartComponent data={scoreDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-primary)" />
              </BarChartComponent>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Trend Analysis</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChartComponent data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avg" stroke="var(--color-primary)" name="Average Score" />
                <Line type="monotone" dataKey="total" stroke="var(--color-accent)" name="Tests Submitted" />
              </LineChartComponent>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Skill Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Skill</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Average Score</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Pass Rate</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {skillBreakdown.map((skill) => (
                  <tr key={skill.skill} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{skill.skill}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold">{skill.average}/9</td>
                    <td className="px-4 py-3 text-center text-sm">{skill.passRate}%</td>
                    <td className="px-4 py-3 text-center">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
