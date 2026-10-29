/** A calm, warm paper palette with ink, earth and understated botanical accents. */

export const colors = {
  canvas: "#EEEDE7",
  ink950: "#FFFFFF",
  ink900: "#EEEDE7",
  ink850: "#FCFBF8",
  ink800: "#F0EEE8",
  ink700: "#ECEAE3",
  ink600: "#E1DED5",

  bone: "#262B29",
  boneDim: "#454E49",
  boneFaint: "#59645E",

  sage: "#56625B",
  sageDim: "#66726A",
  sageDeep: "#707C74",

  lichen: "#486C5A",
  lichenDim: "#486C5A",

  copper: "#745044",
  copperLight: "#745044",
  copperDim: "#654338",

  clay: "#A04C40",
  heather: "#75617C",
  ochre: "#81613F",
  moss: "#486C5A",

  focusSurface: "#E2EAE3",
  focusBorder: "#B7C8B9",
  selectionSurface: "#F2E5DC",
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
  radius: 14,
} as const;

export const type = {
  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 0.6,
    color: colors.sage,
  },
  micro: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 0.2,
    color: colors.sageDim,
  },
  display: {
    fontFamily: fonts.display,
    color: colors.bone,
    letterSpacing: -0.6,
  },
};
