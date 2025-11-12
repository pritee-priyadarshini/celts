"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Question {
  id: string
  text: string
  options: string[]
  passageRef?: string
}

const readingPassages = {
  passage1: `Climate change is one of the most pressing challenges of our time. Rising temperatures are causing 
ice sheets to melt, sea levels to rise, and weather patterns to become increasingly unpredictable. 
These environmental changes have significant implications for human societies, affecting agriculture, 
water resources, and public health.

Scientists worldwide have reached a consensus that human activities, particularly the burning of fossil 
fuels, are the primary cause of current climate change. To address this crisis, many countries have 
committed to reducing their carbon emissions and transitioning to renewable energy sources.`,

  passage2: `The development of artificial intelligence has revolutionized various industries. Machine learning algorithms 
can now analyze vast amounts of data, identify patterns, and make predictions with remarkable accuracy. 
In healthcare, AI is being used to diagnose diseases earlier, improve treatment plans, and develop new medicines. 
In education, personalized learning systems powered by AI are helping students learn at their own pace.`,
}

const readingQuestions: Question[] = [
  {
    id: "r1",
    text: "According to the passage, what is the primary cause of current climate change?",
    options: [
      "A) Natural weather cycles",
      "B) Human activities, particularly burning fossil fuels",
      "C) Volcanic eruptions",
      "D) Solar radiation changes",
    ],
    passageRef: "passage1",
  },
  {
    id: "r2",
    text: "Which of the following is NOT mentioned as an effect of climate change?",
    options: [
      "A) Rising sea levels",
      "B) Unpredictable weather patterns",
      "C) Decreased carbon emissions",
      "D) Agricultural impacts",
    ],
    passageRef: "passage1",
  },
  {
    id: "r3",
    text: "What is mentioned as an application of AI in healthcare?",
    options: [
      "A) Only diagnosing diseases",
      "B) Diagnosing diseases earlier and developing new medicines",
      "C) Only creating treatment plans",
      "D) None of the above",
    ],
    passageRef: "passage2",
  },
]

interface ReadingSectionProps {
  testId: string
}

export function ReadingSection({ testId }: ReadingSectionProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [currentPassage, setCurrentPassage] = useState<keyof typeof readingPassages>("passage1")

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  return (
    <div className="space-y-6">
      <Tabs
        value={currentPassage}
        onValueChange={(v) => setCurrentPassage(v as keyof typeof readingPassages)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="passage1">Passage 1</TabsTrigger>
          <TabsTrigger value="passage2">Passage 2</TabsTrigger>
        </TabsList>

        <TabsContent value="passage1" className="space-y-4">
          <Card className="p-6 bg-secondary/5">
            <h2 className="text-lg font-semibold mb-4">Reading Passage</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">{readingPassages.passage1}</p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="passage2" className="space-y-4">
          <Card className="p-6 bg-secondary/5">
            <h2 className="text-lg font-semibold mb-4">Reading Passage</h2>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="whitespace-pre-wrap text-foreground leading-relaxed">{readingPassages.passage2}</p>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Questions</h2>

        {readingQuestions.map((question, index) => (
          <Card key={question.id} className={`p-6 ${answers[question.id] ? "border-primary/30" : ""}`}>
            <div className="mb-4">
              <p className="font-semibold mb-2">Question {index + 1}</p>
              <p className="text-foreground mb-4">{question.text}</p>
            </div>

            <div className="space-y-2">
              {question.options.map((option, optIndex) => {
                const answer = String.fromCharCode(65 + optIndex)
                return (
                  <label
                    key={optIndex}
                    className="flex items-center p-3 border border-border rounded hover:bg-muted/50 cursor-pointer transition"
                  >
                    <input
                      type="radio"
                      name={`question-${question.id}`}
                      value={answer}
                      checked={answers[question.id] === answer}
                      onChange={() => handleAnswerChange(question.id, answer)}
                      className="mr-3"
                    />
                    <span>{option}</span>
                  </label>
                )
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
