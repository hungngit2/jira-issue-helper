import * as core from '@actions/core'
import { Input } from './utils/input'
import { Fetch } from './utils/fetch'
import { jiraIssueTransition, jiraIssueInfo } from './helper/jira-helper'

const initFetch = () => {
  Fetch.authorization = `Basic ${Buffer.from(`${Input.JIRA_USER_EMAIL}:${Input.JIRA_API_TOKEN}`).toString('base64')}`
  Fetch.apiServer = `${Input.JIRA_BASE_URL}/rest/api/3`
}

(async () => {
  console.log('ACTIONS_MODE:', Input.ACTIONS_MODE)
  console.log('JIRA_BASE_URL:', Input.JIRA_BASE_URL)
  console.log('JIRA_USER_EMAIL:', Input.JIRA_USER_EMAIL)
  console.log('JIRA_ISSUE_KEY:', Input.JIRA_ISSUE_KEY)
  console.log('JIRA_TYPE_TRANSITION:', Input.JIRA_TYPE_TRANSITION)

  if (!Input.JIRA_BASE_URL && !Input.JIRA_USER_EMAIL && !Input.JIRA_API_TOKEN && !Input.JIRA_ISSUE_KEY) {
    console.log('No JIRA configuration provided. Exiting.')
    return
  }

  initFetch();

  if (Input.ACTIONS_MODE === 'Transition') {
    await jiraIssueTransition();
  }

  if (Input.ACTIONS_MODE === 'IssueInfo') {
    const issueInfo = await jiraIssueInfo();
    console.log(`Issue`, issueInfo)

    // Export the release environments
    core.setOutput(Input.OUTPUT_KEY, JSON.stringify(issueInfo));
  }
})();