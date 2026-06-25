import {
  parseEnvironmentDataFromTable,
  jiraIssueInfo,
  addJiraComment,
  jiraIssueTransition,
} from '../helper/jira-helper'

jest.mock('../utils/input', () => ({
  Input: {
    JIRA_ISSUE_KEY: 'ABC-123',
    JIRA_BASE_URL: 'https://test.atlassian.net',
    JIRA_USER_EMAIL: 'user@test.com',
    JIRA_API_TOKEN: 'token',
    JIRA_TYPE_TRANSITION: { Story: 'Code Review' },
  }
}))

// fetchHelper uses FetchHelper static, mock at the module level
jest.mock('../helper/fetch-helper', () => ({
  FetchHelper: { authorization: '', apiServer: '' },
  default: {
    get: jest.fn(),
    post: jest.fn(),
  }
}))

import fetchHelper from '../helper/fetch-helper'
const mockGet = fetchHelper.get as jest.Mock
const mockPost = fetchHelper.post as jest.Mock

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
})

// ---------------------------------------------------------------------------
// parseEnvironmentDataFromTable
// ---------------------------------------------------------------------------

describe('parseEnvironmentDataFromTable', () => {
  const makeTable = (headers: string[], rows: string[][]) => ({
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headers.map(h => ({
          content: [{ content: [{ type: 'text', text: h }] }]
        }))
      },
      ...rows.map(cells => ({
        type: 'tableRow',
        content: cells.map(c => ({
          content: [{ content: [{ type: 'text', text: c }] }]
        }))
      }))
    ]
  })

  it('parses a simple table', () => {
    const table = makeTable(
      ['Environment', 'Branch'],
      [['production', 'main'], ['staging', 'dev']]
    )
    const result = parseEnvironmentDataFromTable(table as any)
    expect(result).toHaveLength(2)
    expect(result![0]).toMatchObject({ environment: ['production'], branch: ['main'] })
    expect(result![1]).toMatchObject({ environment: ['staging'], branch: ['dev'] })
  })

  it('splits comma-separated environments into separate rows', () => {
    const table = makeTable(
      ['Environment', 'Branch'],
      [['production, staging', 'main']]
    )
    const result = parseEnvironmentDataFromTable(table as any)
    expect(result).toHaveLength(2)
    expect(result![0].environment).toEqual(['production'])
    expect(result![1].environment).toEqual(['staging'])
  })

  it('splits semicolon-separated environments into separate rows', () => {
    const table = makeTable(
      ['Environment', 'Branch'],
      [['prod; stg', 'main']]
    )
    const result = parseEnvironmentDataFromTable(table as any)
    expect(result).toHaveLength(2)
  })

  it('camelCases column headers', () => {
    const table = makeTable(
      ['Path To Build', 'Other Info'],
      [['build/prod', 'value']]
    )
    const result = parseEnvironmentDataFromTable(table as any)
    expect(result![0]).toHaveProperty('pathToBuild')
    expect(result![0]).toHaveProperty('otherInfo')
  })

  it('returns null for non-table content', () => {
    expect(parseEnvironmentDataFromTable({ type: 'paragraph' } as any)).toBeNull()
  })

  it('returns null when fewer than 2 rows', () => {
    const table = makeTable(['Environment'], [])
    expect(parseEnvironmentDataFromTable(table as any)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// jiraIssueInfo
// ---------------------------------------------------------------------------

describe('jiraIssueInfo', () => {
  const makeAdfTable = (headers: string[], rows: string[][]) => ({
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: headers.map(h => ({ content: [{ content: [{ type: 'text', text: h }] }] }))
      },
      ...rows.map(cells => ({
        type: 'tableRow',
        content: cells.map(c => ({ content: [{ content: [{ type: 'text', text: c }] }] }))
      }))
    ]
  })

  it('returns issue info with parsed environments', async () => {
    mockGet.mockResolvedValueOnce({
      key: 'ABC-123',
      fields: {
        summary: 'Test issue',
        status: { name: 'In Progress' },
        environment: {
          content: [makeAdfTable(['Environment', 'Branch'], [['production', 'main']])]
        }
      }
    })

    const result = await jiraIssueInfo()

    expect(result!.key).toBe('ABC-123')
    expect(result!.summary).toBe('Test issue')
    expect(result!.status).toBe('In Progress')
    expect(result!.environments).toHaveLength(1)
    expect(result!.environments[0].environment).toEqual(['production'])
  })

  it('returns empty environments when no environment field', async () => {
    mockGet.mockResolvedValueOnce({
      key: 'ABC-123',
      fields: { summary: 'Test', status: { name: 'Open' }, environment: undefined }
    })

    const result = await jiraIssueInfo()
    expect(result!.environments).toHaveLength(0)
  })

  it('returns undefined when issue key is missing in response', async () => {
    mockGet.mockResolvedValueOnce({ fields: {} })
    expect(await jiraIssueInfo()).toBeUndefined()
  })

  it('constructs the correct browse URL', async () => {
    mockGet.mockResolvedValueOnce({
      key: 'ABC-123',
      fields: { summary: 'Test', status: { name: 'Open' }, environment: undefined }
    })

    const result = await jiraIssueInfo()
    expect(result!.url).toBe('https://test.atlassian.net/browse/ABC-123')
  })
})

// ---------------------------------------------------------------------------
// addJiraComment
// ---------------------------------------------------------------------------

describe('addJiraComment', () => {
  it('posts a plain text comment', async () => {
    mockPost.mockResolvedValueOnce({ id: 'comment-1' })

    await addJiraComment('ABC-123', 'hello world')

    expect(mockPost).toHaveBeenCalledWith(
      '/issue/ABC-123/comment',
      expect.objectContaining({
        body: expect.objectContaining({ body: expect.objectContaining({ type: 'doc' }) })
      })
    )
  })

  it('posts a pre-built ADF JSON comment', async () => {
    mockPost.mockResolvedValueOnce({ id: 'comment-2' })

    const adf = { type: 'doc', version: 1, content: [] }
    await addJiraComment('ABC-123', JSON.stringify(adf))

    const [, params] = mockPost.mock.calls[0]
    expect(params.body.body).toEqual(adf)
  })

  it('does not throw on post failure', async () => {
    mockPost.mockResolvedValueOnce({ error: 'Forbidden' })
    await expect(addJiraComment('ABC-123', 'hi')).resolves.not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// jiraIssueTransition
// ---------------------------------------------------------------------------

describe('jiraIssueTransition', () => {
  it('transitions the issue to the configured state', async () => {
    mockGet
      .mockResolvedValueOnce({ fields: { issuetype: { name: 'Story' } } })
      .mockResolvedValueOnce({ transitions: [{ id: 't1', name: 'Code Review' }] })
    mockPost.mockResolvedValueOnce(null)

    await jiraIssueTransition()

    expect(mockPost).toHaveBeenCalledWith(
      '/issue/ABC-123/transitions',
      expect.objectContaining({ body: { transition: { id: 't1' } } })
    )
  })

  it('does nothing when no transition is configured for the issue type', async () => {
    mockGet.mockResolvedValueOnce({ fields: { issuetype: { name: 'Epic' } } })

    await jiraIssueTransition()

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('does nothing when the target transition is not available on the issue', async () => {
    mockGet
      .mockResolvedValueOnce({ fields: { issuetype: { name: 'Story' } } })
      .mockResolvedValueOnce({ transitions: [{ id: 't2', name: 'Done' }] })

    await jiraIssueTransition()

    expect(mockPost).not.toHaveBeenCalled()
  })

  it('does nothing when issue is not found', async () => {
    mockGet.mockResolvedValueOnce(null)

    await jiraIssueTransition()

    expect(mockPost).not.toHaveBeenCalled()
  })
})
