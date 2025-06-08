import * as core from '@actions/core'
import * as github from '@actions/github'

const getInput = (envKey: string, inputKey?: string, fallback = ''): string =>
  (process.env[envKey] || core.getInput(inputKey || envKey) || fallback).trim()

const getJiraIssueKey = (): string => {
  const jiraIssueKey = getInput('JIRA_ISSUE_KEY')
  if (jiraIssueKey) return jiraIssueKey

  const pattern = new RegExp(
    getInput('PR_TITLE_PATTERN', 'PR_TITLE_PATTERN', '^(?:\\[)?([a-zA-Z0-9]+-[0-9]+)(?:\\])?')
  )
  const title =
    github.context.payload.pull_request?.title ||
    github.context.payload.issue?.title ||
    ''
  return title.match(pattern)?.[1] || ''
}

const getJiraTypeTransition = (): Record<string, string> => {
  const transitions = getInput(
    'JIRA_ISSUE_TYPE_TRANSITION',
    'JIRA_ISSUE_TYPE_TRANSITION',
    'Story:Code Review;Bug:Code Review'
  ).split(';')
  return transitions.reduce<Record<string, string>>((acc, transition) => {
    const [issueType, transitionName] = transition.split(':')
    if (issueType && transitionName) {
      acc[issueType.trim()] = transitionName.trim()
    }
    return acc
  }, {})
}

export const Input = {
  ACTIONS_MODE: getInput('ACTIONS_MODE') || (getInput('JIRA_ISSUE_KEY') ? 'ReleaseInfo' : 'Transition'),
  JIRA_BASE_URL: getInput('JIRA_BASE_URL'),
  JIRA_USER_EMAIL: getInput('JIRA_USER_EMAIL'),
  JIRA_API_TOKEN: getInput('JIRA_API_TOKEN'),
  JIRA_ISSUE_APPROVED_STATUS: getInput('JIRA_ISSUE_APPROVED_STATUS', 'JIRA_ISSUE_APPROVED_STATUS', 'Release Approved'),
  JIRA_ENV_COLUMNS: getInput('JIRA_ENV_COLUMNS', 'JIRA_ENV_COLUMNS', 'Environment,Branch,Path to Build').split(','),
  RELEASE_ENVIRONMENTS_KEY: getInput('RELEASE_ENVIRONMENTS_KEY', 'RELEASE_ENVIRONMENTS_KEY', 'RELEASE_ENVIRONMENTS'),
  JIRA_ISSUE_KEY: getJiraIssueKey(),
  JIRA_TYPE_TRANSITION: getJiraTypeTransition()
}