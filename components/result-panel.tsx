import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export type GradeResult = {
  grade: string
  score: number // now 0..21
  level: string
  summary: string
  strengths: string[]
  improvements: string[]
  rubric: {
    content: number
    organisation: number
    language: number
    style: number
    mechanics: number
    comments: string
  }
  inlineFeedback: string
  sectioned?: {
    content: { score7: number; bullets: string[]; suggestedImprovement?: string }
    language: { score7: number; grammarIssues: string[]; vocabEnhancements: string[] }
    organisation: { score7: number; bullets: string[]; transitions?: string }
    overallSuggestions: string[]
    improvedParagraph: string
    sampleEssay: string
  }
  meta?: {
    extractionWarning?: string
    model?: string
    total21?: number
  }
}

export function ResultPanel({ result }: { result: GradeResult }) {
  const r =
    result ||
    ({
      grade: "—",
      score: 0,
      level: "—",
      summary: "",
      strengths: [],
      improvements: [],
      rubric: { content: 0, organisation: 0, language: 0, style: 0, mechanics: 0, comments: "" },
      inlineFeedback: "",
      sectioned: undefined,
      meta: { model: "" },
    } as GradeResult)

  const hasBoxes = !!r.sectioned
  const total21 = hasBoxes
    ? clamp7(r.sectioned!.content?.score7) +
      clamp7(r.sectioned!.language?.score7) +
      clamp7(r.sectioned!.organisation?.score7)
    : clamp21(r.score ?? r.meta?.total21 ?? 0)

  return (
    <div className="grid gap-6 md:grid-cols-5 text-white">
      {/* Overview */}
      <Card className="md:col-span-2 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-4xl font-semibold tracking-tight">
            {total21}
            {"/"}21
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-full bg-neutral-800 text-neutral-200">
              {r.level}
            </Badge>
            <span className="text-neutral-300 text-sm">{r.grade}</span>
          </div>
          {r.meta?.model && (
            <div className="text-xs text-neutral-400">
              {"Model: "}
              {r.meta.model}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rubric */}
      <Card className="md:col-span-3 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg text-white">Rubric breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Metric label="Content" value={r.rubric.content} />
            <Metric label="Organisation" value={r.rubric.organisation} />
            <Metric label="Language" value={r.rubric.language} />
            <Metric label="Style" value={r.rubric.style} />
            <Metric label="Mechanics" value={r.rubric.mechanics} />
          </div>
          <p className="text-sm text-neutral-200">{r.rubric.comments}</p>
        </CardContent>
      </Card>

      {/* Sectioned feedback boxes */}
      {hasBoxes ? (
        <>
          {/* Content */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                {"Content ("}
                {clamp7(r.sectioned!.content.score7)}
                {"/7)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 text-sm text-neutral-200 space-y-2">
                {r.sectioned!.content.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {r.sectioned!.content.suggestedImprovement && (
                <div className="rounded-xl border border-white/10 bg-neutral-950 p-4 text-sm text-neutral-100">
                  {r.sectioned!.content.suggestedImprovement}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                {"Language ("}
                {clamp7(r.sectioned!.language.score7)}
                {"/7)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="text-sm font-medium text-white">{"Grammar and vocabulary issues:"}</div>
                <ol className="mt-2 list-decimal pl-5 text-sm text-neutral-200 space-y-2">
                  {r.sectioned!.language.grammarIssues.map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="text-sm font-medium text-white">{"Vocabulary enhancement:"}</div>
                <ul className="mt-2 list-disc pl-5 text-sm text-neutral-200 space-y-2">
                  {r.sectioned!.language.vocabEnhancements.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Organisation */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">
                {"Organisation ("}
                {clamp7(r.sectioned!.organisation.score7)}
                {"/7)"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 text-sm text-neutral-200 space-y-2">
                {r.sectioned!.organisation.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
              {r.sectioned!.organisation.transitions && (
                <div className="rounded-xl border border-white/10 bg-neutral-950 p-4 text-sm text-neutral-100">
                  {r.sectioned!.organisation.transitions}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overall suggestions */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Overall Suggestions"}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal pl-5 text-sm text-neutral-200 space-y-2">
                {r.sectioned!.overallSuggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </CardContent>
          </Card>

          {/* Improved paragraph */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Example of improved paragraph"}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words text-sm text-neutral-200">
                {r.sectioned!.improvedParagraph}
              </pre>
            </CardContent>
          </Card>

          {/* Sample essay note */}
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Sample essay"}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-neutral-300">{r.sectioned!.sampleEssay || "Available on request."}</div>
            </CardContent>
          </Card>
        </>
      ) : (
        // Fallback (legacy)
        <>
          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Strengths"}</CardTitle>
            </CardHeader>
            <CardContent>
              {r.strengths?.length ? (
                <ul className="list-disc pl-5 text-sm text-neutral-200 space-y-2">
                  {r.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-neutral-400">{"No strengths found."}</div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Areas to improve"}</CardTitle>
            </CardHeader>
            <CardContent>
              {r.improvements?.length ? (
                <ul className="list-disc pl-5 text-sm text-neutral-200 space-y-2">
                  {r.improvements.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-neutral-400">{"No improvements found."}</div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-5 rounded-2xl border-white/10 bg-neutral-900/70 backdrop-blur shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-white">{"Inline feedback"}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap break-words text-sm text-neutral-200">{r.inlineFeedback}</pre>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function clamp7(n?: number) {
  const v = Math.max(0, Math.min(7, n || 0))
  return Math.round(v * 10) / 10
}
function clamp21(n?: number) {
  const v = Math.max(0, Math.min(21, n || 0))
  return Math.round(v * 10) / 10
}

function Metric({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(10, value || 0))
  return (
    <div className="rounded-xl border border-white/10 p-4 bg-neutral-950/50">
      <div className="text-sm text-neutral-300">{label}</div>
      <div className="mt-2 h-2 w-full rounded-full bg-neutral-800">
        <div className="h-2 rounded-full bg-[#BBDEFB]" style={{ width: `${v * 10}%` }} />
      </div>
      <div className="mt-2 text-sm text-neutral-200">
        {v}
        {"/"}10
      </div>
    </div>
  )
}
