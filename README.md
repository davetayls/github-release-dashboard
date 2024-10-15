# github-release-dashboard

See at a glance how many commits you've made to your projects since it was last released.

You'll need a GitHub [personal access token](https://github.com/settings/tokens). It all runs in the browser, so we never see your token.

Features:

- Highlight repos where the new commits are all `dependabot` commits
- Hide repos that are up to date
- Hide repos that have never had a release

## Local Usage

Add a `src/config.json` file to specify where repos will be pulled from

```json
{
  "org": "optional_your_org",
  "repos": [
    { "name": "name-inside-org" }
  ]
}
```

```
yarn install
yarn start
```
