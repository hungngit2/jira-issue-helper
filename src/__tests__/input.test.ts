jest.mock('@actions/core', () => ({ getInput: () => '' }))
jest.mock('@actions/github', () => ({ context: { payload: {} } }))

const ENV_KEYS = [
  'JIRA_API_TOKEN', 'JIRA_ISSUE_KEY', 'LINEAR_API_TOKEN', 'LINEAR_ISSUE_KEY', 'ISSUE_TRACKER',
]

const withEnv = (vars: Record<string, string>, fn: () => void) => {
  const saved: Record<string, string | undefined> = {}
  ENV_KEYS.forEach(k => { saved[k] = process.env[k]; delete process.env[k] })
  Object.entries(vars).forEach(([k, v]) => { process.env[k] = v })
  jest.resetModules()
  try {
    fn()
  } finally {
    ENV_KEYS.forEach(k => {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    })
  }
}

describe('Input LINEAR_API_TOKEN fallback to JIRA_API_TOKEN', () => {
  it('does NOT reuse JIRA_API_TOKEN when ISSUE_TRACKER is unset (auto)', () => {
    withEnv({ JIRA_API_TOKEN: 'jira-token', JIRA_ISSUE_KEY: 'ABC-1' }, () => {
      const { Input } = require('../utils/input')
      expect(Input.LINEAR_API_TOKEN).toBe('')
    })
  })

  it('does NOT reuse JIRA_API_TOKEN when ISSUE_TRACKER=jira', () => {
    withEnv({ JIRA_API_TOKEN: 'jira-token', JIRA_ISSUE_KEY: 'ABC-1', ISSUE_TRACKER: 'jira' }, () => {
      const { Input } = require('../utils/input')
      expect(Input.LINEAR_API_TOKEN).toBe('')
    })
  })

  it('reuses JIRA_API_TOKEN as LINEAR_API_TOKEN when ISSUE_TRACKER=linear and no LINEAR_API_TOKEN is set', () => {
    withEnv({ JIRA_API_TOKEN: 'jira-token', JIRA_ISSUE_KEY: 'ABC-1', ISSUE_TRACKER: 'linear' }, () => {
      const { Input } = require('../utils/input')
      expect(Input.LINEAR_API_TOKEN).toBe('jira-token')
    })
  })

  it('prefers an explicit LINEAR_API_TOKEN over the JIRA_API_TOKEN fallback', () => {
    withEnv({ JIRA_API_TOKEN: 'jira-token', JIRA_ISSUE_KEY: 'ABC-1', ISSUE_TRACKER: 'linear', LINEAR_API_TOKEN: 'real-linear-token' }, () => {
      const { Input } = require('../utils/input')
      expect(Input.LINEAR_API_TOKEN).toBe('real-linear-token')
    })
  })

  it('is case-insensitive for ISSUE_TRACKER=Linear', () => {
    withEnv({ JIRA_API_TOKEN: 'jira-token', JIRA_ISSUE_KEY: 'ABC-1', ISSUE_TRACKER: 'Linear' }, () => {
      const { Input } = require('../utils/input')
      expect(Input.LINEAR_API_TOKEN).toBe('jira-token')
    })
  })
})
