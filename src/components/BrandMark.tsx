import Svg, { Circle, Path } from "react-native-svg";
import { colors } from "../theme";

export function BrandMark({
  size = 28,
  color = colors.bone,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx={20} cy={20} r={19} stroke={color} strokeOpacity={0.28} />
      <Path
        d="M20 32V18"
        stroke={color}
        strokeWidth={1.2}
        strokeLinecap="round"
      />
      <Path
        d="M20 24c-4.6 0-7.6-2.6-7.6-7.4 4.6 0 7.6 2.6 7.6 7.4Z"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Path
        d="M20 19.5c0-4.8 3-7.4 7.6-7.4 0 4.8-3 7.4-7.6 7.4Z"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
      />
      <Path
        d="M20 29.5c-2.8 0-4.7-1.3-5.6-4 3.1-.4 5 .9 5.6 4Z"
        stroke={color}
        strokeWidth={1.1}
        strokeLinejoin="round"
        strokeOpacity={0.7}
      />
    </Svg>
  );
}
