# Issue Tracker Helper Action

GitHub Action that fetches issue information and environment data from **Linear** or **Jira**, and can transition issues or post comments. When both are configured, Linear is tried first and Jira is used as a fallback.

## Features

- Fetch issue info and parse environment tables from Linear (adhoc-release documents) or Jira (environment field)
- Transition issue status / workflow state
- Post comments
- Automatic Linear → Jira fallback when a Linear lookup returns nothing
- Explicit tracker selection via `ISSUE_TRACKER`

---

## Tracker selection (`ISSUE_TRACKER`)

| Value | Behaviour |
|-------|-----------|
| _(not set)_ | Auto-detect: uses Linear if `LINEAR_API_TOKEN` is set, otherwise Jira |
| `linear` | Try Linear; fall back to Jira if Linear returns nothing |
| `jira` | Jira only, even if `LINEAR_API_TOKEN` is present |

---

## Modes (`ACTIONS_MODE`)

| Mode | Description |
|------|-------------|
| `IssueInfo` | Fetch issue + parse environment table → output JSON |
| `Transition` | Transition the issue to a configured workflow state |
| `NewComment` | Post a comment to the issue |

Auto-detection (when `ACTIONS_MODE` is not set):
- `IssueInfo` if `ISSUE_KEY` (or `JIRA_ISSUE_KEY`/`LINEAR_ISSUE_KEY`) is provided
- `Transition` otherwise

---

## Inputs

### Shared

| Name | Required | Description |
|------|----------|-------------|
| `ISSUE_KEY` | No | Ticket key, e.g. `ABC-1234`. Works for both Jira and Linear (used as `LINEAR_ISSUE_KEY` when the latter is not set). Preferred over `JIRA_ISSUE_KEY` in new workflows. |
| `ISSUE_TRACKER` | No | `linear` or `jira`. Omit for auto-detect. |
| `ACTIONS_MODE` | No | `IssueInfo`, `Transition`, or `NewComment`. |
| `OUTPUT_KEY` | No | Output key name. Default: `JIRA_ISSUE_INFO` |

### Linear

| Name | Required | Description |
|------|----------|-------------|
| `LINEAR_API_TOKEN` | Yes (for Linear) | Linear API token |
| `LINEAR_ISSUE_KEY` | No | Issue identifier, e.g. `ENG-123`. Defaults to `ISSUE_KEY`/`JIRA_ISSUE_KEY` if not set. |
| `LINEAR_COMMENT_BODY` | No | Comment body for `NewComment` mode. Falls back to `JIRA_COMMENT_BODY`. |

### Jira

| Name | Required | Description |
|------|----------|-------------|
| `JIRA_BASE_URL` | Yes (for Jira) | e.g. `https://your-domain.atlassian.net` |
| `JIRA_USER_EMAIL` | Yes (for Jira) | Jira user email |
| `JIRA_API_TOKEN` | Yes (for Jira) | Jira API token ([get one here](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| `JIRA_ISSUE_KEY` | No | Deprecated alias for `ISSUE_KEY`, kept for backward compatibility. Ignored when `ISSUE_KEY` is set. |
| `JIRA_ISSUE_KEY_PATTERN` | No | Regex to extract issue key from PR title. Default: `([A-Z0-9]+)[\s-]?(\d+)` |
| `JIRA_ISSUE_TYPE_TRANSITION` | No | Transition map, e.g. `Story:Code Review;Bug:Code Review` |
| `JIRA_COMMENT_BODY` | No | Comment body for `NewComment` mode |

---

## Output

The action sets an output (default key: `JIRA_ISSUE_INFO`) with the issue info as JSON:

```json
{
  "key": "ENG-123",
  "url": "https://linear.app/team/issue/ENG-123",
  "summary": "Deploy to production",
  "status": "In Progress",
  "environments": [
    {
      "environment": ["staging"],
      "branch": ["feature/xyz"],
      "buildPath": ["build/stg"],
      "pathToUpsert": ["upsert/stg"]
    }
  ]
}
```

All column names are camelCased dynamically from the table headers. Values are always arrays. Multi-value cells (comma- or semicolon-separated) are split into separate rows.

### Linear: environment data source

Environment data is read from issue **documents whose title starts with `Release`**. Create a document via the "Add Document" button on the Linear issue and name it e.g. `Release 1.2.3`. The document should contain a Markdown table:

```markdown
| Environment | Branch      | Build Path  |
|-------------|-------------|-------------|
| production  | main        | build/prod  |
| staging     | dev         | build/stg   |
```

### Jira: environment data source

Environment data is read from the **Environment** field on the Jira issue (ADF table format).

---

## Usage examples

### Linear only

```yaml
- name: Get Linear issue info
  uses: your-org/jira-issue-helper@v1.5
  with:
    ISSUE_TRACKER: linear
    LINEAR_API_TOKEN: ${{ secrets.LINEAR_API_TOKEN }}
    LINEAR_ISSUE_KEY: ${{ github.event.pull_request.title }}
    ACTIONS_MODE: IssueInfo
```

### Jira only

```yaml
- name: Get Jira issue info
  uses: your-org/jira-issue-helper@v1.5
  with:
    ISSUE_TRACKER: jira
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_USER_EMAIL: ${{ secrets.JIRA_USER_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_ISSUE_KEY: ${{ github.event.pull_request.title }}
    ACTIONS_MODE: IssueInfo
```

### Linear with Jira fallback (auto-detect)

```yaml
- name: Get issue info
  uses: your-org/jira-issue-helper@v1.5
  with:
    LINEAR_API_TOKEN: ${{ secrets.LINEAR_API_TOKEN }}
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_USER_EMAIL: ${{ secrets.JIRA_USER_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_ISSUE_KEY: ${{ github.event.pull_request.title }}
    ACTIONS_MODE: IssueInfo
```

### Transition + comment

```yaml
- name: Transition issue
  uses: your-org/jira-issue-helper@v1.5
  with:
    LINEAR_API_TOKEN: ${{ secrets.LINEAR_API_TOKEN }}
    JIRA_ISSUE_KEY: ${{ github.event.pull_request.title }}
    JIRA_ISSUE_TYPE_TRANSITION: "Story:Code Review;Bug:Code Review"
    ACTIONS_MODE: Transition

- name: Post comment
  uses: your-org/jira-issue-helper@v1.5
  with:
    LINEAR_API_TOKEN: ${{ secrets.LINEAR_API_TOKEN }}
    JIRA_ISSUE_KEY: ${{ github.event.pull_request.title }}
    JIRA_COMMENT_BODY: "Deployed to staging ✓"
    ACTIONS_MODE: NewComment
```

---

## Local development

```sh
npm install
npm run build   # bundles to dist/index.js
npm test        # runs Jest tests
npm start       # requires .env file
```

## License
MIT
