"use client"

import { BarChart3, FileText, Users, Settings } from "lucide-react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const navItems = [
  { href: "/faculty/dashboard", label: "Dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { href: "/faculty/tests", label: "Tests", icon: <FileText className="w-5 h-5" /> },
  { href: "/faculty/students", label: "Students", icon: <Users className="w-5 h-5" /> },
  { href: "/faculty/scores", label: "Score Management", icon: <Settings className="w-5 h-5" /> },
]

interface Student {
  id: string
  name: string
  email: string
  testsCompleted: number
  averageScore: number
  enrollmentDate: string
}

const mockStudents: Student[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    testsCompleted: 3,
    averageScore: 7.2,
    enrollmentDate: "2024-01-20",
  },
  {
    id: "2",
    name: "Bob Wilson",
    email: "bob@example.com",
    testsCompleted: 2,
    averageScore: 6.1,
    enrollmentDate: "2024-02-05",
  },
  {
    id: "3",
    name: "Carol Davis",
    email: "carol@example.com",
    testsCompleted: 4,
    averageScore: 7.8,
    enrollmentDate: "2024-01-15",
  },
  {
    id: "4",
    name: "David Martinez",
    email: "david@example.com",
    testsCompleted: 1,
    averageScore: 5.9,
    enrollmentDate: "2024-02-10",
  },
]

export default function StudentManagementPage() {
  const [students, setStudents] = useState<Student[]>(mockStudents)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <DashboardLayout navItems={navItems} sidebarHeader="CELTS Faculty" userName="Dr. John Smith">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Student Management</h1>
          <p className="text-muted-foreground">View and manage enrolled students</p>
        </div>

        <div className="flex items-center gap-4">
          <Input
            placeholder="Search students by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted">
                <tr className="border-b border-border">
                  <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Tests Completed</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold">Average Score</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Enrollment Date</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-6 py-4 text-sm font-medium">{student.name}</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{student.email}</td>
                    <td className="px-6 py-4 text-center text-sm">{student.testsCompleted}</td>
                    <td className="px-6 py-4 text-center text-sm font-medium">{student.averageScore}/9</td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{student.enrollmentDate}</td>
                    <td className="px-6 py-4 text-sm">
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Total Students</p>
            <p className="text-3xl font-bold">{students.length}</p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Avg Tests Completed</p>
            <p className="text-3xl font-bold">
              {(students.reduce((sum, s) => sum + s.testsCompleted, 0) / students.length).toFixed(1)}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-sm text-muted-foreground mb-1">Class Average Score</p>
            <p className="text-3xl font-bold">
              {(students.reduce((sum, s) => sum + s.averageScore, 0) / students.length).toFixed(1)}/9
            </p>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
