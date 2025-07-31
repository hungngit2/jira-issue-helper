import * as core from '@actions/core'
import * as github from '@actions/github'

// Constants
const DEFAULT_JIRA_ISSUE_KEY_PATTERN = '([A-Z0-9]+)[\\s-]?(\\d+)'
const DEFAULT_TRANSITIONS = 'Story:Code Review;Bug:Code Review'
const DEFAULT_OUTPUT_KEY = 'JIRA_ISSUE_INFO'

// Types
interface GitHubEvent {
  pull_request?: {
    title?: string
  }
  issue?: {
    title?: string
  }
}

interface TransitionConfig {
  [issueType: string]: string
}

// Utility functions
const getInput = (envKey: string, fallback = ''): string => {
  const value = process.env[envKey] || core.getInput(envKey) || fallback
  return value.trim()
}

const normalizeJiraKey = (text: string): string => {
  if (!text) return ''

  return text
    .replace(/([a-z0-9]+)[\s-]([0-9]+)/i, '$1-$2')  // ABC 5606, ABC-5606 -> ABC-5606
    .replace(/([a-z]+)([0-9]+)/i, '$1-$2')          // abc5606, ABC5606 -> abc-5606, ABC-5606
}

const extractJiraKeyFromText = (text: string, pattern: RegExp): string | null => {
  if (!text) return null

  const normalizedText = normalizeJiraKey(text)
  const match = normalizedText.match(pattern)

  if (match) {
    return `${match[1].toUpperCase()}-${match[2]}`
  }

  return null
}

const getGitHubEvent = (): GitHubEvent => {
  try {
    const eventInput = core.getInput('event')
    if (eventInput) {
      return JSON.parse(eventInput)
    }
  } catch (error) {
    core.warning(`Failed to parse event input: ${error}`)
  }

  // Fallback to context
  return {
    pull_request: {
      title: github.context.payload.pull_request?.title || github.context.payload.issue?.title || ''
    }
  }
}

const tryExtractJiraKey = (text: string, pattern: RegExp): string | null => {
  if (!text) return null

  const extractedKey = extractJiraKeyFromText(text, pattern)
  return extractedKey || null
}

const getJiraIssueKey = (): string => {
  // Get pattern for extraction
  const patternString = getInput('JIRA_ISSUE_KEY_PATTERN', DEFAULT_JIRA_ISSUE_KEY_PATTERN)
  const pattern = new RegExp(patternString, 'i')

  // Check direct input first
  const jiraIssueKey = getInput('JIRA_ISSUE_KEY')
  if (jiraIssueKey) {
    const extractedKey = tryExtractJiraKey(jiraIssueKey, pattern)
    if (extractedKey) {
      return extractedKey
    }

    // Fallback: return normalized key if pattern doesn't match
    return normalizeJiraKey(jiraIssueKey).toUpperCase()
  }

  // Try to extract from GitHub event
  const githubEvent = getGitHubEvent()
  const title = githubEvent.pull_request?.title || ''

  const titleKey = tryExtractJiraKey(title, pattern)
  if (titleKey) {
    return titleKey
  }

  // Try pull-open-message as fallback
  const pullOpenMessage = getInput('pull-open-message')
  const messageKey = tryExtractJiraKey(pullOpenMessage, pattern)
  if (messageKey) {
    return messageKey
  }

  return ''
}

const parseTransitionConfig = (configString: string): TransitionConfig => {
  if (!configString) {
    return {}
  }

  return configString
    .split(';')
    .filter(Boolean)
    .reduce<TransitionConfig>((acc, transition) => {
      const [issueType, transitionName] = transition.split(':').map(s => s.trim())
      if (issueType && transitionName) {
        acc[issueType] = transitionName
      } else {
        core.warning(`Invalid transition config: "${transition}". Expected format: "IssueType:TransitionName"`)
      }
      return acc
    }, {})
}

const getJiraTypeTransition = (): TransitionConfig => {
  const transitionsConfig = getInput('JIRA_ISSUE_TYPE_TRANSITION', DEFAULT_TRANSITIONS)
  return parseTransitionConfig(transitionsConfig)
}

const determineActionsMode = (): string => {
  const explicitMode = getInput('ACTIONS_MODE') // NewComment
  if (explicitMode) {
    return explicitMode
  }

  // Auto-detect based on JIRA_ISSUE_KEY presence
  const jiraIssueKey = getInput('JIRA_ISSUE_KEY')
  return jiraIssueKey ? 'IssueInfo' : 'Transition'
}

// Main Input object
export const Input = {
  ACTIONS_MODE: determineActionsMode(),
  JIRA_BASE_URL: getInput('JIRA_BASE_URL'),
  JIRA_USER_EMAIL: getInput('JIRA_USER_EMAIL'),
  JIRA_API_TOKEN: getInput('JIRA_API_TOKEN'),
  OUTPUT_KEY: getInput('OUTPUT_KEY', DEFAULT_OUTPUT_KEY),
  JIRA_ISSUE_KEY: getJiraIssueKey(),
  JIRA_TYPE_TRANSITION: getJiraTypeTransition(),
  JIRA_COMMENT_BODY: getInput('JIRA_COMMENT_BODY')
}