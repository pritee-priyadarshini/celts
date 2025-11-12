"use client"

import { Card } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const statsData = [
  { label: "Total Users", value: 1250, change: "+5.2%" },
  { label: "Active Tests", value: 45, change: "+12.3%" },
  { label: "Avg Score", value: "6.8/9", change: "+0.5" },
  { label: "Completion Rate", value: "87.2%", change: "+3.1%" },
]

const scoreDistribution = [
  { band: "1-2", count: 15 },
  { band: "3-4", count: 45 },
  { band: "5-6", count: 120 },
  { band: "7-8", count: 95 },
  { band: "9", count: 25 },
]

const testTrends = [
  { week: "Week 1", tests: 120, passed: 95 },
  { week: "Week 2", tests: 150, passed: 128 },
  { week: "Week 3", tests: 175, passed: 152 },
  { week: "Week 4", tests: 200, passed: 175 },
]

export function AdminStats() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsData.map((stat, i) => (
          <Card key={i} className="p-6">
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-green-600">{stat.change}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Score Distribution (Band Scores)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="band" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="var(--color-primary)" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Test Completion Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={testTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="tests" stroke="var(--color-primary)" />
              <Line type="monotone" dataKey="passed" stroke="var(--color-accent)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
