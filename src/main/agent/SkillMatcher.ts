// ═══════════════════════════════════════════════════════════════════
// Lumiq — SkillMatcher
// Context-aware automatic skill activation.
// Scores every imported skill against the user's message + context,
// returns the top matching skills whose prompts get injected into
// the system prompt automatically — no manual /call needed.
// ═══════════════════════════════════════════════════════════════════

import type { CustomSkill, Message } from '@shared/types'
import { listSkills } from '../db/skills'

interface ScoredSkill {
  skill: CustomSkill
  score: number
  reasons: string[]
}

/** Maximum number of skills to auto-activate per message */
const MAX_AUTO_SKILLS = 3

/** Minimum relevance score to activate (0–1 scale) */
const ACTIVATION_THRESHOLD = 0.25

/**
 * Given user's current message and recent conversation context,
 * returns the most relevant skills sorted by relevance score.
 */
export function matchSkills(
  userMessage: string,
  recentMessages: Message[],
  workspacePath?: string
): ScoredSkill[] {
  const skills = listSkills()
  if (skills.length === 0) return []

  // Build context string from recent messages (last 6 user + assistant messages)
  const contextWindow = recentMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .slice(-6)
    .map(m => m.content)
    .join(' ')

  const fullContext = `${userMessage} ${contextWindow}`.toLowerCase()

  const scored: ScoredSkill[] = skills.map(skill => {
    const reasons: string[] = []
    let score = 0

    // ── 1. Name matching (highest weight) ──
    const nameTokens = tokenize(skill.name)
    const nameHits = nameTokens.filter(t => fullContext.includes(t))
    if (nameHits.length > 0) {
      const nameScore = (nameHits.length / nameTokens.length) * 0.4
      score += nameScore
      reasons.push(`name match: ${nameHits.join(', ')}`)
    }

    // Direct /name invocation check (exact match)
    if (userMessage.trim().toLowerCase().startsWith(`/${skill.name.toLowerCase()}`)) {
      score += 0.5
      reasons.push('direct invocation')
    }

    // ── 2. Description matching ──
    if (skill.description) {
      const descTokens = tokenize(skill.description)
      const descHits = descTokens.filter(t => fullContext.includes(t))
      if (descHits.length > 0) {
        const descScore = (descHits.length / descTokens.length) * 0.25
        score += descScore
        reasons.push(`description match: ${descHits.length}/${descTokens.length}`)
      }
    }

    // ── 3. Prompt template keyword extraction ──
    // Extract meaningful keywords from the prompt template itself
    const promptKeywords = extractKeywords(skill.promptTemplate)
    const promptHits = promptKeywords.filter(k => fullContext.includes(k))
    if (promptHits.length > 0) {
      const promptScore = Math.min((promptHits.length / promptKeywords.length) * 0.2, 0.2)
      score += promptScore
      reasons.push(`prompt keywords: ${promptHits.length}`)
    }

    // ── 4. Tool alignment ──
    // If user mentions tools that align with the skill's allowed tools
    if (skill.allowedTools && skill.allowedTools.length > 0) {
      const toolHits = skill.allowedTools.filter(tool =>
        fullContext.includes(tool.toLowerCase())
      )
      if (toolHits.length > 0) {
        score += 0.1
        reasons.push(`tool alignment: ${toolHits.join(', ')}`)
      }
    }

    // ── 5. Workspace context bonus ──
    // If workspace path contains terms matching skill name (e.g., "react-app" → react skill)
    if (workspacePath) {
      const wpLower = workspacePath.toLowerCase()
      if (nameTokens.some(t => t.length > 3 && wpLower.includes(t))) {
        score += 0.05
        reasons.push('workspace path match')
      }
    }

    return { skill, score: Math.min(score, 1), reasons }
  })

  // Filter and sort
  return scored
    .filter(s => s.score >= ACTIVATION_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_AUTO_SKILLS)
}

/**
 * Builds the skill injection block for the system prompt.
 * Returns empty string if no skills match.
 */
export function buildSkillInjection(
  userMessage: string,
  recentMessages: Message[],
  workspacePath?: string
): string {
  const matched = matchSkills(userMessage, recentMessages, workspacePath)
  if (matched.length === 0) return ''

  const blocks = matched.map(({ skill, score }) => {
    // Replace {{input}} placeholder with actual user message
    const resolvedPrompt = skill.promptTemplate.replace(/\{\{input\}\}/g, userMessage)
    return `── SKILL: ${skill.name} (relevance: ${Math.round(score * 100)}%) ──\n${resolvedPrompt}`
  })

  return `\n\n═══ AUTO-ACTIVATED SKILLS ═══\nThe following skills have been automatically activated based on your current task context. Follow their instructions where relevant.\n\n${blocks.join('\n\n')}\n═══ END SKILLS ═══`
}

// ── Helpers ──────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'this', 'that',
  'these', 'those', 'it', 'its', 'my', 'your', 'his', 'her', 'our',
  'their', 'what', 'which', 'who', 'whom', 'when', 'where', 'why',
  'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'if', 'or', 'and',
  'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'up', 'about', 'into', 'through', 'during', 'before', 'after',
  'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again',
  'use', 'using', 'used', 'make', 'get', 'set', 'add', 'new'
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(t => t.length > 2 && !STOP_WORDS.has(t))
}

function extractKeywords(text: string): string[] {
  // Extract unique meaningful words from prompt templates
  const tokens = tokenize(text)
  const unique = [...new Set(tokens)]
  // Take only the top N most "specific" words (longer = more specific)
  return unique
    .sort((a, b) => b.length - a.length)
    .slice(0, 20)
}
