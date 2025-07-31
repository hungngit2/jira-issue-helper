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
    type?: string
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
        const joinedText = p.content.map(node => {
          if (node.text) {
            return node.text
          } else if ((node as any).type === 'hardBreak') {
            return '\n'
          }
          return ''
        }).join('')

        if (joinedText) {
          // Split by newlines to handle hard breaks properly
          const lines = joinedText.split('\n')
          acc.push(...lines)
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

export const addJiraComment = async (issueKey: string, comment: string): Promise<void> => {
  try {
    let commentBody: any

    // Check if comment is a JSON string
    try {
      const parsedComment = JSON.parse(comment)
      // If it's valid JSON and has the expected structure, use it as the body
      if (parsedComment && typeof parsedComment === 'object') {
        commentBody = { body: parsedComment }
      } else {
        throw new Error('Not a valid comment structure')
      }
    } catch (parseError) {
      // If it's not valid JSON or doesn't have the right structure, treat as plain text
      commentBody = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: comment
                }
              ]
            }
          ]
        }
      }
    }

    const response = await fetch.post(`/issue/${issueKey}/comment`, { body: commentBody })

    if (response && !response.error) {
      console.log(`Comment added successfully to Jira issue ${issueKey}`)
    } else {
      console.log(`Failed to add comment to Jira issue ${issueKey}:`, response?.error || 'Unknown error')
    }
  } catch (error) {
    console.log(`Error adding comment to Jira issue ${issueKey}:`, error)
  }
}

export const addJiraCommentWithFormatting = async (
  issueKey: string,
  comment: string,
  formatting?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    mentions?: string[]
    links?: Array<{ text: string; url: string }>
  }
): Promise<boolean> => {
  try {
    const content: any[] = []

    // Split comment by lines for paragraph structure
    const lines = comment.split('\n').filter(line => line.trim())

    lines.forEach(line => {
      const paragraphContent: any[] = []

      // Handle mentions
      let processedText = line
      if (formatting?.mentions && formatting.mentions.length > 0) {
        formatting.mentions.forEach(mention => {
          const mentionPattern = new RegExp(`@${mention}`, 'g')
          if (processedText.includes(`@${mention}`)) {
            // For simplicity, we'll add the mention as plain text
            // In a full implementation, you'd need the user's account ID
            processedText = processedText.replace(mentionPattern, `@${mention}`)
          }
        })
      }

      // Handle links
      if (formatting?.links && formatting.links.length > 0) {
        formatting.links.forEach(link => {
          if (processedText.includes(link.text)) {
            processedText = processedText.replace(
              link.text,
              link.text // We'll add link structure below
            )
          }
        })
      }

      // Create text node with formatting
      const textNode: any = {
        type: 'text',
        text: processedText
      }

      // Apply formatting marks
      const marks: any[] = []
      if (formatting?.bold) marks.push({ type: 'strong' })
      if (formatting?.italic) marks.push({ type: 'em' })
      if (formatting?.code) marks.push({ type: 'code' })

      if (marks.length > 0) {
        textNode.marks = marks
      }

      paragraphContent.push(textNode)

      content.push({
        type: 'paragraph',
        content: paragraphContent
      })
    })

    const commentBody = {
      body: {
        type: 'doc',
        version: 1,
        content: content
      }
    }

    const response = await fetch.post(`/issue/${issueKey}/comment`, { body: commentBody })

    if (response && !response.error) {
      console.log(`Formatted comment added successfully to Jira issue ${issueKey}`)
      return true
    } else {
      console.error(`Failed to add formatted comment to Jira issue ${issueKey}:`, response?.error || 'Unknown error')
      return false
    }
  } catch (error) {
    console.error(`Error adding formatted comment to Jira issue ${issueKey}:`, error)
    return false
  }
}

export const addCommentToCurrentIssue = async (comment: string): Promise<void> => {
  return addJiraComment(Input.JIRA_ISSUE_KEY, comment)
}

export const addFormattedCommentToCurrentIssue = async (
  comment: string,
  formatting?: {
    bold?: boolean
    italic?: boolean
    code?: boolean
    mentions?: string[]
    links?: Array<{ text: string; url: string }>
  }
): Promise<boolean> => {
  return addJiraCommentWithFormatting(Input.JIRA_ISSUE_KEY, comment, formatting)
}

export const createJiraCommentStructure = (content: any[]): string => {
  const commentStructure = {
    type: 'doc',
    version: 1,
    content: content
  }
  return JSON.stringify(commentStructure)
}

export const createParagraph = (text: string, marks?: Array<{ type: string }>): any => {
  const textNode: any = {
    type: 'text',
    text: text
  }

  if (marks && marks.length > 0) {
    textNode.marks = marks
  }

  return {
    type: 'paragraph',
    content: [textNode]
  }
}

export const createCodeBlock = (code: string, language?: string): any => {
  return {
    type: 'codeBlock',
    attrs: language ? { language } : {},
    content: [
      {
        type: 'text',
        text: code
      }
    ]
  }
}

export const createBulletList = (items: string[]): any => {
  return {
    type: 'bulletList',
    content: items.map(item => ({
      type: 'listItem',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: item
            }
          ]
        }
      ]
    }))
  }
}