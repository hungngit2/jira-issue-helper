import * as core from '@actions/core'
import { Input } from './utils/input'
import { FetchHelper } from './helper/fetch-helper'
import { jiraIssueTransition, jiraIssueInfo, addJiraComment } from './helper/jira-helper'
import { linearIssueTransition, linearIssueInfo, addLinearComment } from './helper/linear-helper'

const initJiraFetch = () => {
  FetchHelper.authorization = `Basic ${Buffer.from(`${Input.JIRA_USER_EMAIL}:${Input.JIRA_API_TOKEN}`).toString('base64')}`
  FetchHelper.apiServer = `${Input.JIRA_BASE_URL}/rest/api/3`
}

const hasLinearConfig = () => !!Input.LINEAR_API_TOKEN && !!Input.LINEAR_ISSUE_KEY
const hasJiraConfig = () => !!Input.JIRA_BASE_URL && !!Input.JIRA_USER_EMAIL && !!Input.JIRA_API_TOKEN && !!Input.JIRA_ISSUE_KEY

// ISSUE_TRACKER='linear'|'jira'|'' (auto)
// tryLinear: skip only when explicitly set to 'jira', otherwise use if configured
// tryJira:   skip only when explicitly set to 'linear' AND linear succeeded; always available as fallback
const tracker = () => (Input.ISSUE_TRACKER || '').toLowerCase()
const tryLinear = () => tracker() !== 'jira' && hasLinearConfig()
const tryJira = () => tracker() !== 'linear' || hasJiraConfig()

;(async () => {
  console.log('ACTIONS_MODE:', Input.ACTIONS_MODE)
  console.log('ISSUE_TRACKER:', Input.ISSUE_TRACKER || '(auto)')
  console.log('JIRA_ISSUE_KEY:', Input.JIRA_ISSUE_KEY)
  console.log('LINEAR_ISSUE_KEY:', Input.LINEAR_ISSUE_KEY)

  if (!tryLinear() && !tryJira()) {
    console.log('No issue tracker configuration provided. Exiting.')
    return
  }

  if (Input.ACTIONS_MODE === 'Transition') {
    if (tryLinear()) {
      const done = await linearIssueTransition()
      if (done) return
      console.log('Linear transition skipped, falling back to Jira')
    }
    if (tryJira() && hasJiraConfig()) {
      initJiraFetch()
      await jiraIssueTransition()
    }
    return
  }

  if (Input.ACTIONS_MODE === 'IssueInfo') {
    if (tryLinear()) {
      const issueInfo = await linearIssueInfo()
      if (issueInfo) {
        console.log('Issue', issueInfo)
        core.setOutput(Input.OUTPUT_KEY, JSON.stringify(issueInfo))
        return
      }
      console.log('Linear lookup returned nothing, falling back to Jira')
    }
    if (tryJira() && hasJiraConfig()) {
      initJiraFetch()
      const issueInfo = await jiraIssueInfo()
      console.log('Issue', issueInfo)
      core.setOutput(Input.OUTPUT_KEY, JSON.stringify(issueInfo))
    }
    return
  }

  if (Input.ACTIONS_MODE === 'NewComment') {
    const comment = Input.LINEAR_COMMENT_BODY || Input.JIRA_COMMENT_BODY
    if (!comment) {
      console.log('No comment provided for NewComment action.')
      return
    }
    if (tryLinear()) {
      const done = await addLinearComment(Input.LINEAR_ISSUE_KEY, comment)
      if (done) return
      console.log('Linear comment failed, falling back to Jira')
    }
    if (tryJira() && hasJiraConfig()) {
      initJiraFetch()
      await addJiraComment(Input.JIRA_ISSUE_KEY, comment)
    }
  }
})()
