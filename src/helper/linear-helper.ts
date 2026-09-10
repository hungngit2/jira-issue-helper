import { Input } from '../utils/input'
import { camelCase } from 'lodash'

const LINEAR_API_URL = 'https://api.linear.app/graphql'

interface EnvironmentData {
  [column: string]: string[];
}

export interface LinearIssueInfo {
  key: string
  url: string
  summary: string
  status?: string
  environments: EnvironmentData[]
}

interface LinearDocument {
  id: string
  title: string
  content: string
}

interface LinearIssue {
  id: string
  identifier: string
  title: string
  url: string
  state: { name: string }
  documents: { nodes: LinearDocument[] }
}

const linearGraphql = async <T>(query: string, variables: Record<string, any> = {}): Promise<T> => {
  console.log(`***POST: ${LINEAR_API_URL}`)
  const res = await fetch(LINEAR_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': Input.LINEAR_API_TOKEN,
    },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Linear API error: ${res.status} ${text}`)
  }
  const json = await res.json() as { data?: T; errors?: any[] }
  if (json.errors?.length) {
    throw new Error(`Linear GraphQL errors: ${JSON.stringify(json.errors)}`)
  }
  return json.data as T
}

const parseTableRow = (line: string): string[] =>
  line.split('|').slice(1, -1).map(cell => cell.trim())

export const parseMarkdownTableRows = (markdown: string): EnvironmentData[] => {
  if (!markdown) return []

  // Use [ \t]* not \s* to avoid matching across blank lines between tables
  const tableRegex = /^(\|.+\|[ \t]*\n\|[-| :]+\|[ \t]*\n(?:\|.+\|[ \t]*\n?)+)/gm
  const tables = markdown.match(tableRegex) || []

  return tables.flatMap(table => {
    const lines = table.trim().split('\n').filter(line => line.trim().startsWith('|'))
    if (lines.length < 3) return []

    if (!/^\|[-| :]+\|$/.test(lines[1].trim())) return []

    const headers = parseTableRow(lines[0]).map(h => camelCase(h))
    // Real tickets pack multiple values into a single cell separated by
    // commas, semicolons, or plain whitespace (e.g. "dev uat", or a
    // whitespace-joined list of upsert paths) - split on all three.
    const splitCell = (val: string): string[] =>
      val.split(/[,;\s]+/).map(v => v.trim()).filter(Boolean)

    const dataRows = lines.slice(2).map(line => {
      const cells = parseTableRow(line)
      const row: EnvironmentData = {}
      headers.forEach((key, idx) => {
        row[key] = splitCell((cells[idx] || '').trim())
      })
      return row
    })

    return dataRows.flatMap(row => {
      const envValues = row.environment || []
      if (envValues.length <= 1) return [row]
      return envValues.map(env => ({ ...row, environment: [env] }))
    })
  })
}

export const linearIssueInfo = async (): Promise<LinearIssueInfo | undefined> => {
  const issueKey = Input.LINEAR_ISSUE_KEY
  if (!issueKey) return undefined

  let data: { issue: LinearIssue }
  try {
    data = await linearGraphql<{ issue: LinearIssue }>(`
      query Issue($id: String!) {
        issue(id: $id) {
          id identifier title url
          state { name }
          documents { nodes { id title content } }
        }
      }
    `, { id: issueKey })
  } catch (err) {
    console.log(`Linear issue ${issueKey} lookup failed:`, err)
    return undefined
  }

  const issue = data?.issue
  if (!issue?.id) {
    console.log(`Linear issue ${issueKey} not found`)
    return undefined
  }

  const ADHOC_RELEASE_DOC_TITLE = /^adhoc[- ]?release/i
  const releaseDocs = (issue.documents?.nodes || [])
    .filter(doc => doc.title && ADHOC_RELEASE_DOC_TITLE.test(doc.title))

  if (releaseDocs.length === 0) {
    console.log(`No adhoc-release documents found for Linear issue ${issueKey}`)
  }

  const environments = releaseDocs.flatMap(doc => parseMarkdownTableRows(doc.content))

  return {
    key: issue.identifier,
    url: issue.url,
    summary: issue.title,
    status: issue.state?.name,
    environments,
  }
}

export const addLinearComment = async (issueIdentifier: string, body: string): Promise<boolean> => {
  try {
    // Resolve identifier to UUID first
    const issueData = await linearGraphql<{ issue: { id: string } }>(`
      query Issue($id: String!) { issue(id: $id) { id } }
    `, { id: issueIdentifier })

    const issueId = issueData?.issue?.id
    if (!issueId) {
      console.log(`Linear issue ${issueIdentifier} not found`)
      return false
    }

    const result = await linearGraphql<{ commentCreate: { success: boolean } }>(`
      mutation AddComment($issueId: String!, $body: String!) {
        commentCreate(input: { issueId: $issueId, body: $body }) {
          success
        }
      }
    `, { issueId, body })

    if (result?.commentCreate?.success) {
      console.log(`Comment added to Linear issue ${issueIdentifier}`)
      return true
    }
    console.log(`Failed to add comment to Linear issue ${issueIdentifier}`)
    return false
  } catch (err) {
    console.log(`Error adding comment to Linear issue ${issueIdentifier}:`, err)
    return false
  }
}

export const linearIssueTransition = async (): Promise<boolean> => {
  const issueKey = Input.LINEAR_ISSUE_KEY
  if (!issueKey) return false

  const issueData = await linearGraphql<{ issue: { id: string; state: { name: string } } }>(`
    query Issue($id: String!) { issue(id: $id) { id state { name } } }
  `, { id: issueKey })

  const issue = issueData?.issue
  if (!issue?.id) {
    console.log(`Linear issue ${issueKey} not found`)
    return false
  }

  const transitionName = Input.JIRA_TYPE_TRANSITION[issue.state?.name]
  if (!transitionName) {
    console.log(`No transition configured for Linear state "${issue.state?.name}"`)
    return false
  }

  const statesData = await linearGraphql<{ workflowStates: { nodes: Array<{ id: string; name: string }> } }>(`
    query States($name: String!) {
      workflowStates(filter: { name: { eq: $name } }) {
        nodes { id name }
      }
    }
  `, { name: transitionName })

  const targetState = statesData?.workflowStates?.nodes?.[0]
  if (!targetState) {
    console.log(`Linear workflow state "${transitionName}" not found`)
    return false
  }

  await linearGraphql(`
    mutation Transition($id: String!, $stateId: String!) {
      issueUpdate(id: $id, input: { stateId: $stateId }) { success }
    }
  `, { id: issue.id, stateId: targetState.id })

  console.log(`Linear issue ${issueKey} transitioned to "${targetState.name}"`)
  return true
}
