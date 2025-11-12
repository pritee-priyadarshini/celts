"use client"

import { useState, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mic, Square, Upload } from "lucide-react"

interface SpeakingPart {
  id: string
  title: string
  duration: number
  description: string
  type: "record" | "upload"
}

const speakingParts: SpeakingPart[] = [
  {
    id: "part1",
    title: "Part 1: Self-Introduction",
    duration: 1,
    description: "Introduce yourself. Include your name, background, and what you study or do.",
    type: "record",
  },
  {
    id: "part2",
    title: "Part 2: Topic Discussion",
    duration: 2,
    description:
      "Discuss a memorable trip you've taken. Include where you went, when, with whom, and why it was memorable.",
    type: "record",
  },
  {
    id: "part3",
    title: "Part 3: Presentation",
    duration: 3,
    description: 'Upload a 3-4 minute video presentation on the topic: "The Future of Renewable Energy".',
    type: "upload",
  },
]

interface SpeakingSectionProps {
  testId: string
}

export function SpeakingSection({ testId }: SpeakingSectionProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [recordings, setRecordings] = useState<Record<string, boolean>>({})
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startRecording = async (partId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: { facingMode: "user" },
      })
      streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.start()
      setIsRecording(true)
      setRecordingDuration(0)

      const timer = setInterval(() => {
        setRecordingDuration((prev) => prev + 1)
      }, 1000)

      mediaRecorder.onstop = () => {
        clearInterval(timer)
        setRecordings((prev) => ({ ...prev, [partId]: true }))
        stream.getTracks().forEach((track) => track.stop())
      }
    } catch (error) {
      console.error("Error accessing media devices:", error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-accent/10 border-accent/20">
        <p className="text-sm">
          <span className="font-semibold">Note:</span> For parts 1 & 2, you can record directly using your microphone
          and webcam. For part 3, upload a pre-recorded 3-4 minute video. Your speech will be analyzed for
          pronunciation, fluency, grammar, and vocabulary.
        </p>
      </Card>

      {speakingParts.map((part) => (
        <Card key={part.id} className="p-6">
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold">{part.title}</h3>
              <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                {part.duration} min{part.duration > 1 ? "s" : ""}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{part.description}</p>
          </div>

          {part.type === "record" && (
            <div className="space-y-4">
              <div className="bg-background rounded p-4 border border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Recording Time</p>
                    <p className="text-2xl font-mono font-bold">
                      {String(Math.floor(recordingDuration / 60)).padStart(2, "0")}:
                      {String(recordingDuration % 60).padStart(2, "0")}
                    </p>
                  </div>
                  {isRecording && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                      <span className="text-sm text-red-600">Recording...</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {!isRecording ? (
                    <Button onClick={() => startRecording(part.id)} className="gap-2">
                      <Mic className="w-4 h-4" />
                      Start Recording
                    </Button>
                  ) : (
                    <Button variant="destructive" onClick={stopRecording} className="gap-2">
                      <Square className="w-4 h-4" />
                      Stop Recording
                    </Button>
                  )}
                </div>
              </div>

              {recordings[part.id] && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  ✓ Recording saved for {part.title}
                </div>
              )}
            </div>
          )}

          {part.type === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-border rounded p-8 text-center hover:bg-muted/30 transition cursor-pointer">
                <div className="flex flex-col items-center justify-center gap-3">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Drag and drop your video here</p>
                    <p className="text-sm text-muted-foreground">or click to select a file</p>
                    <p className="text-xs text-muted-foreground mt-1">Supported formats: MP4, MOV, WebM (Max 500MB)</p>
                  </div>
                </div>
              </div>

              {recordings[part.id] && (
                <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
                  ✓ Video uploaded for {part.title}
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
