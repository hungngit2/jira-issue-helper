import { Input } from '../utils/input'
import fetch from '../utils/fetch'

export const jiraIssueTransition = async () => {
    const jiraIssue = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}`)

    if (!jiraIssue) {
        console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
        return
    }
    const issueType = jiraIssue.fields.issuetype.name
    const transitionName = Input.JIRA_TYPE_TRANSITION[issueType]
    if (!transitionName) {
        return
    }
    const issueTtransitions = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`)
    console.log(`Transitions for issue ${Input.JIRA_ISSUE_KEY}:`, issueTtransitions)

    const transition = issueTtransitions.transitions.find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase())

    if (!transition) {
        console.log(`Transition "${transitionName}" not found for issue type "${issueType}"`)
        return
    }

    await fetch.post(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`, { body: { transition: { id: transition.id }}})
}
