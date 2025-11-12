"use client"

import { useState, useRef, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Pause, Volume2, RotateCcw } from "lucide-react"

interface Question {
  id: string
  text: string
  options: string[]
  correctAnswer?: string
}

const listeningQuestions: Question[] = [
  {
    id: "q1",
    text: "What is the main topic of the conversation?",
    options: ["A) Academic advising", "B) Career planning", "C) Course registration", "D) Graduation requirements"],
  },
  {
    id: "q2",
    text: "According to the speaker, what is required for graduation?",
    options: [
      "A) 120 credit hours",
      "B) Completion of all major courses",
      "C) Passing a final exam",
      "D) Submission of a thesis",
    ],
  },
  {
    id: "q3",
    text: "How many times can students listen to the audio?",
    options: ["A) Unlimited", "B) Once only", "C) Twice", "D) Three times"],
  },
]

interface ListeningSectionProps {
  testId: string
}

export function ListeningSection({ testId }: ListeningSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(150)
  const [playCount, setPlayCount] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const audioRef = useRef<HTMLAudioElement>(null)

  const simulateDuration = 150 // 2:30 seconds

  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (prev >= simulateDuration) {
          setIsPlaying(false)
          return simulateDuration
        }
        return prev + 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isPlaying])

  const handlePlayAudio = () => {
    if (!isPlaying && playCount === 0) {
      setIsPlaying(true)
      setPlayCount(1)
    } else if (isPlaying) {
      setIsPlaying(false)
    } else if (!isPlaying && playCount > 0) {
      setIsPlaying(true)
    }
  }

  const handleRestart = () => {
    setCurrentTime(0)
    setIsPlaying(false)
  }

  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }))
  }

  return (
    <div className="space-y-6">
      <Card className="p-6 bg-primary/5 border-primary/20">
        <h2 className="text-lg font-semibold mb-4">Audio Player</h2>

        <div className="space-y-4">
          <div className="bg-background rounded p-4 border border-border">
            <div className="flex items-center gap-4 mb-4">
              <Button
                size="sm"
                onClick={handlePlayAudio}
                disabled={playCount >= 1 && currentTime === 0}
                className="gap-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? "Pause" : "Play"}
              </Button>

              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, "0")}
                  </span>
                  <div className="flex-1 bg-muted rounded h-2">
                    <div
                      className="bg-primary h-full rounded transition-all"
                      style={{ width: `${(currentTime / simulateDuration) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {Math.floor(simulateDuration / 60)}:{String(Math.floor(simulateDuration % 60)).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <Button variant="outline" size="sm" onClick={handleRestart} className="gap-2 bg-transparent">
                <RotateCcw className="w-4 h-4" />
              </Button>

              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </div>

            <p className="text-sm text-muted-foreground">
              {playCount === 0 ? "Note: Audio will play once. Take notes as needed." : "Audio has been played once."}
            </p>
          </div>
        </div>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Questions</h2>

        {listeningQuestions.map((question, index) => (
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
