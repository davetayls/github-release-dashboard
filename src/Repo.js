import React from "react";
import { formatDistance, differenceInCalendarDays } from 'date-fns'
import { getConfig } from "./config";


class Repo extends React.Component {
  constructor(props) {
    super(props);
    this.state = props.repo;
  }

  styles() {
    let repo = this.state;
    let colour = "gray";
    let daysAgo = repo.latest_release ? differenceInCalendarDays(Date.now(), repo.latest_release.published_at) : 0;
    if (repo.dependabot_only) {
      colour = "green";
    }
    if (repo.commits?.ahead_by > 0) {
      colour = "blue";
    }
    if (repo.latest_release === null || repo.commits?.ahead_by > 10 || daysAgo > 14) {
      colour = "orange";
    }
    if (repo.commits?.ahead_by >= 50 || daysAgo > 30) {
      colour = "red";
    }

    return `bg-${colour}-500`;
  }

  renderDetails() {
    if (this.state.latest_release === undefined) {
      return "No release found";
    }

    if (this.state.commits === undefined) {
      return "Loading...";
    }

    return (
      <>
        <div>
          <p className="text-gray-700">{this.state.description}</p>
        </div>
        <div className="pt-4 pb-2">
          <span
            className="bg-gray-200 inline-block rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
            Commits Ahead: {this.state.commits.ahead_by}
          </span>
          <span
            className="bg-gray-200 inline-block rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
            Issues: {this.state.open_issues_count}
          </span>
          {this.state.latest_release && (
            <a href={this.state.latest_release.html_url} target="_blank"
               className="bg-gray-200 inline-block rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
              Latest: {this.state.latest_release.tag_name} - {formatDistance(Date.now(), this.state.latest_release.published_at ?? this.state.latest_release.created_at)}
            </a>
          )}
        </div>
        <div className="pt-4 pb-2">
          {this.state.releases.map((release) =>
            <a href={release.html_url} target="_blank"
               className="bg-gray-200 inline-block rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-2">
              {release.draft ? '✏️' : '🚀'}: {release.tag_name} - {formatDistance(Date.now(), release.published_at ?? release.created_at)}
            </a>
          )}
        </div>
      </>
    );
  }

  render() {
    const config = getConfig();
    return (
      <div className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 mb-4">
        <div className={this.styles() + " h-full px-6 py-4 mr-2 bg-gray-500"}>
          <div className="font-bold text-xl mb-2">
            <a target="_blank" href={this.state.html_url}>
              {this.state.full_name}
            </a>
          </div>
          {this.renderDetails()}
        </div>
      </div>
    );
  }
}

export default Repo;
