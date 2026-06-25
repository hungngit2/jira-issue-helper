/**
 * Tests for the ISSUE_TRACKER routing logic in index.ts.
 * Mocks all helpers and verifies which tracker is called based on
 * ISSUE_TRACKER, token presence, and fallback behaviour.
 */

// Mocks must be declared before any imports that load the module under test.
const mockLinearIssueInfo = jest.fn()
const mockLinearTransition = jest.fn()
const mockLinearComment = jest.fn()
const mockJiraIssueInfo = jest.fn()
const mockJiraTransition = jest.fn()
const mockJiraComment = jest.fn()
const mockSetOutput = jest.fn()

jest.mock('../helper/linear-helper', () => ({
  linearIssueInfo: mockLinearIssueInfo,
  linearIssueTransition: mockLinearTransition,
  addLinearComment: mockLinearComment,
}))

jest.mock('../helper/jira-helper', () => ({
  jiraIssueInfo: mockJiraIssueInfo,
  jiraIssueTransition: mockJiraTransition,
  addJiraComment: mockJiraComment,
}))

jest.mock('@actions/core', () => ({ setOutput: mockSetOutput }))
jest.mock('@actions/github', () => ({ context: { payload: {} } }))

// FetchHelper static init — no-op is fine for routing tests
jest.mock('../helper/fetch-helper', () => ({
  FetchHelper: { authorization: '', apiServer: '' },
  default: { get: jest.fn(), post: jest.fn() },
}))

// Input is set per describe block via jest.resetModules + jest.mock
let inputMock = {
  ACTIONS_MODE: 'IssueInfo',
  ISSUE_TRACKER: '',
  LINEAR_API_TOKEN: 'lin-token',
  LINEAR_ISSUE_KEY: 'ENG-123',
  LINEAR_COMMENT_BODY: '',
  JIRA_BASE_URL: 'https://test.atlassian.net',
  JIRA_USER_EMAIL: 'user@test.com',
  JIRA_API_TOKEN: 'jira-token',
  JIRA_ISSUE_KEY: 'ABC-123',
  JIRA_TYPE_TRANSITION: {},
  JIRA_COMMENT_BODY: '',
  OUTPUT_KEY: 'ISSUE_INFO',
}

jest.mock('../utils/input', () => ({ get Input() { return inputMock } }))

const runIndex = () => jest.isolateModules(() => require('../index'))

beforeEach(() => {
  jest.resetAllMocks()
  inputMock = {
    ACTIONS_MODE: 'IssueInfo',
    ISSUE_TRACKER: '',
    LINEAR_API_TOKEN: 'lin-token',
    LINEAR_ISSUE_KEY: 'ENG-123',
    LINEAR_COMMENT_BODY: '',
    JIRA_BASE_URL: 'https://test.atlassian.net',
    JIRA_USER_EMAIL: 'user@test.com',
    JIRA_API_TOKEN: 'jira-token',
    JIRA_ISSUE_KEY: 'ABC-123',
    JIRA_TYPE_TRANSITION: {},
    JIRA_COMMENT_BODY: '',
    OUTPUT_KEY: 'ISSUE_INFO',
  }
})

// ---------------------------------------------------------------------------
// IssueInfo mode
// ---------------------------------------------------------------------------

describe('IssueInfo mode', () => {
  it('uses Linear when ISSUE_TRACKER is not set and LINEAR_API_TOKEN is present', async () => {
    mockLinearIssueInfo.mockResolvedValueOnce({ key: 'ENG-123', environments: [] })

    await runIndex()

    expect(mockLinearIssueInfo).toHaveBeenCalled()
    expect(mockJiraIssueInfo).not.toHaveBeenCalled()
    expect(mockSetOutput).toHaveBeenCalledWith('ISSUE_INFO', expect.any(String))
  })

  it('falls back to Jira when Linear returns undefined', async () => {
    mockLinearIssueInfo.mockResolvedValueOnce(undefined)
    mockJiraIssueInfo.mockResolvedValueOnce({ key: 'ABC-123', environments: [] })

    await runIndex()

    expect(mockLinearIssueInfo).toHaveBeenCalled()
    expect(mockJiraIssueInfo).toHaveBeenCalled()
  })

  it('uses Jira directly when ISSUE_TRACKER=jira', async () => {
    inputMock.ISSUE_TRACKER = 'jira'
    mockJiraIssueInfo.mockResolvedValueOnce({ key: 'ABC-123', environments: [] })

    await runIndex()

    expect(mockLinearIssueInfo).not.toHaveBeenCalled()
    expect(mockJiraIssueInfo).toHaveBeenCalled()
  })

  it('uses Linear when ISSUE_TRACKER=linear', async () => {
    inputMock.ISSUE_TRACKER = 'linear'
    mockLinearIssueInfo.mockResolvedValueOnce({ key: 'ENG-123', environments: [] })

    await runIndex()

    expect(mockLinearIssueInfo).toHaveBeenCalled()
    expect(mockJiraIssueInfo).not.toHaveBeenCalled()
  })

  it('skips Linear when LINEAR_API_TOKEN is absent', async () => {
    inputMock.LINEAR_API_TOKEN = ''
    mockJiraIssueInfo.mockResolvedValueOnce({ key: 'ABC-123', environments: [] })

    await runIndex()

    expect(mockLinearIssueInfo).not.toHaveBeenCalled()
    expect(mockJiraIssueInfo).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Transition mode
// ---------------------------------------------------------------------------

describe('Transition mode', () => {
  beforeEach(() => { inputMock.ACTIONS_MODE = 'Transition' })

  it('uses Linear transition when configured, returns without Jira on success', async () => {
    mockLinearTransition.mockResolvedValueOnce(true)

    await runIndex()

    expect(mockLinearTransition).toHaveBeenCalled()
    expect(mockJiraTransition).not.toHaveBeenCalled()
  })

  it('falls back to Jira transition when Linear returns false', async () => {
    mockLinearTransition.mockResolvedValueOnce(false)

    await runIndex()

    expect(mockLinearTransition).toHaveBeenCalled()
    expect(mockJiraTransition).toHaveBeenCalled()
  })

  it('uses Jira directly when ISSUE_TRACKER=jira', async () => {
    inputMock.ISSUE_TRACKER = 'jira'

    await runIndex()

    expect(mockLinearTransition).not.toHaveBeenCalled()
    expect(mockJiraTransition).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// NewComment mode
// ---------------------------------------------------------------------------

describe('NewComment mode', () => {
  beforeEach(() => {
    inputMock.ACTIONS_MODE = 'NewComment'
    inputMock.JIRA_COMMENT_BODY = 'test comment'
  })

  it('uses Linear comment when configured, returns without Jira on success', async () => {
    mockLinearComment.mockResolvedValueOnce(true)

    await runIndex()

    expect(mockLinearComment).toHaveBeenCalledWith('ENG-123', 'test comment')
    expect(mockJiraComment).not.toHaveBeenCalled()
  })

  it('falls back to Jira comment when Linear returns false', async () => {
    mockLinearComment.mockResolvedValueOnce(false)

    await runIndex()

    expect(mockLinearComment).toHaveBeenCalled()
    expect(mockJiraComment).toHaveBeenCalledWith('ABC-123', 'test comment')
  })

  it('prefers LINEAR_COMMENT_BODY over JIRA_COMMENT_BODY', async () => {
    inputMock.LINEAR_COMMENT_BODY = 'linear specific comment'
    mockLinearComment.mockResolvedValueOnce(true)

    await runIndex()

    expect(mockLinearComment).toHaveBeenCalledWith('ENG-123', 'linear specific comment')
  })

  it('exits early when no comment body is provided', async () => {
    inputMock.JIRA_COMMENT_BODY = ''
    inputMock.LINEAR_COMMENT_BODY = ''

    await runIndex()

    expect(mockLinearComment).not.toHaveBeenCalled()
    expect(mockJiraComment).not.toHaveBeenCalled()
  })

  it('uses Jira directly when ISSUE_TRACKER=jira', async () => {
    inputMock.ISSUE_TRACKER = 'jira'

    await runIndex()

    expect(mockLinearComment).not.toHaveBeenCalled()
    expect(mockJiraComment).toHaveBeenCalledWith('ABC-123', 'test comment')
  })
})

// ---------------------------------------------------------------------------
// No configuration
// ---------------------------------------------------------------------------

describe('no configuration', () => {
  it('exits without calling any helper when no tracker is configured', async () => {
    inputMock.LINEAR_API_TOKEN = ''
    inputMock.JIRA_BASE_URL = ''
    inputMock.JIRA_USER_EMAIL = ''
    inputMock.JIRA_API_TOKEN = ''

    await runIndex()

    expect(mockLinearIssueInfo).not.toHaveBeenCalled()
    expect(mockJiraIssueInfo).not.toHaveBeenCalled()
  })
})
