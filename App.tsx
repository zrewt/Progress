import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
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
import { AgeChoice } from "./src/components/AgeChoice";
import { AuthScreen } from "./src/components/AuthScreen";
import { Background } from "./src/components/Background";
import { Celebration } from "./src/components/Celebration";
import { Dashboard } from "./src/components/Dashboard";
import { LoadingScreen } from "./src/components/LoadingScreen";
import { Onboarding } from "./src/components/Onboarding";
import { SetupRequired } from "./src/components/SetupRequired";
import { ResetPasswordScreen } from "./src/components/ResetPasswordScreen";
import { ReminderChoice } from "./src/components/ReminderChoice";
import { SeasonHistory } from "./src/components/PlanSheets";
import { TopBar } from "./src/components/TopBar";
import { missingLinkConfig } from "./src/lib/config";
import { colors } from "./src/theme";
import { Body } from "./src/components/Type";
import { PrimaryButton, QuietButton } from "./src/components/Controls";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// Warn, never block: Settings shows these rows as coming soon until the public
// pages exist. The release checklist requires them before a store build.
if (__DEV__) {
  const missingLinks = missingLinkConfig();
  if (missingLinks.length) {
    console.warn(`[config] ${missingLinks.join(" and ")} not set. Settings shows those links as coming soon.`);
  }
}

function Root() {
  const { loading, user, profile, snapshot, cloudEnabled, loadFailed, error, clearError, retryLoad, signOut, recovering, reminderSetupPending, setReminderSetupPending } = useGame();
  const [startingGoal, setStartingGoal] = useState(false);
  const hasFinishedChapter = Boolean(snapshot?.seasons.length && !snapshot.seasons.some(season => season.status === "active"));
  useEffect(() => { if (!hasFinishedChapter) setStartingGoal(false); }, [hasFinishedChapter]);

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
      ) : !snapshot?.profile?.age_bracket ? (
        <AgeChoice />
      ) : hasFinishedChapter ? (
        startingGoal ? <Onboarding onCancel={() => setStartingGoal(false)} /> : <View style={{ flex: 1 }}>
          <TopBar />
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <Body>Your chapter is closed. Your progress is saved, and there is no active plan.</Body>
            {error ? <><Body accessibilityRole="alert">{error}</Body><QuietButton label="Dismiss" onPress={clearError} /></> : null}
            <PrimaryButton label="Start a new goal" onPress={() => setStartingGoal(true)} />
            <SeasonHistory />
          </ScrollView>
        </View>
      ) : !profile ? (
        <Onboarding />
      ) : reminderSetupPending ? (
        <View style={{ flex: 1, justifyContent: "center", padding: 24 }}><ReminderChoice onDone={() => setReminderSetupPending(false)} /></View>
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
        <StatusBar style="dark" />
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
