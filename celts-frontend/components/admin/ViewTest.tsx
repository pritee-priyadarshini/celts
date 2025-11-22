// components/admin/ViewTest.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  Headphones,
  Pen,
  Mic,
  ListChecks,
} from "lucide-react";
import api from "@/lib/api";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

type TestType = "reading" | "listening" | "writing" | "speaking" | string;
type FilterType = "all" | "reading" | "listening" | "writing" | "speaking";

type Option = {
  text: string;
};

type QuestionType = "mcq" | "writing" | "speaking";

interface Question {
  _id?: string;
  questionType: QuestionType;
  prompt: string;
  options?: Option[];
  correctIndex?: number;

  // sections for reading/listening
  sectionId?: string | null;

  // writing
  writingType?: string;
  wordLimit?: number;
  charLimit?: number;

  // speaking
  speakingMode?: "audio" | "video" | "oral";
  recordLimitSeconds?: number;
  playAllowed?: number;

  marks?: number;
  explanation?: string;
}

interface ReadingSection {
  id: string;
  title?: string;
  passage: string;
}

interface ListeningSection {
  id: string;
  title?: string;
  audioUrl: string;
  listenLimit?: number;
}

interface TestSet {
  _id: string;
  title: string;
  description?: string;
  type: TestType;
  timeLimitMinutes?: number | null;
  startTime?: string | null;
  endTime?: string | null;

  passage?: string;
  audioUrl?: string;
  listenLimit?: number;

  readingSections?: ReadingSection[];
  listeningSections?: ListeningSection[];

  questions: Question[];
  createdAt?: string;
  updatedAt?: string;

  // Assume backend populates this (or you can adapt to whatever shape you return)
  createdBy?: {
    _id: string;
    name?: string;
    systemId?: string;
  } | null;
}

interface TestsResponse {
  tests: TestSet[];
}

function typeLabel(t: TestType) {
  switch (t) {
    case "reading":
      return "Reading";
    case "listening":
      return "Listening";
    case "writing":
      return "Writing";
    case "speaking":
      return "Speaking";
    default:
      return t;
  }
}

// Helpers to group questions by section 
function getReadingSections(test: TestSet): ReadingSection[] {
  if (Array.isArray(test.readingSections) && test.readingSections.length > 0) {
    return test.readingSections;
  }
  if (test.passage && test.type === "reading") {
    return [
      {
        id: "_legacy_reading_",
        title: "Passage 1",
        passage: test.passage,
      },
    ];
  }
  return [];
}

function getListeningSections(test: TestSet): ListeningSection[] {
  if (Array.isArray(test.listeningSections) && test.listeningSections.length > 0) {
    return test.listeningSections;
  }
  if (test.audioUrl && test.type === "listening") {
    return [
      {
        id: "_legacy_listening_",
        title: "Audio 1",
        audioUrl: test.audioUrl,
        listenLimit: test.listenLimit ?? 1,
      },
    ];
  }
  return [];
}

function questionsForSection(
  test: TestSet,
  sectionId: string,
  totalSections: number
): Question[] {
  return (test.questions || []).filter((q) => {
    const qSec = q.sectionId;
    if (!qSec || qSec === null) {
      return totalSections === 1;
    }
    return qSec === sectionId;
  });
}

export function ViewTest() {
  const [tests, setTests] = useState<TestSet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("all");

  async function fetchTests() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.apiGet("/admin/tests");
      if (!res.ok) {
        setError(res.error?.message || "Failed to fetch test sets");
        setTests([]);
        setLoading(false);
        return;
      }
      const data: TestsResponse = res.data;
      setTests(data.tests || []);
      if (data.tests && data.tests.length > 0 && !selectedId) {
        setSelectedId(data.tests[0]._id);
      }
    } catch (err: any) {
      console.error("[ViewTest] fetch error:", err);
      setError(err?.message || "Network error");
      setTests([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTests = useMemo(() => {
    const s = search.trim().toLowerCase();
    return tests.filter((t) => {
      const matchSearch =
        !s || t.title.toLowerCase().includes(s) || (t.description ?? "").toLowerCase().includes(s);
      const matchType =
        filterType === "all" ? true : t.type === filterType;
      return matchSearch && matchType;
    });
  }, [tests, search, filterType]);

  const selectedTest = useMemo(
    () => tests.find((t) => t._id === selectedId) || null,
    [tests, selectedId]
  );

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Left: list of tests + search/filter */}
      <div className="w-full md:w-1/3 space-y-3">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">All Test Sets</h2>
              <p className="text-xs text-muted-foreground">
                Search and filter tests, then select one to view its content.
              </p>
            </div>
          </div>

          {/* Search + Filter row */}
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Search by title or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />

            <Select
              value={filterType}
              onValueChange={(val: FilterType) => setFilterType(val)}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="reading">Reading</SelectItem>
                <SelectItem value="listening">Listening</SelectItem>
                <SelectItem value="writing">Writing</SelectItem>
                <SelectItem value="speaking">Speaking</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <Card className="p-2 max-h-[70vh] overflow-auto space-y-1">
          {loading && tests.length === 0 && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <span className="mr-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  />
                </svg>
              </span>
              Loading...
            </div>
          )}

          {error && tests.length === 0 && (
            <p className="text-sm text-red-600 p-2">{error}</p>
          )}

          {tests.length === 0 && !loading && !error && (
            <p className="text-sm text-muted-foreground p-2">
              No tests found. Create a test from the teacher panel.
            </p>
          )}

          {filteredTests.length === 0 && tests.length > 0 && (
            <p className="text-sm text-muted-foreground p-2">
              No tests match the current search/filter.
            </p>
          )}

          {filteredTests.map((t) => (
            <button
              key={t._id}
              type="button"
              onClick={() => setSelectedId(t._id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm border hover:bg-muted transition ${
                selectedId === t._id ? "bg-muted border-primary/60" : "border-transparent"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{t.title}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {typeLabel(t.type)}
                </span>
              </div>
              {t.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {t.description}
                </p>
              )}
            </button>
          ))}
        </Card>
      </div>

      {/* Right: selected test detail */}
      <div className="w-full md:w-2/3 space-y-4">
        {!selectedTest && (
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">
              Select a test from the left panel to view its contents.
            </p>
          </Card>
        )}

        {selectedTest && (
          <>
            {/* Header */}
            <Card className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {selectedTest.type === "reading" && (
                      <BookOpen className="w-5 h-5 text-primary" />
                    )}
                    {selectedTest.type === "listening" && (
                      <Headphones className="w-5 h-5 text-primary" />
                    )}
                    {selectedTest.type === "writing" && (
                      <Pen className="w-5 h-5 text-primary" />
                    )}
                    {selectedTest.type === "speaking" && (
                      <Mic className="w-5 h-5 text-primary" />
                    )}
                    <h2 className="text-lg font-semibold">
                      {selectedTest.title}
                    </h2>
                  </div>

                  {selectedTest.description && (
                    <p className="text-xs text-muted-foreground">
                      {selectedTest.description}
                    </p>
                  )}

                  <p className="text-[11px] text-muted-foreground mt-1">
                    Type:{" "}
                    <span className="font-medium">
                      {typeLabel(selectedTest.type)}
                    </span>
                    {typeof selectedTest.timeLimitMinutes === "number" &&
                      selectedTest.timeLimitMinutes > 0 && (
                        <>
                          {" • "}Time limit:{" "}
                          <span className="font-medium">
                            {selectedTest.timeLimitMinutes} minutes
                          </span>
                        </>
                      )}
                  </p>
                </div>

                {(selectedTest.createdAt || selectedTest.updatedAt || selectedTest.createdBy) && (
                  <div className="text-xs text-right text-muted-foreground space-y-0.5">
                    {selectedTest.createdAt && (
                      <div>
                        Created:{" "}
                        {new Date(selectedTest.createdAt).toLocaleString()}
                      </div>
                    )}
                    {selectedTest.updatedAt && (
                      <div>
                        Updated:{" "}
                        {new Date(selectedTest.updatedAt).toLocaleString()}
                      </div>
                    )}
                    {selectedTest.createdBy && (
                      <div className="mt-1">
                        Teacher:{" "}
                        <span className="font-medium">
                          {selectedTest.createdBy.name || "Unknown"}
                        </span>
                        {selectedTest.createdBy.systemId && (
                          <> (ID: {selectedTest.createdBy.systemId})</>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Body: different rendering per type */}
            {selectedTest.type === "reading" && (
              <ReadingView test={selectedTest} />
            )}

            {selectedTest.type === "listening" && (
              <ListeningView test={selectedTest} />
            )}

            {selectedTest.type === "writing" && (
              <WritingView test={selectedTest} />
            )}

            {selectedTest.type === "speaking" && (
              <SpeakingView test={selectedTest} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// READING VIEW 

function ReadingView({ test }: { test: TestSet }) {
  const sections = getReadingSections(test);

  // If no defined sections and no passage, still fallback to "all questions"
  if (sections.length === 0) {
    return (
      <Card className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground mb-1">
          No passages defined. Showing all questions.
        </p>
        {test.questions.map((q, idx) => (
          <QuestionCard key={q._id || idx} q={q} index={idx} />
        ))}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((sec, idx, arr) => {
        const sectionQuestions = questionsForSection(test, sec.id, arr.length);
        return (
          <div key={sec.id} className="space-y-3">
            {/* Passage */}
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-2">
                Passage {idx + 1}
                {sec.title ? ` — ${sec.title}` : ""}
              </h3>
              <div className="border rounded p-3 bg-muted/30 max-h-64 overflow-auto text-sm whitespace-pre-wrap">
                {sec.passage}
              </div>
            </Card>

            {/* Questions for THIS passage */}
            {sectionQuestions.length > 0 ? (
              sectionQuestions.map((q, qIdx) => (
                <QuestionCard
                  key={q._id || `${sec.id}-${qIdx}`}
                  q={q}
                  index={qIdx}
                />
              ))
            ) : (
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">
                  No questions linked to this passage.
                </p>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

// LISTENING VIEW 
function ListeningView({ test }: { test: TestSet }) {
  const sections = getListeningSections(test);

  if (sections.length === 0) {
    return (
      <Card className="p-4 space-y-3">
        <p className="text-xs text-muted-foreground mb-1">
          No audio sections defined. Showing all questions.
        </p>
        {test.questions.map((q, idx) => (
          <QuestionCard key={q._id || idx} q={q} index={idx} />
        ))}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((sec, idx, arr) => {
        const sectionQuestions = questionsForSection(test, sec.id, arr.length);
        return (
          <div key={sec.id} className="space-y-3">
            <Card className="p-4 space-y-2">
              <h3 className="text-sm font-semibold mb-2">
                Audio {idx + 1}
                {sec.title ? ` — ${sec.title}` : ""}
              </h3>
              {sec.audioUrl ? (
                <>
                  <audio controls src={sec.audioUrl} className="w-full" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Play limit: {sec.listenLimit ?? 1} time(s).
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No audio URL configured for this section.
                </p>
              )}
            </Card>

            {sectionQuestions.length > 0 ? (
              sectionQuestions.map((q, qIdx) => (
                <QuestionCard
                  key={q._id || `${sec.id}-${qIdx}`}
                  q={q}
                  index={qIdx}
                />
              ))
            ) : (
              <Card className="p-3">
                <p className="text-xs text-muted-foreground">
                  No questions linked to this audio.
                </p>
              </Card>
            )}
          </div>
        );
      })}
    </div>
  );
}

// WRITING VIEW 
function WritingView({ test }: { test: TestSet }) {
  if (!test.questions || test.questions.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No writing questions found for this test.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {test.questions.map((q, idx) => (
        <QuestionCard key={q._id || idx} q={q} index={idx} />
      ))}
    </div>
  );
}

// SPEAKING VIEW 
function SpeakingView({ test }: { test: TestSet }) {
  if (!test.questions || test.questions.length === 0) {
    return (
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">
          No speaking questions found for this test.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {test.questions.map((q, idx) => (
        <QuestionCard key={q._id || idx} q={q} index={idx} />
      ))}
    </div>
  );
}

// QUESTION CARD (READ-ONLY) 
function QuestionCard({ q, index }: { q: Question; index: number }) {
  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
            Q{index + 1} • {q.questionType.toUpperCase()}
          </p>
          <p className="text-sm font-medium whitespace-pre-wrap">
            {q.prompt}
          </p>
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {typeof q.marks === "number" && (
            <div>Marks: {q.marks}</div>
          )}
          
        </div>
      </div>

      {q.questionType === "mcq" && q.options && q.options.length > 0 && (
        <div className="mt-2 space-y-1">
          {q.options.map((opt, i) => {
            const isCorrect =
              typeof q.correctIndex === "number" && q.correctIndex === i;
            return (
              <div
                key={i}
                className={`text-xs border rounded px-2 py-1 ${
                  isCorrect
                    ? "border-green-500/60 bg-green-50"
                    : "border-muted bg-muted/40"
                }`}
              >
                <span className="font-semibold mr-1">
                  {String.fromCharCode(65 + i)}.
                </span>
                {opt.text}
                {isCorrect && (
                  <span className="ml-2 text-[10px] uppercase text-green-700 font-semibold">
                    Correct
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {q.questionType === "writing" && (
        <div className="mt-1 text-xs text-muted-foreground space-y-1">
          {q.writingType && (
            <div>
              Writing Type:{" "}
              <span className="font-medium">{q.writingType}</span>
            </div>
          )}
          {q.wordLimit && (
            <div>
              Word Limit: <span className="font-medium">{q.wordLimit}</span>
            </div>
          )}
          {q.charLimit && (
            <div>
              Character Limit:{" "}
              <span className="font-medium">{q.charLimit}</span>
            </div>
          )}
        </div>
      )}

      {q.questionType === "speaking" && (
        <div className="mt-1 text-xs text-muted-foreground space-y-1">
          {q.speakingMode && (
            <div>
              Mode: <span className="font-medium">{q.speakingMode}</span>
            </div>
          )}
          {q.recordLimitSeconds && (
            <div>
              Record Limit:{" "}
              <span className="font-medium">
                {q.recordLimitSeconds} seconds
              </span>
            </div>
          )}
          {q.playAllowed && (
            <div>
              Play Allowed:{" "}
              <span className="font-medium">{q.playAllowed} time(s)</span>
            </div>
          )}
        </div>
      )}

      {q.explanation && (
        <div className="mt-2 border-t pt-2 text-xs text-muted-foreground">
          <span className="font-semibold">Explanation: </span>
          {q.explanation}
        </div>
      )}
    </Card>
  );
}
