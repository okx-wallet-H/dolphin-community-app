import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

const MAPPING = {
  "house.fill": "home",
  "chart.line.uptrend.xyaxis": "show-chart",
  "message.fill": "smart-toy",
  sparkles: "auto-awesome",
  "person.crop.circle": "account-circle",
  "paperplane.fill": "send",
  "arrow.down.circle.fill": "south",
  "arrow.up.circle.fill": "north",
  "creditcard.fill": "credit-card",
  "chevron.right": "chevron-right",
  "bell.fill": "notifications",
  "shield.fill": "shield",
  "wallet.pass.fill": "account-balance-wallet",
  "bolt.fill": "bolt",
  "clock.fill": "schedule",
  "ellipsis.circle.fill": "more-horiz",
  "chart.bar.fill": "bar-chart",
  "gearshape.fill": "settings",
} as IconMapping;

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
