import type { ReactNode } from "react";
import { Text, View, type StyleProp, type TextProps, type ViewStyle } from "react-native";
import { colors, fonts } from "../theme";

export function Display({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.display, color: colors.bone, letterSpacing: -0.6 }, style]} />;
}

export function DisplayItalic({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.displayItalic, color: colors.bone, letterSpacing: -0.4 }, style]} />;
}

export function Body({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.sans, color: colors.sage, fontSize: 14, lineHeight: 22 }, style]} />;
}

export function Label({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.sansMedium, color: colors.sage, fontSize: 12 }, style]} />;
}

export function Micro({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.sansMedium, color: colors.sageDim, fontSize: 11, letterSpacing: 0.2 }, style]} />;
}

export function Mono({ style, ...props }: TextProps) {
  return <Text {...props} style={[{ fontFamily: fonts.mono, color: colors.sage, fontSize: 11 }, style]} />;
}

// Keep the shared wrappers but make everyday content appear immediately.
export function Rise({ children, style }: { children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}

export function Breathe({ children, style }: { children: ReactNode; scaleTo?: number; minOpacity?: number; duration?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={style}>{children}</View>;
}
