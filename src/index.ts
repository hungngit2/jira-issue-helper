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

;(async () => {
  console.log('ACTIONS_MODE:', Input.ACTIONS_MODE)
  console.log('JIRA_BASE_URL:', Input.JIRA_BASE_URL)
  console.log('JIRA_USER_EMAIL:', Input.JIRA_USER_EMAIL)
  console.log('JIRA_ISSUE_KEY:', Input.JIRA_ISSUE_KEY)
  console.log('JIRA_TYPE_TRANSITION:', Input.JIRA_TYPE_TRANSITION)
  console.log('LINEAR_ISSUE_KEY:', Input.LINEAR_ISSUE_KEY)

  if (!hasLinearConfig() && !hasJiraConfig()) {
    console.log('No issue tracker configuration provided. Exiting.')
    return
  }

  if (Input.ACTIONS_MODE === 'Transition') {
    if (hasLinearConfig()) {
      await linearIssueTransition()
      return
    }
    initJiraFetch()
    await jiraIssueTransition()
    return
  }

  if (Input.ACTIONS_MODE === 'IssueInfo') {
    if (hasLinearConfig()) {
      const issueInfo = await linearIssueInfo()
      if (issueInfo) {
        console.log('Issue', issueInfo)
        core.setOutput(Input.OUTPUT_KEY, JSON.stringify(issueInfo))
        return
      }
      console.log('Linear lookup returned nothing, falling back to Jira')
    }

    if (!hasJiraConfig()) {
      console.log('No Jira configuration for fallback. Exiting.')
      return
    }
    initJiraFetch()
    const issueInfo = await jiraIssueInfo()
    console.log('Issue', issueInfo)
    core.setOutput(Input.OUTPUT_KEY, JSON.stringify(issueInfo))
    return
  }

  if (Input.ACTIONS_MODE === 'NewComment') {
    if (hasLinearConfig()) {
      const comment = Input.LINEAR_COMMENT_BODY || Input.JIRA_COMMENT_BODY
      if (!comment) {
        console.log('No comment provided for NewComment action.')
        return
      }
      await addLinearComment(Input.LINEAR_ISSUE_KEY, comment)
      return
    }

    if (!hasJiraConfig()) {
      console.log('No Jira configuration for fallback. Exiting.')
      return
    }
    const comment = Input.JIRA_COMMENT_BODY
    if (!comment) {
      console.log('No comment provided for NewComment action.')
      return
    }
    initJiraFetch()
    await addJiraComment(Input.JIRA_ISSUE_KEY, comment)
  }
})()
