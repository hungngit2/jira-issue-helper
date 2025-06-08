import { Input } from '../utils/input'
import fetch from '../utils/fetch'


interface JiraIssue {
  key: string;
  fields: {
    summary: string
    issuetype: {
      name: string
    }
    status: {
      name: string;
    }
    environment?: {
      content?: TableContent[]
    }
  }
}

interface JiraIssueTransition {
  id: string
  name: string
}

export interface JiraIssueInfo {
  key: string
  url: string
  summary: string
  status?: string
  environments: EnvironmentData[]
}

interface EnvironmentData {
  env: string
  branch: string
  buildPaths: string[]
}

interface TableCell {
  content?: Array<{
    content?: Array<{
      text?: string
    }>
    text?: string
  }>
}

interface TableRow {
  type: string
  content?: TableCell[]
}

interface TableContent {
  type: string;
  content?: TableRow[]
}

export const jiraIssueTransition = async () => {
    const jiraIssue = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}`) as JiraIssue
    if (!jiraIssue || jiraIssue?.key !== Input.JIRA_ISSUE_KEY) {
        console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
        return
    }

    const issueType = jiraIssue.fields.issuetype.name
    const transitionName = Input.JIRA_TYPE_TRANSITION[issueType]
    if (!transitionName) {
        return
    }
    const issueTtransitions = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`) as { transitions: JiraIssueTransition[] }
    console.log(`Transitions for issue ${Input.JIRA_ISSUE_KEY}:`, issueTtransitions)

    const transition = issueTtransitions.transitions.find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase())

    if (!transition) {
        console.log(`Transition "${transitionName}" not found for issue type "${issueType}"`)
        return
    }

    await fetch.post(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`, { body: { transition: { id: transition.id }}})
}

export const jiraIssueInfo = async (): Promise<JiraIssueInfo | undefined> => {
  const jiraIssue = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}`) as JiraIssue

  if (!jiraIssue || jiraIssue?.key !== Input.JIRA_ISSUE_KEY) {
    console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
    return
  }

  const ticketStatus = jiraIssue.fields.status.name
  console.log(`Issue ${Input.JIRA_ISSUE_KEY} status: ${ticketStatus}`)

  const environmentContents = Array.isArray(jiraIssue.fields.environment?.content)
    ? (jiraIssue.fields.environment!.content as TableContent[])
    : []

  if (!environmentContents?.length) {
    console.log(`No environment information found for issue ${Input.JIRA_ISSUE_KEY}`)
    return
  }

  const [envColName, branchColName, buildPathsColName] = Input.JIRA_ENV_COLUMNS.map((col: string) => col.trim())

  const findColumnIndex = (headerTexts: string[], columnName: string): number => {
    return headerTexts.findIndex(text => text === columnName)
  }

  const releaseEnvironments = environmentContents.map((content: TableContent) => {
    if (content.type !== 'table') return null

    const rows = content.content?.filter((row: TableRow) => row.type === 'tableRow') || []
    if (rows.length === 0) return null

    const headerCells = rows[0]?.content || []
    const headerTexts = headerCells.map((cell: TableCell) =>
      cell.content?.[0]?.content?.[0]?.text?.trim() || ''
    )

    if (headerTexts.length < 3) {
      console.log('Table must have at least 3 columns:', headerTexts)
      return null
    }

    const envColIndex = findColumnIndex(headerTexts, envColName)
    const branchColIndex = findColumnIndex(headerTexts, branchColName)
    const buildPathsColIndex = findColumnIndex(headerTexts, buildPathsColName)

    if (envColIndex === -1 || branchColIndex === -1 || buildPathsColIndex === -1) {
      console.log('Missing required columns. Required columns:', [envColName, branchColName, buildPathsColName])
      console.log('Found columns:', headerTexts)
      return null
    }

    const dataRows = rows.slice(1) || []

    const environmentData = dataRows.map((row: TableRow) => {
      const cells = row.content || []
      const env = cells[envColIndex]?.content?.[0]?.content?.[0]?.text || ''
      const branch = cells[branchColIndex]?.content?.[0]?.content?.[0]?.text || ''
      const buildPaths = (cells[buildPathsColIndex]?.content || [])
        .map((cell: TableCell) => cell.content?.[0]?.text || cell.content?.[0]?.content?.[0]?.text)
        .filter(Boolean) as string[]

      return {
        env,
        branch,
        buildPaths
      }
    })

    return environmentData
  }).filter((data): data is EnvironmentData[] => data !== null)
    .reduce((acc: EnvironmentData[], curr) => [...acc, ...curr], [])

  return {
    key: jiraIssue.key,
    url: `${Input.JIRA_BASE_URL}/browse/${jiraIssue.key}`,
    summary: jiraIssue.fields.summary,
    status: ticketStatus,
    environments: releaseEnvironments
  }
}