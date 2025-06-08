import { Input } from './utils/input'
import { Fetch } from './utils/fetch'
import { jiraIssueTransition, jiraIssueInfo } from './helper/jira-helper'
const fs = require('node:fs');

const initFetch = () => {
  Fetch.authorization = `Basic ${Buffer.from(`${Input.JIRA_USER_EMAIL}:${Input.JIRA_API_TOKEN}`).toString('base64')}`
  Fetch.apiServer = `${Input.JIRA_BASE_URL}/rest/api/3`
}

(async () => {
  console.log('ACTIONS_MODE:', Input.ACTIONS_MODE)
  console.log('JIRA_BASE_URL:', Input.JIRA_BASE_URL)
  console.log('JIRA_USER_EMAIL:', Input.JIRA_USER_EMAIL)
  console.log('JIRA_ISSUE_KEY:', Input.JIRA_ISSUE_KEY)
  console.log('JIRA_ISSUE_APPROVED_STATUS:', Input.JIRA_ISSUE_APPROVED_STATUS)
  console.log('JIRA_ENV_COLUMNS:', Input.JIRA_ENV_COLUMNS)
  console.log('JIRA_TYPE_TRANSITION:', Input.JIRA_TYPE_TRANSITION)

  if (!Input.JIRA_BASE_URL && !Input.JIRA_USER_EMAIL && !Input.JIRA_API_TOKEN && !Input.JIRA_ISSUE_KEY) {
    console.log('No JIRA configuration provided. Exiting.')
    return
  }

  initFetch();

  if (Input.ACTIONS_MODE === 'Transition') {
    await jiraIssueTransition();
  }

  if (Input.ACTIONS_MODE === 'ReleaseInfo') {
    const releaseEnvironments = await jiraIssueInfo();
    console.log(`Release environments for issue`, releaseEnvironments)

    if (releaseEnvironments) {
      // Export the release environments
      process.env[Input.RELEASE_ENVIRONMENTS_KEY] = JSON.stringify(releaseEnvironments)
      console.log(`Release environments for issue ${Input.JIRA_ISSUE_KEY}:`, process.env[Input.RELEASE_ENVIRONMENTS_KEY])

      // Export to RELEASE_ENVIRONMENTS.json file
      fs.writeFileSync(
        `${Input.RELEASE_ENVIRONMENTS_KEY}.json`,
        JSON.stringify(releaseEnvironments, null, 2)
      )
    } else {
      console.log(`No release environments found for issue ${Input.JIRA_ISSUE_KEY}. Skipping file export.`)
    }
  }
})();