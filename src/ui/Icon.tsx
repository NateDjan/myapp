import React from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { T } from "../theme";

type MIconName = React.ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({
  name,
  size = 22,
  color = T.ink,
}: {
  name: MIconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
