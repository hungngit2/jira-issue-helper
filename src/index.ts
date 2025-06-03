import { Input } from './utils/input'
import { Fetch } from './utils/fetch'
import { jiraIssueTransition } from './helper/jira-helper'

const initFetch = () => {
  Fetch.authorization = `Basic ${Buffer.from(`${Input.JIRA_USER_EMAIL}:${Input.JIRA_API_TOKEN}`).toString('base64')}`
  Fetch.apiServer = `${Input.JIRA_BASE_URL}/rest/api/3`
}

(async () => {
  console.log('JIRA_BASE_URL:', Input.JIRA_BASE_URL)
  console.log('JIRA_USER_EMAIL:', Input.JIRA_USER_EMAIL)
  console.log('JIRA_ISSUE_KEY:', Input.JIRA_ISSUE_KEY)
  console.log('JIRA_TYPE_TRANSITION:', Input.JIRA_TYPE_TRANSITION)

  if (!!Input.JIRA_BASE_URL && !!Input.JIRA_USER_EMAIL && !!Input.JIRA_API_TOKEN && !!Input.JIRA_ISSUE_KEY) {
    initFetch()
    await jiraIssueTransition()
  }
})();