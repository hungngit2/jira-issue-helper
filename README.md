# Jira Issue Transition and Environment Info Action

This GitHub Action fetches Jira ticket release information and updates the environment table in the ticket. It can also transition Jira issues to a specific status based on the issue type.

## Features
- Fetch Jira issue information, including dynamic environment table columns.
- Transition Jira issues to a configured status.
- Outputs structured environment data for further automation.

## ACTIONS_MODE

The action supports two modes, controlled by the `ACTIONS_MODE` input or environment variable:

| Mode         | Description                                                                                 |
|--------------|---------------------------------------------------------------------------------------------|
| `Transition` | Transitions the Jira issue to the configured status based on its type.                      |
| `IssueInfo`  | Fetches Jira issue information and outputs the environment table as structured JSON.         |

- If `ACTIONS_MODE` is not set explicitly, the action will auto-detect:
  - If `JIRA_ISSUE_KEY` is provided, it defaults to `IssueInfo` mode.
  - Otherwise, it defaults to `Transition` mode.
- You can override this by setting the `ACTIONS_MODE` input to either `Transition` or `IssueInfo`.

## Inputs
| Name                    | Required | Description                                                                 |
|-------------------------|----------|-----------------------------------------------------------------------------|
| `JIRA_BASE_URL`         | Yes      | Jira base URL, e.g. `https://your-domain.atlassian.net`                     |
| `JIRA_USER_EMAIL`       | Yes      | Jira user email, e.g. `yourname@your-domain`                                |
| `JIRA_API_TOKEN`        | Yes      | Jira API token (see [how to get it](https://id.atlassian.com/manage-profile/security/api-tokens)) |
| `JIRA_ISSUE_KEY`        | Yes      | Jira issue key, e.g. `ABC-1234`                                             |
| `JIRA_ENV_COLUMNS`      | No       | Comma separated columns for environment table, e.g. `Environment,Branch,Path to Build,Path to Upsert`. Default: `Environment,Branch,Path to Build,Path to Upsert` |
| `PR_TITLE_PATTERN`      | No       | Regex to extract issue key from PR/issue title. Default: `^(?:\[)?([a-zA-Z0-9]+-[0-9]+)(?:\])?` |
| `JIRA_ISSUE_TYPE_TRANSITION` | No  | Mapping of issue type to transition, e.g. `Story:Code Review;Bug:Code Review`. Default: `Story:Code Review;Bug:Code Review` |
| `OUTPUT_KEY`            | No       | Output key for the result. Default: `JIRA_ISSUE_INFO`                        |
| `ACTIONS_MODE`          | No       | Explicitly set the mode: `Transition` or `IssueInfo`.                       |

## Outputs
- The action sets an output (default: `JIRA_ISSUE_INFO`) containing the Jira issue info as JSON. Example structure:

```json
{
  "key": "ABC-1234",
  "url": "https://your-domain.atlassian.net/browse/ABC-1234",
  "summary": "Issue summary",
  "status": "In Progress",
  "environments": [
    {
      "env": "Staging",
      "branch": "feature/xyz",
      "buildPaths": ["/path/to/build1", "/path/to/build2"],
      "upsertPaths": ["/path/to/upsert1"],
      "otherInformation": ["value1", "value2"] // dynamic columns if present
    }
  ]
}
```

- The `environments` array contains objects for each row in the Jira environment table. Standard fields are `env`, `branch`, `buildPaths`, `upsertPaths`. Any additional columns will be included as camelCase keys with array values.

## Usage Example

```yaml
- name: Jira Issue Info
  uses: your-org/jira-issue-transition@v1
  with:
    JIRA_BASE_URL: ${{ secrets.JIRA_BASE_URL }}
    JIRA_USER_EMAIL: ${{ secrets.JIRA_USER_EMAIL }}
    JIRA_API_TOKEN: ${{ secrets.JIRA_API_TOKEN }}
    JIRA_ISSUE_KEY: ${{ github.event.pull_request.title }}
    JIRA_ENV_COLUMNS: Environment,Branch,Path to Build,Path to Upsert
    JIRA_ISSUE_TYPE_TRANSITION: "Story:Code Review;Bug:Code Review"
```

## Local Development

1. Clone the repository:
   ```sh
   git clone <repo-url>
   cd jira-issue-transition
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build the project:
   ```sh
   npm run build
   ```
4. Run locally (requires `.env` file or environment variables):
   ```sh
   npm start
   ```

## Notes
- The action supports dynamic columns in the Jira environment table. Any extra columns will be included in the output as camelCase keys.
- If `JIRA_ISSUE_KEY` is not provided, the action will try to extract it from the PR or issue title using `PR_TITLE_PATTERN`.
- The action can be used in two modes:
  - **Transition**: Transitions the Jira issue to the configured status.
  - **IssueInfo**: Fetches and outputs the Jira issue info (default if `JIRA_ISSUE_KEY` is set).

## License
MIT