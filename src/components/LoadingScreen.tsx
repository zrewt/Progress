import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, hairline } from "../theme";
import { BrandMark } from "./BrandMark";
import { Breathe, DisplayItalic } from "./Type";

export function LoadingScreen() {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  return (
    <View style={styles.container}>
      <Breathe scaleTo={1.05} duration={4600}>
        <BrandMark size={54} />
      </Breathe>
      <DisplayItalic style={styles.copy}>Preparing your practice.</DisplayItalic>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            {
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-46, 140],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  copy: { marginTop: 26, fontSize: 21, color: colors.sage },
  track: {
    marginTop: 22,
    height: 1,
    width: 144,
    backgroundColor: hairline,
    overflow: "hidden",
  },
  bar: { height: 1, width: 46, backgroundColor: colors.lichen },
});
