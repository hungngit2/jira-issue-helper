import { Input } from '../utils/input'
import fetch from '../utils/fetch'

export const jiraIssueTransition = async () => {
    const jiraIssue = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}`)

    if (!jiraIssue) {
        throw new Error(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
    }
    const issueType = jiraIssue.fields.issuetype.name
    const transitionName = Input.JIRA_TYPE_TRANSITION[issueType]
    if (!transitionName) {
        return
    }
    const issueTtransitions = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`)
    const transition = issueTtransitions.transitions.find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase())

    if (!transition) {
        throw new Error(`Transition "${transitionName}" not found for issue type "${issueType}"`)
    }

    await fetch.post(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`, { body: { transition: { id: transition.id }}})
}
