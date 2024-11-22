import React from "react";
import { Octokit } from "@octokit/rest";

import Repo from "./Repo";
import FilterButton from "./FilterButton";
import { getConfig } from "./config";

class App extends React.Component {
  constructor() {
    super();
    this.state = {
      unreleased: true,
      dependabot_only: false,
      zero_ahead: true,
      repos: [],
      authToken: null,
      targetUser: null,
      tokenError: "",
      loading_progress: "- Fetching repos",
    };

      this.octokit = undefined;
  }

  async loadRepos() {
    const config = getConfig();
    const repoNames = config.repos.map((repo) => repo.name);
    let repos = await this.octokit.paginate(
      this.octokit.repos.listForOrg,
      {
        org: config.org,
        type: 'all',
        per_page: 100,
        //per_page: 1,
      },
      (response) => response.data
    );

    // Remove archived repos
    repos = repos.filter((r) => !r.archived && repoNames.some((name) => r.full_name.includes(name)));

    this.setState({ repos, loading_progress: "- Fetching releases" });

    // Get the latest release
    repos = await Promise.all(
      repos.map(async (repo) => {
        // get security alerts
        const alerts = await this.octokit.paginate('GET /repos/{owner}/{repo}/dependabot/alerts', {
          owner: repo.owner.login,
          repo: repo.name,
          per_page: 50
        }).catch((e) => {console.error(e);})

        repo.alerts = alerts? {
          critical: alerts.filter((alert) => alert.state === 'open' && alert.security_vulnerability.severity === 'critical').length,
          high: alerts.filter((alert) => alert.state === 'open' && alert.security_vulnerability.severity === 'high').length,
          medium: alerts.filter((alert) => alert.state === 'open' && alert.security_vulnerability.severity === 'medium').length
        } : undefined;

        const repoConfig = config.repos.find((configRepo) =>
          repo.full_name.includes(configRepo.name)
        );
        if (repoConfig.isGitFlow) {
          // release by Git Flow - get tags instead of release
          const result = await this.octokit.paginate('GET /repos/{owner}/{repo}/tags', {
            owner: repo.owner.login,
            repo: repo.name,
            per_page: 50,
          })
          const tags = result.filter((tag)=> {
            return tag.name.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/)
          }).map(
            (tag) => {
              tag.version = {};
              tag.version.major = Number(tag.name.split('.')[0]);
              tag.version.minor = Number(tag.name.split('.')[1]);
              tag.version.patch = Number(tag.name.split('.')[2]);
              return tag;
            }).sort((tag1, tag2) => {
              if (tag1.version.major === tag2.version.major) {
                if (tag1.version.minor === tag2.version.minor) {
                  return tag2.version.patch - tag1.version.patch;
                }
                return tag2.version.minor - tag1.version.minor;
              }
              return tag2.version.major - tag1.version.major});
          const commitDetail = await this.octokit.request('GET /repos/{owner}/{repo}/commits/{ref}', {
              owner: repo.owner.login,
              repo: repo.name,
              ref: tags[0].commit.sha,
              })

          repo.latest_release = {
            target_commitish:tags[0].commit.sha,
            published_at:commitDetail.data.commit.author.date,
            tag_name: tags[0].name
          };
          repo.releases = [];

          return repo;
        } else {
          const { data: releases } = await this.octokit.repos.listReleases({
            owner: repo.owner.login,
            repo: repo.name,
            per_page: 10,
          });
          repo.releases = releases.slice(1, 3);
          repo.latest_release = releases.filter(a => a.draft === false)[0];
          return repo;
        }
      })
    );

    this.setState({ loading_progress: "- Fetching commits since release" });

    // Fetch the number of commits since that release
    repos = await Promise.all(
      repos.map(async (repo) => {
        if (!repo.latest_release) {
          return repo;
        }
        console.log(repo.latest_release)

        try {

          const { data: commits } = await this.octokit.repos.compareCommits({
            owner: repo.owner.login,
            repo: repo.name,
            base: repo.latest_release?.target_commitish ?? repo.latest_release?.tag_name,
            head: repo.default_branch,
          });

          repo.commits = commits;
        } catch (error) {
          console.warn(`Error comparing commits`, repo, error)
        }
        return repo;
      })
    );

    this.setState({ loading_progress: "- Tagging dependabot commits" });

    // Are they all authored by Dependabot?
    repos = await Promise.all(
      repos.map(async (repo) => {
        if (!repo.commits || repo.commits.ahead_by === 0) {
          return repo;
        }

        const nonDependabot = repo.commits.commits.filter((c) => {
          return c.commit.author.login !== "dependabot[bot]";
        });

        repo.dependabot_only = true;
        if (nonDependabot.length > 0) {
          repo.dependabot_only = false;
        }

        return repo;
      })
    );

    this.setState({ repos, loading_progress: "" });
  }

  invert(opt) {
    this.setState((state) => {
      state[opt] = !this.state[opt];
      return { ...state };
    });
  }

  renderFilters() {
    return (
      <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
        <FilterButton
          defaultState={this.state.unreleased}
          onClick={() => this.invert("unreleased")}
        >
          Include Unreleased
        </FilterButton>
        <FilterButton
          defaultState={this.state.dependabot_only}
          onClick={() => this.invert("dependabot_only")}
        >
          Dependabot Only
        </FilterButton>
        <FilterButton
          defaultState={this.state.zero_ahead}
          onClick={() => this.invert("zero_ahead")}
        >
          Up to date
        </FilterButton>
      </nav>
    );
  }

  async handleSubmit(event) {
    let token = ''
    let username = ''
    if (event) {
      event.preventDefault();
      token = event.target.elements.token.value
      window.localStorage.setItem('gh_token', token)
    } else if (window.localStorage.getItem('gh_token')) {
      token = window.localStorage.getItem('gh_token');
    } else if (window.location.hash) {
      token = window.location.hash.substring(1);
    }
    this.octokit = new Octokit({
      auth: `token ${token}`,
    });

    // Check that the credentials work
    try {
      await this.octokit.request("/user");
      this.setState({ tokenError: "" });
    } catch (e) {
      this.setState({
        tokenError: (
          <p className="mb-4 text-3xl text-red-800">
            Invalid credentials provided.
          </p>
        ),
      });
      this.octokit = undefined;
      return;
    }

    this.setState(
      {
        authToken: token,
        targetUser: username,
      },
      () => {
        this.loadRepos();
      }
    );
  }

  renderTokenInput() {
    return (
      <form onSubmit={this.handleSubmit.bind(this)}>
        {this.state.tokenError}
        <strong>
          This all runs in the browser. We never see your GitHub Access Token
          <br />
          <br />
        </strong>
        <label className="w-12 inline-block" htmlFor="token">
          Token:
        </label>
        <input
          className="ml-2 border-2"
          id="token"
          name="token"
          type="password"
        />
        <br />
        <label className="w-12 inline-block" htmlFor="user">
          User:
        </label>
        <input className="ml-2 border-2" id="user" name="user" />
        <br /> <br />
        <input
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          type="submit"
          value="Enter"
        />
      </form>
    );
  }

  componentDidMount() {
    this.handleSubmit();
  }

  render() {
    if (!this.state.authToken) {
      return this.renderTokenInput();
    }

    return (
      <div>
        <div className="flex h-16 items-center px-4">
          <span className="inline-flex items-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-[200px] justify-between">
            Total repos loaded:
            {this.state.loading_progress}
            {this.state.repos.length}
          </span>
          {this.renderFilters()}
        </div>
        <div className="flex flex-wrap my-4">
          {this.state.repos.map((r) => {
            if (!this.state.unreleased && r.latest_release === undefined) {
              return "";
            }
            if (this.state.dependabot_only && !r.dependabot_only) {
              return "";
            }
            if (
              !this.state.zero_ahead &&
              r.commits &&
              r.commits.ahead_by === 0
            ) {
              return "";
            }
            return <Repo repo={r} key={r.full_name} />;
          })}
        </div>
      </div>
    );
  }
}

export default App;
