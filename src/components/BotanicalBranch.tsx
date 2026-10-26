import Svg, { Circle, G, Path } from "react-native-svg";
import { colors } from "../theme";

export function BotanicalBranch({
  height = 280,
  color = colors.bone,
  opacity = 0.22,
}: {
  height?: number;
  color?: string;
  opacity?: number;
}) {
  return (
    <Svg
      width={(height / 620) * 400}
      height={height}
      viewBox="0 0 400 620"
      fill="none"
      opacity={opacity}
    >
      <G
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path
          d="M196 604C187 516 195 432 215 352C236 269 249 178 242 74"
          strokeOpacity={0.72}
        />
        <Path d="M205 468C190 452 180 438 177 416" strokeOpacity={0.35} />
        <Path d="M222 354C239 340 251 322 255 300" strokeOpacity={0.35} />
        <Path d="M234 258C220 244 213 226 214 206" strokeOpacity={0.35} />
        <Path d="M240 180C255 168 263 152 264 132" strokeOpacity={0.35} />

        <Path
          d="M211 430C183 426 163 407 158 376C186 376 207 393 211 430Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.55}
        />
        <Path
          d="M222 362C248 360 268 343 274 314C247 313 228 328 222 362Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.5}
        />
        <Path
          d="M213 286C188 281 171 263 167 234C193 235 211 251 213 286Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.55}
        />
        <Path
          d="M238 226C263 222 279 205 283 179C257 179 241 194 238 226Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.5}
        />
        <Path
          d="M214 158C193 153 179 138 176 114C198 115 212 129 214 158Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.55}
        />
        <Path
          d="M242 106C262 101 275 87 279 64C255 65 242 79 242 106Z"
          fill={color}
          fillOpacity={0.035}
          strokeOpacity={0.5}
        />
        <Path
          d="M196 522C172 520 153 505 147 480C171 479 189 493 196 522Z"
          fill={color}
          fillOpacity={0.03}
          strokeOpacity={0.4}
        />
        <Path d="M237 142C232 165 239 184 252 196" strokeOpacity={0.25} />
        <Circle cx={204} cy={484} r={2.2} fill={color} fillOpacity={0.35} stroke="none" />
        <Circle cx={244} cy={300} r={2.2} fill={color} fillOpacity={0.35} stroke="none" />
        <Circle cx={226} cy={196} r={2.2} fill={color} fillOpacity={0.35} stroke="none" />
      </G>
    </Svg>
  );
}
