"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Edit2, Trash2, Eye } from "lucide-react"

interface Test {
  id: string
  name: string
  description: string
  studentsEnrolled: number
  completionRate: number
  averageScore: number
  createdDate: string
  status: "active" | "draft" | "completed"
}

const mockTests: Test[] = [
  {
    id: "1",
    name: "English Proficiency Test - Batch A",
    description: "Assessment for intermediate level students",
    studentsEnrolled: 45,
    completionRate: 87,
    averageScore: 6.5,
    createdDate: "2024-01-15",
    status: "completed",
  },
  {
    id: "2",
    name: "English Proficiency Test - Batch B",
    description: "Assessment for beginner level students",
    studentsEnrolled: 52,
    completionRate: 65,
    averageScore: 5.8,
    createdDate: "2024-02-01",
    status: "active",
  },
]

export function TestManagement() {
  const [tests, setTests] = useState<Test[]>(mockTests)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingTest, setEditingTest] = useState<Test | null>(null)
  const [formData, setFormData] = useState({ name: "", description: "", status: "draft" as const })

  const filteredTests = tests.filter((test) => test.name.toLowerCase().includes(searchTerm.toLowerCase()))

  const handleCreateTest = () => {
    if (formData.name && formData.description) {
      const newTest: Test = {
        id: String(tests.length + 1),
        name: formData.name,
        description: formData.description,
        studentsEnrolled: 0,
        completionRate: 0,
        averageScore: 0,
        createdDate: new Date().toISOString().split("T")[0],
        status: formData.status,
      }
      setTests([...tests, newTest])
      setFormData({ name: "", description: "", status: "draft" })
      setIsDialogOpen(false)
    }
  }

  const handleEditTest = (test: Test) => {
    setEditingTest(test)
    setFormData({ name: test.name, description: test.description, status: test.status })
    setIsDialogOpen(true)
  }

  const handleSaveEdit = () => {
    if (editingTest && formData.name && formData.description) {
      setTests(
        tests.map((t) =>
          t.id === editingTest.id
            ? { ...t, name: formData.name, description: formData.description, status: formData.status }
            : t,
        ),
      )
      setIsDialogOpen(false)
      setEditingTest(null)
      setFormData({ name: "", description: "", status: "draft" })
    }
  }

  const handleDeleteTest = (testId: string) => {
    setTests(tests.filter((t) => t.id !== testId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search tests..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1"
        />
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="gap-2"
              onClick={() => {
                setEditingTest(null)
                setFormData({ name: "", description: "", status: "draft" })
              }}
            >
              <Plus className="w-4 h-4" /> Create Test
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTest ? "Edit Test" : "Create New Test"}</DialogTitle>
              <DialogDescription>
                {editingTest ? "Update test details" : "Fill in the information to create a new test"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Test Name</label>
                <Input
                  placeholder="e.g., English Proficiency Test - Batch A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description</label>
                <Input
                  placeholder="e.g., Assessment for intermediate level students"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  className="w-full px-3 py-2 border border-border rounded bg-background"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={editingTest ? handleSaveEdit : handleCreateTest}>
                {editingTest ? "Save Changes" : "Create Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredTests.map((test) => (
          <Card key={test.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold mb-1">{test.name}</h3>
                <p className="text-sm text-muted-foreground">{test.description}</p>
              </div>
              <span
                className={`px-3 py-1 rounded text-xs font-medium capitalize ${
                  test.status === "active"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : test.status === "completed"
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400"
                }`}
              >
                {test.status}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-lg font-semibold">{test.studentsEnrolled}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completion</p>
                <p className="text-lg font-semibold">{test.completionRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Score</p>
                <p className="text-lg font-semibold">{test.averageScore}/9</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{test.createdDate}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2 bg-transparent">
                <Eye className="w-4 h-4" /> View Results
              </Button>
              <Button variant="outline" size="sm" className="gap-2 bg-transparent" onClick={() => handleEditTest(test)}>
                <Edit2 className="w-4 h-4" /> Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent"
                onClick={() => handleDeleteTest(test.id)}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
