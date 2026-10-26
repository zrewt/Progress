import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import {
  Newsreader_400Regular,
  Newsreader_400Regular_Italic,
  Newsreader_500Medium,
} from "@expo-google-fonts/newsreader";
import {
  DMMono_400Regular,
  DMMono_500Medium,
} from "@expo-google-fonts/dm-mono";

import { GameProvider, useGame } from "./src/lib/game-context";
import { AuthScreen } from "./src/components/AuthScreen";
import { Background } from "./src/components/Background";
import { Celebration } from "./src/components/Celebration";
import { Dashboard } from "./src/components/Dashboard";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { Onboarding } from "./src/components/Onboarding";
import { SetupRequired } from "./src/components/SetupRequired";
import { colors } from "./src/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const { loading, user, profile, cloudEnabled } = useGame();

  return (
    <>
      {!cloudEnabled ? (
        <SetupRequired />
      ) : loading ? (
        <LoadingScreen />
      ) : !user ? (
        <AuthScreen />
      ) : !profile ? (
        <Onboarding />
      ) : (
        <Dashboard />
      )}
      <Celebration />
    </>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Newsreader_400Regular,
    Newsreader_400Regular_Italic,
    Newsreader_500Medium,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    DMMono_400Regular,
    DMMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <Background />
        <StatusBar style="light" />
        <GameProvider>
          <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
            <Root />
          </SafeAreaView>
        </GameProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  safe: { flex: 1 },
});
