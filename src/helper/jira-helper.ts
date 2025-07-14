import { Input } from '../utils/input'
import fetch from '../utils/fetch'
import { camelCase } from 'lodash'

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
  [column: string]: string[];
}

interface Paragraph {
  text?: string
  content?: Array<{
    text?: string
  }>
}

interface TableCell {
  content?: Paragraph[]
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
    if (!jiraIssue) {
        console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
        return
    }

    const issueType = jiraIssue.fields.issuetype.name
    const transitionName = Input.JIRA_TYPE_TRANSITION[issueType]
    if (!transitionName) {
        console.log(`No transition configured for issue type "${issueType}"`)
        return
    }
    const issueTtransitions = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`) as { transitions: JiraIssueTransition[] }

    const transition = issueTtransitions.transitions.find((t: any) => t.name.toLowerCase() === transitionName.toLowerCase())

    if (!transition) {
        console.log(`Transition "${transitionName}" not found for issue ${Input.JIRA_ISSUE_KEY}.`)
        console.log(`Available transitions: ${issueTtransitions.transitions.map(t => t.name).join(', ')}`)
        return
    }

    await fetch.post(`/issue/${Input.JIRA_ISSUE_KEY}/transitions`, { body: { transition: { id: transition.id }}})
    console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} has been transitioned to "${transition.name}"`)
}

const extractTextFromParagraphs = (paragraphs: Paragraph[] = []): string[] => {
  return paragraphs
    .reduce((acc: string[], p: Paragraph) => {
      if (p.text) {
        acc.push(p.text)
      } else if (p.content) {
        const joinedText = p.content.map(node => node.text || '').join('')
        if (joinedText) {
          acc.push(joinedText)
        }
      }
      return acc
    }, [])
    .map((text: string) => text.trim())
    .filter(Boolean)
}

export const parseEnvironmentDataFromTable = (content: TableContent): EnvironmentData[] | null => {
  if (content.type !== 'table' || !content.content) return null

  const rows = content.content.filter((row: TableRow) => row.type === 'tableRow')
  if (rows.length < 2) { // Header + at least one data row
    return null
  }

  const headerCells = rows[0]?.content || []
  const headerTexts = headerCells.map((cell: TableCell) => (extractTextFromParagraphs(cell.content)[0] || '').trim())
  const headerKeys = headerTexts.map(text => camelCase(text))

  const dataRows = rows.slice(1)
  return dataRows.map((row: TableRow) => {
    const cells = row.content || []
    const rowData: Record<string, string[]> = {}
    headerKeys.forEach((key, idx) => {
      rowData[key] = extractTextFromParagraphs(cells[idx]?.content)
    })
    return rowData
  })
}

export const jiraIssueInfo = async (): Promise<JiraIssueInfo | undefined> => {
  const jiraIssue = await fetch.get(`/issue/${Input.JIRA_ISSUE_KEY}`) as JiraIssue

  if (!jiraIssue.key) {
    console.log(`Jira issue ${Input.JIRA_ISSUE_KEY} not found`)
    return
  }

  const environmentContents = jiraIssue.fields.environment?.content || []

  if (environmentContents.length === 0) {
    console.log(`No environment information found for issue ${Input.JIRA_ISSUE_KEY}`)
  }

  const releaseEnvironments = environmentContents
    .map(parseEnvironmentDataFromTable)
    .filter((data): data is EnvironmentData[] => data !== null)
    .reduce((acc: EnvironmentData[], curr) => [...acc, ...curr], [])

  return {
    key: jiraIssue.key,
    url: `${Input.JIRA_BASE_URL}/browse/${jiraIssue.key}`,
    summary: jiraIssue.fields.summary,
    status: jiraIssue.fields.status.name,
    environments: releaseEnvironments
  }
}