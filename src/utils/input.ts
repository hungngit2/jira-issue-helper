import * as core from '@actions/core'
import * as github from '@actions/github'

export const Input = {
  JIRA_BASE_URL: (process.env.JIRA_BASE_URL || core.getInput('JIRA_BASE_URL') || '').trim(),
  JIRA_USER_EMAIL: (process.env.JIRA_USER_EMAIL || core.getInput('JIRA_USER_EMAIL') || '').trim(),
  JIRA_API_TOKEN: (process.env.JIRA_API_TOKEN || core.getInput('JIRA_API_TOKEN') || '').trim(),
  JIRA_ISSUE_KEY: (() => {
    const pattern = new RegExp(
      process.env.PR_TITLE_PATTERN ||
      core.getInput('PR_TITLE_PATTERN') ||
      '^(?:\\[)?([a-zA-Z0-9]+-[0-9]+)(?:\\])?'
    );
    const title =
      github.context.payload.pull_request?.title ||
      github.context.payload.issue?.title ||
      '';
    return title.match(pattern)?.[1] || ''
  })(),
  JIRA_TYPE_TRANSITION: (() => {
    const transitions = (process.env.JIRA_ISSUE_TYPE_TRANSITION || core.getInput('JIRA_ISSUE_TYPE_TRANSITION') || 'Story:Code Review;Bug:Code Review').trim().split(';')

    const transitionByIssueType: Record<string, string> = {}
    transitions.forEach(transition => {
      const [issueType, transitionName] = transition.split(':')
      if (issueType && transitionName) {
        transitionByIssueType[issueType.trim()] = transitionName.trim()
      }
    }
    )
    return transitionByIssueType
  })()
}
