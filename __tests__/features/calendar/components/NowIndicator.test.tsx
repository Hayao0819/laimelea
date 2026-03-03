import { render } from "@testing-library/react-native";
import React from "react";

import { NowIndicator } from "../../../../src/features/calendar/components/NowIndicator";

describe("NowIndicator", () => {
  it("renders with testID", async () => {
    const { getByTestId } = await render(<NowIndicator topOffset={100} />);
    expect(getByTestId("now-indicator")).toBeTruthy();
  });

  it("positions at given topOffset", async () => {
    const { getByTestId } = await render(<NowIndicator topOffset={200} />);
    const container = getByTestId("now-indicator");
    // The container style should include top: 200
    const flatStyle = Array.isArray(container.props.style)
      ? Object.assign({}, ...container.props.style)
      : container.props.style;
    expect(flatStyle.top).toBe(200);
  });

  it("renders dot and line elements", async () => {
    const { getByTestId } = await render(<NowIndicator topOffset={50} />);
    const container = getByTestId("now-indicator");
    // The container should have exactly 2 children: dot and line
    expect(container.children).toHaveLength(2);
  });
});
