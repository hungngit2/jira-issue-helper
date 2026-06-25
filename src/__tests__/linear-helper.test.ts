import { parseMarkdownTableRows, linearIssueInfo, addLinearComment, linearIssueTransition } from '../helper/linear-helper'

jest.mock('../utils/input', () => ({
  Input: {
    LINEAR_API_TOKEN: 'test-token',
    LINEAR_ISSUE_KEY: 'ENG-123',
    LINEAR_COMMENT_BODY: '',
    JIRA_TYPE_TRANSITION: { 'In Progress': 'Code Review' },
  }
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

const ok = (data: object) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve(data),
  text: () => Promise.resolve(''),
})

beforeEach(() => mockFetch.mockReset())

// ---------------------------------------------------------------------------
// parseMarkdownTableRows
// ---------------------------------------------------------------------------

describe('parseMarkdownTableRows', () => {
  it('parses a basic table', () => {
    const md = `
| Environment | Branch | Build Path |
|-------------|--------|------------|
| production  | main   | build/prod |
| staging     | dev    | build/stg  |
`
    const result = parseMarkdownTableRows(md)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ environment: ['production'], branch: ['main'], buildPath: ['build/prod'] })
    expect(result[1]).toEqual({ environment: ['staging'], branch: ['dev'], buildPath: ['build/stg'] })
  })

  it('splits comma-separated environment values into separate rows', () => {
    const md = `
| Environment      | Branch |
|------------------|--------|
| production, stg  | main   |
`
    const result = parseMarkdownTableRows(md)
    expect(result).toHaveLength(2)
    expect(result[0].environment).toEqual(['production'])
    expect(result[1].environment).toEqual(['stg'])
    expect(result[0].branch).toEqual(['main'])
  })

  it('splits semicolon-separated environment values into separate rows', () => {
    const md = `
| Environment   | Branch |
|---------------|--------|
| prod; staging | main   |
`
    const result = parseMarkdownTableRows(md)
    expect(result).toHaveLength(2)
    expect(result[0].environment).toEqual(['prod'])
    expect(result[1].environment).toEqual(['staging'])
  })

  it('camelCases multi-word column headers', () => {
    const md = `
| Deploy Environment | Path To Build |
|--------------------|---------------|
| production         | build/prod    |
`
    const result = parseMarkdownTableRows(md)
    expect(result[0]).toHaveProperty('deployEnvironment')
    expect(result[0]).toHaveProperty('pathToBuild')
  })

  it('parses multiple tables from a single document', () => {
    const md = `
| Environment | Branch |
|-------------|--------|
| production  | main   |

| Service | Version |
|---------|---------|
| api     | 1.2.3   |
`
    expect(parseMarkdownTableRows(md)).toHaveLength(2)
  })

  it('returns empty array for empty string', () => {
    expect(parseMarkdownTableRows('')).toEqual([])
  })

  it('returns empty array when no tables present', () => {
    expect(parseMarkdownTableRows('Just some plain text.')).toEqual([])
  })

  it('ignores table with only header and separator', () => {
    const md = `
| Environment | Branch |
|-------------|--------|
`
    expect(parseMarkdownTableRows(md)).toEqual([])
  })

  it('handles empty cells gracefully', () => {
    const md = `
| Environment | Branch |
|-------------|--------|
| production  |        |
`
    expect(parseMarkdownTableRows(md)[0].branch).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// linearIssueInfo
// ---------------------------------------------------------------------------

describe('linearIssueInfo', () => {
  const releaseDoc = {
    id: 'doc-1',
    title: 'Release 1.2.3',
    content: `
| Environment | Branch | Build Path |
|-------------|--------|------------|
| production  | main   | build/prod |
| staging     | dev    | build/stg  |
`
  }

  const issueResponse = {
    data: {
      issue: {
        id: 'uuid-eng-123',
        identifier: 'ENG-123',
        title: 'Deploy to production',
        url: 'https://linear.app/team/issue/ENG-123',
        state: { name: 'In Progress' },
        documents: { nodes: [releaseDoc] }
      }
    }
  }

  it('returns issue info with environments from Release documents', async () => {
    mockFetch.mockResolvedValueOnce(ok(issueResponse))

    const result = await linearIssueInfo()

    expect(result).not.toBeUndefined()
    expect(result!.key).toBe('ENG-123')
    expect(result!.summary).toBe('Deploy to production')
    expect(result!.status).toBe('In Progress')
    expect(result!.environments).toHaveLength(2)
    expect(result!.environments[0].environment).toEqual(['production'])
    expect(result!.environments[1].environment).toEqual(['staging'])
  })

  it('ignores documents not starting with "Release"', async () => {
    const response = {
      data: {
        issue: {
          ...issueResponse.data.issue,
          documents: {
            nodes: [
              { id: 'doc-2', title: 'Notes', content: '| Environment |\n|---|\n| production |' },
              releaseDoc,
            ]
          }
        }
      }
    }
    mockFetch.mockResolvedValueOnce(ok(response))

    const result = await linearIssueInfo()
    expect(result!.environments).toHaveLength(2)
  })

  it('returns empty environments when no Release documents exist', async () => {
    const response = {
      data: {
        issue: {
          ...issueResponse.data.issue,
          documents: { nodes: [{ id: 'doc-3', title: 'Meeting Notes', content: 'content' }] }
        }
      }
    }
    mockFetch.mockResolvedValueOnce(ok(response))

    expect((await linearIssueInfo())!.environments).toHaveLength(0)
  })

  it('returns undefined when issue is not found', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { issue: null } }))
    expect(await linearIssueInfo()).toBeUndefined()
  })

  it('returns undefined on fetch error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    expect(await linearIssueInfo()).toBeUndefined()
  })

  it('sends the Authorization header with the API token', async () => {
    mockFetch.mockResolvedValueOnce(ok(issueResponse))

    await linearIssueInfo()

    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['Authorization']).toBe('test-token')
  })
})

// ---------------------------------------------------------------------------
// addLinearComment
// ---------------------------------------------------------------------------

describe('addLinearComment', () => {
  it('resolves UUID then creates comment, returns true on success', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ data: { issue: { id: 'uuid-eng-123' } } }))
      .mockResolvedValueOnce(ok({ data: { commentCreate: { success: true } } }))

    const result = await addLinearComment('ENG-123', 'hello from tests')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    const commentBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(commentBody.variables).toMatchObject({ issueId: 'uuid-eng-123', body: 'hello from tests' })
  })

  it('returns false when issue UUID cannot be resolved', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { issue: null } }))

    expect(await addLinearComment('ENG-999', 'hello')).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns false when commentCreate fails', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ data: { issue: { id: 'uuid-eng-123' } } }))
      .mockResolvedValueOnce(ok({ data: { commentCreate: { success: false } } }))

    expect(await addLinearComment('ENG-123', 'hello')).toBe(false)
  })

  it('returns false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('timeout'))
    expect(await addLinearComment('ENG-123', 'hello')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// linearIssueTransition
// ---------------------------------------------------------------------------

describe('linearIssueTransition', () => {
  it('transitions the issue to the mapped state, returns true', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ data: { issue: { id: 'uuid-eng-123', state: { name: 'In Progress' } } } }))
      .mockResolvedValueOnce(ok({ data: { workflowStates: { nodes: [{ id: 'state-456', name: 'Code Review' }] } } }))
      .mockResolvedValueOnce(ok({ data: { issueUpdate: { success: true } } }))

    const result = await linearIssueTransition()

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const updateBody = JSON.parse(mockFetch.mock.calls[2][1].body)
    expect(updateBody.variables).toMatchObject({ id: 'uuid-eng-123', stateId: 'state-456' })
  })

  it('returns false when no transition is configured for the current state', async () => {
    mockFetch.mockResolvedValueOnce(ok({
      data: { issue: { id: 'uuid-eng-123', state: { name: 'Done' } } }
    }))

    expect(await linearIssueTransition()).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('returns false when target workflow state is not found', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ data: { issue: { id: 'uuid-eng-123', state: { name: 'In Progress' } } } }))
      .mockResolvedValueOnce(ok({ data: { workflowStates: { nodes: [] } } }))

    expect(await linearIssueTransition()).toBe(false)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('returns false when issue is not found', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { issue: null } }))
    expect(await linearIssueTransition()).toBe(false)
  })
})
