"use client"

import { BookOpen, FileText, Clock } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

const navItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: <BookOpen className="w-5 h-5" /> },
  { href: "/student/tests", label: "My Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/student/scores", label: "My Scores", icon: <Clock className="w-5 h-5" /> },
]

interface ScoreRecord {
  id: string
  testName: string
  date: string
  listening: number
  reading: number
  writing: number
  speaking: number
  overall: number
}

const scoreHistory: ScoreRecord[] = [
  {
    id: "1",
    testName: "CELTS Mock Test",
    date: "2024-10-20",
    listening: 7,
    reading: 7,
    writing: 6,
    speaking: 6,
    overall: 6.5,
  },
  {
    id: "2",
    testName: "CELTS Simulation 1",
    date: "2024-10-25",
    listening: 7.5,
    reading: 7,
    writing: 6.5,
    speaking: 6,
    overall: 6.75,
  },
]

const scoreProgressData = [
  { test: "Test 1", listening: 6.5, reading: 6.5, writing: 6, speaking: 5.5, overall: 6.1 },
  { test: "Test 2", listening: 7, reading: 6.8, writing: 6.2, speaking: 6, overall: 6.5 },
  { test: "Test 3", listening: 7.2, reading: 7, writing: 6.5, speaking: 6.2, overall: 6.7 },
]

const skillDistribution = [
  { skill: "Listening", score: 7, benchmark: 7.5 },
  { skill: "Reading", score: 7, benchmark: 7 },
  { skill: "Writing", score: 6.5, benchmark: 6.5 },
  { skill: "Speaking", score: 6.2, benchmark: 6.5 },
]

export default function StudentScoresPage() {
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName="Alice Johnson">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">My Scores</h1>
          <p className="text-muted-foreground">Track your progress and performance history</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Latest Overall Score</p>
            <p className="text-3xl font-bold">6.75/9</p>
            <p className="text-xs text-green-600 mt-2">+0.25 from previous</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Highest Score</p>
            <p className="text-3xl font-bold">6.75/9</p>
            <p className="text-xs text-muted-foreground mt-2">25 Oct 2024</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Tests Completed</p>
            <p className="text-3xl font-bold">2</p>
            <p className="text-xs text-muted-foreground mt-2">1 pending</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Average Score</p>
            <p className="text-3xl font-bold">6.6/9</p>
            <p className="text-xs text-muted-foreground mt-2">Across all tests</p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Score Progression</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={scoreProgressData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="test" />
                <YAxis domain={[0, 9]} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="listening" stroke="var(--color-primary)" />
                <Line type="monotone" dataKey="reading" stroke="var(--color-accent)" />
                <Line type="monotone" dataKey="writing" stroke="var(--color-chart-2)" />
                <Line type="monotone" dataKey="speaking" stroke="var(--color-chart-3)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Latest Skills Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={skillDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="skill" />
                <YAxis domain={[0, 9]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="var(--color-primary)" name="Your Score" />
                <Bar dataKey="benchmark" fill="var(--color-muted)" name="Benchmark" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Score History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Test Name</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Listening</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Reading</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Writing</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Speaking</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Overall</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {scoreHistory.map((record) => (
                  <tr key={record.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-3 text-sm font-medium">{record.testName}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{record.listening}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{record.reading}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{record.writing}</td>
                    <td className="px-4 py-3 text-center text-sm font-medium">{record.speaking}</td>
                    <td className="px-4 py-3 text-center text-sm font-bold text-primary">{record.overall}/9</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{record.date}</td>
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
