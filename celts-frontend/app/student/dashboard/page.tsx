"use client"

import { Clock, BookOpen, FileText } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const navItems = [
  { href: "/student/dashboard", label: "Dashboard", icon: <BookOpen className="w-5 h-5" /> },
  { href: "/student/tests", label: "My Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/student/scores", label: "My Scores", icon: <Clock className="w-5 h-5" /> },
]

interface TestStatus {
  id: string
  name: string
  scheduledDate: string
  status: "upcoming" | "in-progress" | "completed"
  bandScores?: { listening: number; reading: number; writing: number; speaking: number; overall: number }
}

const upcomingTests: TestStatus[] = [
  {
    id: "test-1",
    name: "CELTS Proficiency Test - Batch A",
    scheduledDate: "2024-11-15",
    status: "upcoming",
  },
]

const completedTests: TestStatus[] = [
  {
    id: "test-2",
    name: "CELTS Proficiency Test - Mock",
    scheduledDate: "2024-10-20",
    status: "completed",
    bandScores: {
      listening: 7,
      reading: 7,
      writing: 6,
      speaking: 6,
      overall: 6.5,
    },
  },
]

export default function StudentDashboard() {
  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Student" userName="Alice Johnson">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">View your tests and track your progress</p>
        </div>

        {/* Upcoming Tests */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Upcoming Tests</h2>
          <div className="space-y-4">
            {upcomingTests.map((test) => (
              <Card key={test.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{test.name}</h3>
                    <p className="text-sm text-muted-foreground">Scheduled: {test.scheduledDate}</p>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">{test.status}</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Please log in 10 minutes before the scheduled time. The test will include 4 sections: Listening,
                  Reading, Writing, and Speaking.
                </p>
                <Link href={`/student/test/${test.id}`}>
                  <Button>Start Test</Button>
                </Link>
              </Card>
            ))}
          </div>
        </div>

        {/* Completed Tests */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Completed Tests</h2>
          <div className="space-y-4">
            {completedTests.map((test) => (
              <Card key={test.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-1">{test.name}</h3>
                    <p className="text-sm text-muted-foreground">Completed: {test.scheduledDate}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                    {test.status}
                  </span>
                </div>

                {test.bandScores && (
                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Listening</p>
                      <p className="text-2xl font-bold text-primary">{test.bandScores.listening}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Reading</p>
                      <p className="text-2xl font-bold text-primary">{test.bandScores.reading}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Writing</p>
                      <p className="text-2xl font-bold text-primary">{test.bandScores.writing}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Speaking</p>
                      <p className="text-2xl font-bold text-primary">{test.bandScores.speaking}</p>
                    </div>
                  </div>
                )}

                <div className="bg-accent/10 rounded p-3">
                  <p className="text-sm">
                    <span className="font-semibold">Overall Band Score: </span>
                    <span className="text-accent font-bold text-lg">{test.bandScores?.overall}/9</span>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
