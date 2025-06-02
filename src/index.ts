import { Input } from './utils/input'
import { Fetch } from './utils/fetch'
import { jiraIssueTransition } from './helper/jira-helper'

const initFetch = () => {
  Fetch.authorization = Buffer.from(`${Input.JIRA_USER_EMAIL}:${Input.JIRA_API_TOKEN}`).toString('base64')
  Fetch.apiServer = Input.JIRA_BASE_URL
}

(async () => {
  if (!!Input.JIRA_BASE_URL && !!Input.JIRA_USER_EMAIL && !!Input.JIRA_API_TOKEN && !!Input.JIRA_ISSUE_KEY) {
    initFetch()
    await jiraIssueTransition()
  }
})();