import { useId } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Defs, Pattern, RadialGradient, Rect, Stop, Circle } from "react-native-svg";
import { colors } from "../theme";

/** Deterministic pseudo-noise so the grain never shifts between renders. */
const GRAIN = Array.from({ length: 46 }, (_, index) => ({
  x: (index * 37) % 120,
  y: (index * 61) % 120,
  r: index % 3 === 0 ? 0.9 : 0.6,
  o: 0.05 + ((index * 13) % 7) * 0.012,
}));

/**
 * The nocturnal field-journal ground: deep olive charcoal, a faint copper
 * glow at the top, and a whisper of paper grain.
 */
export function Background() {
  const patternId = `grain-${useId().replace(/[:]/g, "")}`;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient
        colors={["#14170F", "#11140F", "#0F120D"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="copperGlow" cx="66%" cy="-6%" r="72%">
            <Stop offset="0" stopColor={colors.copper} stopOpacity={0.14} />
            <Stop offset="0.55" stopColor={colors.copper} stopOpacity={0.03} />
            <Stop offset="1" stopColor={colors.copper} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="mossGlow" cx="8%" cy="76%" r="60%">
            <Stop offset="0" stopColor={colors.moss} stopOpacity={0.05} />
            <Stop offset="1" stopColor={colors.moss} stopOpacity={0} />
          </RadialGradient>
          <Pattern
            id={patternId}
            width={120}
            height={120}
            patternUnits="userSpaceOnUse"
          >
            {GRAIN.map((dot, index) => (
              <Circle
                key={index}
                cx={dot.x}
                cy={dot.y}
                r={dot.r}
                fill={colors.bone}
                fillOpacity={dot.o}
              />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#copperGlow)" />
        <Rect width="100%" height="100%" fill="url(#mossGlow)" />
        <Rect width="100%" height="100%" fill={`url(#${patternId})`} opacity={0.5} />
      </Svg>
    </View>
  );
}
