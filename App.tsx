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
import { ResetPasswordScreen } from "./src/components/ResetPasswordScreen";
import { colors } from "./src/theme";
import { Body } from "./src/components/Type";
import { PrimaryButton, QuietButton } from "./src/components/Controls";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function Root() {
  const { loading, user, profile, snapshot, cloudEnabled, loadFailed, error, retryLoad, signOut, recovering } = useGame();

  return (
    <>
      {!cloudEnabled ? (
        <SetupRequired />
      ) : recovering ? (
        <ResetPasswordScreen />
      ) : loading && !snapshot ? (
        // A refresh (after saving consent, say) must never unmount the screen the
        // person is in the middle of — that would wipe their answers and start over.
        <LoadingScreen />
      ) : loadFailed && user ? (
        <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 20 }}>
          <Body accessibilityRole="alert">{error ?? "Your journal couldn’t be loaded. Nothing has been overwritten."}</Body>
          <PrimaryButton label="Try again" onPress={() => void retryLoad()} />
          <QuietButton label="Sign out" onPress={() => void signOut()} />
        </View>
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
