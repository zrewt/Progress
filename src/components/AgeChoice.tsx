import { useState } from "react";
import { View } from "react-native";
import { AGE_OPTIONS, UNDER_13_MESSAGE, eligibleAge, type AgeBracket } from "../lib/age";
import { useGame } from "../lib/game-context";
import { Body, Display } from "./Type";
import { PrimaryButton, QuietButton } from "./Controls";

export function AgeChoice() {
  const { setAgeBracket, signOut } = useGame();
  const [bracket, setBracket] = useState<AgeBracket | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return <View style={{ flex: 1, justifyContent: "center", padding: 24, gap: 16 }}>
    <Display>Your age bracket</Display>
    <Body>We store only this bracket, not your birthday. This is self-declared; we cannot verify your age.</Body>
    {AGE_OPTIONS.map(o => <QuietButton key={o.value} label={`${bracket === o.value ? "Selected: " : ""}${o.label}`} onPress={() => setBracket(o.value)} disabled={busy} />)}
    {bracket === "under_13" ? <Body>{UNDER_13_MESSAGE}</Body> : null}
    {failed ? <Body>Your choice could not be saved. Please try again.</Body> : null}
    <PrimaryButton label="Continue" disabled={!eligibleAge(bracket) || busy} loading={busy} onPress={() => { if (!bracket) return; setBusy(true); void setAgeBracket(bracket).then(ok => setFailed(!ok)).finally(() => setBusy(false)); }} />
    <QuietButton label="Sign out" onPress={() => void signOut()} disabled={busy} />
  </View>;
}
