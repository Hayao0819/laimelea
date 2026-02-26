import React from "react";
import { Providers } from "./Providers";
import { RootNavigator } from "../navigation/RootNavigator";

export default function App() {
  return (
    <Providers>
      <RootNavigator />
    </Providers>
  );
}
