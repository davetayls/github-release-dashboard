import React from "react";

class FilterButton extends React.Component {
  state = {
    active: this.props.defaultState || false,
  };

  handleClick() {
    this.setState({ active: !this.state.active });
    this.props.onClick();
    return false;
  }

  render() {
    let disabled = "text-sm font-medium transition-colors hover:text-primary";
    let enabled = "text-sm font-medium transition-colors hover:text-primary bg-gray-300";

    if (!this.state.active) {
      [disabled, enabled] = [enabled, disabled];
    }
    return (
      <button
        className={`${enabled} ${disabled
          .split(" ")
          .map((h) => `hover:${h}`)
          .join(" ")} font-semibold py-2 px-2 border rounded`}
        onClick={this.handleClick.bind(this)}
      >
        {this.props.children}
      </button>
    );
  }
}

export default FilterButton;
