/**
 * The visual language of Vitality Tree, translated from the web app:
 * a nocturnal field journal — warm parchment on olive charcoal, copper for
 * action, lichen for completion.
 */

export const colors = {
  canvas: "#11140F",
  ink950: "#0B0D09",
  ink900: "#11140F",
  ink850: "#171B14",
  ink800: "#1D2219",
  ink700: "#262C21",
  ink600: "#31382A",

  bone: "#E9E2D0",
  boneDim: "#D3CCB9",
  boneFaint: "#BDB7A4",

  sage: "#A9A48F",
  sageDim: "#8B8877",
  sageDeep: "#918E7C",

  lichen: "#C6CB9C",
  lichenDim: "#9BA177",

  copper: "#C17845",
  copperLight: "#D99A68",
  copperDim: "#8E5A35",

  clay: "#BE7360",
  heather: "#B3A3B8",
  ochre: "#C1A473",
  moss: "#92A89B",
} as const;

/** Translucent ink/bone helpers, matching the Tailwind opacity syntax. */
export function alpha(hex: string, opacity: number) {
  const value = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${value}`;
}

export const fonts = {
  display: "Newsreader_400Regular",
  displayItalic: "Newsreader_400Regular_Italic",
  displayMedium: "Newsreader_500Medium",
  sans: "Manrope_400Regular",
  sansMedium: "Manrope_500Medium",
  sansSemi: "Manrope_600SemiBold",
  mono: "DMMono_400Regular",
  monoMedium: "DMMono_500Medium",
} as const;

/** Shared hairline + card treatment. */
export const hairline = alpha(colors.bone, 0.1);

export const layout = {
  gutter: 20,
  maxWidth: 960,
  radius: 2,
} as const;

export const type = {
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.sage,
  },
  micro: {
    fontFamily: fonts.mono,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
    color: colors.sageDim,
  },
  display: {
    fontFamily: fonts.display,
    color: colors.bone,
    letterSpacing: -0.6,
  },
};
