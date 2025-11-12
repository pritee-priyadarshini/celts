"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface WritingTask {
  id: string
  title: string
  description: string
  minWords: number
  maxWords: number
}

const writingTasks: WritingTask[] = [
  {
    id: "task1",
    title: "Task 1: Formal Email",
    description:
      "Write a formal email to your university department regarding your course registration. You should cover: reason for writing, specific request, and any additional information needed.",
    minWords: 150,
    maxWords: 200,
  },
  {
    id: "task2",
    title: "Task 2: Essay",
    description:
      'Write an essay on the topic: "The impact of technology on modern education." You should include: introduction, main arguments, examples, and conclusion.',
    minWords: 250,
    maxWords: 300,
  },
]

interface WritingSectionProps {
  testId: string
}

export function WritingSection({ testId }: WritingSectionProps) {
  const [responses, setResponses] = useState<Record<string, string>>({})

  const getWordCount = (text: string): number => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }

  const handleTextChange = (taskId: string, text: string) => {
    setResponses((prev) => ({ ...prev, [taskId]: text }))
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-accent/10 border-accent/20">
        <p className="text-sm">
          <span className="font-semibold">Instructions:</span> Complete both writing tasks within the time limit. Your
          responses will be evaluated by AI for grammar, vocabulary, coherence, and task achievement.
        </p>
      </Card>

      {writingTasks.map((task, index) => {
        const wordCount = getWordCount(responses[task.id] || "")
        const isWithinLimit = wordCount >= task.minWords && wordCount <= task.maxWords
        const status = wordCount === 0 ? "pending" : isWithinLimit ? "valid" : "invalid"

        return (
          <Card key={task.id} className="p-6">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
              <div className="text-xs text-muted-foreground">
                Word limit: {task.minWords} - {task.maxWords} words
              </div>
            </div>

            <textarea
              value={responses[task.id] || ""}
              onChange={(e) => handleTextChange(task.id, e.target.value)}
              className="w-full p-4 border border-border rounded bg-background text-foreground font-mono text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              rows={10}
              placeholder="Type your response here..."
            />

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span
                  className={`font-semibold ${
                    status === "valid"
                      ? "text-green-600"
                      : status === "invalid"
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {wordCount} words
                </span>
                <span className="text-muted-foreground ml-2">
                  {status === "valid" ? "✓ Valid" : status === "invalid" ? "✗ Invalid range" : ""}
                </span>
              </div>
              <Button variant="outline" size="sm">
                Save Draft
              </Button>
            </div>
          </Card>
        )
      })}
    </div>
  )
}
