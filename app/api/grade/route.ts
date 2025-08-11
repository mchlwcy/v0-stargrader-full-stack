export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 0
export const fetchCache = "force-no-store"

import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { generateObject } from "ai"
import { google, createGoogleGenerativeAI } from "@ai-sdk/google"

const SectionedSchema = z.object({
  content: z.object({
    score7: z.number().min(0).max(7).describe("Score out of 7 for Content."),
    bullets: z.array(z.string()).describe("Concise, improvement-focused bullets; reference paragraphs."),
    suggestedImprovement: z.string().optional().describe('One concrete rewrite starting with "Suggested improvement:"'),
  }),
  language: z.object({
    score7: z.number().min(0).max(7).describe("Score out of 7 for Language."),
    grammarIssues: z
      .array(z.string())
      .describe('Numbered issues using "before → after" with (Paragraph N) references.'),
    vocabEnhancements: z.array(z.string()).describe("Bullets proposing precise replacements + context."),
  }),
  organisation: z.object({
    score7: z.number().min(0).max(7).describe("Score out of 7 for Organisation."),
    bullets: z.array(z.string()).describe("Bullets on flow, topic sentences, cohesion, paragraphing."),
    transitions: z.string().optional().describe("A short suggestion with sample transitions, if useful."),
  }),
  overallSuggestions: z.array(z.string()).describe("2–5 actionable items in priority order."),
  improvedParagraph: z.string().describe("A single improved paragraph rewrite of a weak section."),
  sampleEssay: z.string().describe('Exactly "Available on request."'),
})

const ResultSchema = z.object({
  grade: z.string().describe("A short textual grade summary, e.g., 'Excellent', 'Strong', 'Adequate'."),
  // IMPORTANT: Total is 0..21 (sum of 3 x /7 domain scores)
  score: z.number().min(0).max(21).describe("Overall total out of 21 (Content + Language + Organisation)."),
  level: z.string().describe("HKDSE performance level estimate: 5**, 5*, 5, 4, 3, etc."),
  summary: z.string().describe("Keep empty. We don't need an essay summary."),
  strengths: z.array(z.string()).describe("Keep minimal or empty; focus on improvements."),
  improvements: z.array(z.string()).describe("Optional general improvements; specifics go in 'sectioned'."),
  rubric: z.object({
    content: z.number().min(0).max(10),
    organisation: z.number().min(0).max(10),
    language: z.number().min(0).max(10),
    style: z.number().min(0).max(10),
    mechanics: z.number().min(0).max(10),
    comments: z.string(),
  }),
  inlineFeedback: z.string().describe("Markdown feedback. Include the same content as 'sectioned' in readable form."),
  sectioned: SectionedSchema.optional(),
})

const SYSTEM_INSTRUCTIONS = [
  "Role: Veteran HKDSE English marker. Assess essays strictly by DSE criteria for the 4 types (Argumentative, Narrative, Expository, Descriptive).",
  "Primary objective: Give short, surgical feedback focused on improvement only. Do NOT summarize the essay.",
  "Return BOTH: (1) inlineFeedback markdown and (2) a structured 'sectioned' object for UI boxes.",
  "",
  "Scoring rules:",
  "- Provide overall 'score' OUT OF 21 (= content.score7 + language.score7 + organisation.score7).",
  "- Also provide HKDSE 'level'.",
  "- Rubric subscores (content, organisation, language, style, mechanics) are 0-10 and must be mutually consistent.",
  "- Constraint: No rubric sub-score differs by more than 2 points from any other.",
  "",
  "Grammar threshold logic:",
  "- If grammatical mistakes > 20: Focus Language→Grammar. List and correct the problematic sentences; ask student to rewrite those sentences; include corrected versions preserving meaning.",
  "- If grammatical mistakes < 5: Emphasise Language precision and Content depth.",
  "",
  "Essay type handling:",
  "- Detect the essay type (Argumentative, Narrative, Expository, Descriptive) and apply appropriate DSE expectations for content and organisation.",
  "",
  "Tone & style:",
  "- Be concise, specific, and directive. Avoid praise. Provide concrete rewrites and exact wording.",
  "",
  "inlineFeedback format (human-readable, mirrors the following headings):",
  "### *****Content (X/7)*****",
  "- Bullets (3–6) with paragraph references and one 'Suggested improvement:' with exact rewrite.",
  "",
  "### *****Language (X/7)*****",
  "****Grammar and vocabulary issues:***",
  "1. before → after (Paragraph N)",
  "2. ...",
  "***Vocabulary enhancement:***",
  "- Replacement suggestions with rationale.",
  "",
  "### *****Organisation (X/7)*****",
  "- Flow, topic sentences, cohesion, structure. Add transitions if helpful.",
  "",
  "### *****Overall Suggestions:*****",
  "1. 2–5 prioritised actionable items.",
  "",
  "*****Example of improved paragraph:*****",
  "One rewritten paragraph for a weak section.",
  "",
  "### Sample essay",
  "Available on request.",
  "",
  "Additional constraints:",
  "- Use British spelling where applicable.",
  "- Keep 'summary' empty.",
  "- Put all improvements (not praise) up front; be terse but specific.",
].join(" ")

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const text = (formData.get("text") as string) || ""
    const file = formData.get("file") as File | null
    const pastedApiKey = (formData.get("apiKey") as string) || ""

    let essayText = text?.trim() || ""
    let extractionWarning: string | undefined = undefined

    if (!essayText && file) {
      const buf = Buffer.from(await file.arrayBuffer())

      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        const pdfModule = await import("pdf-parse")
        const pdfParse = (pdfModule as any).default ?? (pdfModule as any)
        const parsed = await pdfParse(buf)
        essayText = parsed.text?.trim() || ""
        if (!essayText) {
          extractionWarning =
            "No selectable text found in PDF. If this is a scanned document, please paste your essay text directly for best results."
        }
      } else if (
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.name.toLowerCase().endsWith(".docx")
      ) {
        const mammothModule = await import("mammoth")
        const extractRawText = (mammothModule as any).extractRawText ?? (mammothModule as any).default?.extractRawText
        const out = await extractRawText({ buffer: buf })
        essayText = out.value?.trim() || ""
        if (!essayText) {
          extractionWarning = "DOCX appears empty. Please ensure it contains text, or paste your essay directly."
        }
      } else if (file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")) {
        essayText = buf.toString("utf-8").trim()
      } else {
        return new NextResponse("Unsupported file type. Please upload PDF or DOCX.", { status: 400 })
      }
    }

    if (!essayText) {
      return new NextResponse("No essay text found. Upload a PDF/DOCX with text or paste your essay.", { status: 400 })
    }

    // Choose Google provider: env or per-request API key
    const apiKey = pastedApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || ""
    const provider = apiKey ? createGoogleGenerativeAI({ apiKey }) : google

    const { object } = await generateObject({
      model: provider("models/gemini-1.5-flash"),
      schema: ResultSchema,
      system: SYSTEM_INSTRUCTIONS,
      prompt: [
        "Process:",
        "Step 1: The student uploads essay.",
        "Step 2: AI analyses based on DSE criteria (type-aware).",
        "Step 3: AI gives feedback.",
        "",
        "Important:",
        "- Populate 'sectioned' with accurate /7 scores and details.",
        "- Set 'score' to the total out of 21 (sum of the three /7 domain scores).",
        "- Enforce rubric difference constraint (no sub-score differs by more than 2).",
        "- If grammatical mistakes > 20, prioritise Grammar corrections and request rewrites of those sentences.",
        "- If grammatical mistakes < 5, focus on Language precision and Content depth.",
        "",
        "Essay:",
        essayText,
      ].join("\n"),
    })

    // Enforce 21-point total on server for consistency
    const s = object.sectioned
    const computed21 =
      s &&
      typeof s.content?.score7 === "number" &&
      typeof s.language?.score7 === "number" &&
      typeof s.organisation?.score7 === "number"
        ? Math.max(0, Math.min(21, (s.content.score7 || 0) + (s.language.score7 || 0) + (s.organisation.score7 || 0)))
        : Math.max(0, Math.min(21, Number(object.score ?? 0)))

    const payload = {
      ...object,
      score: computed21,
      summary: "",
      meta: {
        extractionWarning,
        model: "gemini-1.5-flash",
        total21: computed21,
      },
    }

    return NextResponse.json(payload)
  } catch (err: any) {
    console.error("Grade error:", err)
    return new NextResponse(err?.message || "Failed to grade essay.", { status: 500 })
  }
}
