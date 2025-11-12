"use client"

import { Card } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"

const stats = [
  { label: "Active Tests", value: 8 },
  { label: "Enrolled Students", value: 245 },
  { label: "Tests Completed", value: 189 },
  { label: "Avg Band Score", value: "6.5/9" },
]

const skillScores = [
  { name: "Listening", value: 65 },
  { name: "Reading", value: 72 },
  { name: "Writing", value: 58 },
  { name: "Speaking", value: 62 },
]

const submissionTrend = [
  { date: "Mon", submissions: 20 },
  { date: "Tue", submissions: 32 },
  { date: "Wed", submissions: 28 },
  { date: "Thu", submissions: 45 },
  { date: "Fri", submissions: 38 },
  { date: "Sat", submissions: 15 },
  { date: "Sun", submissions: 8 },
]

const COLORS = ["var(--color-primary)", "var(--color-accent)", "var(--color-chart-2)", "var(--color-chart-3)"]

export function FacultyStats() {
  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-6">
            <p className="text-sm text-muted-foreground mb-1">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Average Scores by Skill</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={skillScores}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {skillScores.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Weekly Submission Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={submissionTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="submissions" stroke="var(--color-primary)" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
