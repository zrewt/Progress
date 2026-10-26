import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors, fonts } from "../theme";

/**
 * Typographic primitives so every screen shares the same three voices:
 * Newsreader for display, Manrope for prose, DM Mono for details.
 */

export function Display({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: fonts.display, color: colors.bone, letterSpacing: -0.6 },
        style,
      ]}
    />
  );
}

export function DisplayItalic({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fonts.displayItalic,
          color: colors.bone,
          letterSpacing: -0.4,
        },
        style,
      ]}
    />
  );
}

export function Body({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: fonts.sans, color: colors.sage, fontSize: 13.5, lineHeight: 22 },
        style,
      ]}
    />
  );
}

export function Label({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: fonts.sansMedium, color: colors.sage, fontSize: 11 },
        style,
      ]}
    />
  );
}

export function Micro({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        {
          fontFamily: fonts.mono,
          color: colors.sageDim,
          fontSize: 9.5,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        },
        style,
      ]}
    />
  );
}

export function Mono({
  style,
  ...props
}: TextProps) {
  return (
    <Text
      {...props}
      style={[
        { fontFamily: fonts.mono, color: colors.sage, fontSize: 11 },
        style,
      ]}
    />
  );
}

/** Fades and lifts its children once on mount, like the web `animate-rise`. */
export function Rise({
  children,
  delay = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 520,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        style as StyleProp<ViewStyle>,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** Slow breathing opacity + scale, used for the ready-node ring and brand mark. */
export function Breathe({
  children,
  scaleTo = 1.04,
  minOpacity = 0.55,
  duration = 4500,
  style,
}: {
  children: ReactNode;
  scaleTo?: number;
  minOpacity?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: duration / 2,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, value]);

  return (
    <Animated.View
      style={[
        style as StyleProp<ViewStyle>,
        {
          opacity: value.interpolate({
            inputRange: [0, 1],
            outputRange: [minOpacity, 1],
          }),
          transform: [
            {
              scale: value.interpolate({
                inputRange: [0, 1],
                outputRange: [1, scaleTo],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
