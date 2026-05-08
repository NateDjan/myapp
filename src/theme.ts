import { Platform, StyleSheet } from "react-native";

/**
 * Design system EduCoach — inspiré des meilleures apps éducatives :
 * palette calme et sérieuse (lisibilité), touches ludiques (coins arrondis,
 * accents verts « progression »), hiérarchie nette (titres forts, corps aéré).
 */

export const spacing = { xs: 6, sm: 10, md: 14, lg: 18, xl: 24, xxl: 32 };
export const radius = { sm: 12, md: 16, lg: 20, xl: 28, full: 9999 };

export const T = {
  /** Fond principal très léger, neutre (lisibilité maximale) */
  bg: "#F6F8FB",
  bgDeep: "#EDF1F7",
  /** Cartes blanches flottantes */
  surface: "#FFFFFF",
  surfaceMuted: "#F0F4FA",
  /** Texte principal — bleu ardoise profond */
  ink: "#1B2838",
  inkMuted: "#5A6578",
  inkSubtle: "#8B96A8",
  /** Accent primaire — vert progression (type apps apprentissage premium) */
  primary: "#12B886",
  primaryDark: "#0D926F",
  primarySoft: "#E6FAF4",
  /** Alias — texte sur badges verts */
  mintDark: "#0D926F",
  /** Accent secondaire — bleu confiance / liens */
  accent: "#3D5AFE",
  accentSoft: "#E8ECFF",
  /** Accent chaud — récompenses, CTA secondaires */
  amber: "#FFB020",
  amberSoft: "#FFF4DC",
  amberBorder: "#E5A010",
  /** États */
  success: "#12B886",
  warning: "#F59F00",
  danger: "#E03131",
  dangerSoft: "#FFE8E8",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",
  overlay: "rgba(27, 40, 56, 0.45)",
  shadow: "rgba(15, 34, 58, 0.08)",
};

const shadowCard =
  Platform.OS === "web"
    ? { boxShadow: `0 8px 28px ${T.shadow}` as unknown as undefined }
    : {
        shadowColor: "#0F223A",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.07,
        shadowRadius: 20,
        elevation: 4,
      };

const shadowSoft =
  Platform.OS === "web"
    ? { boxShadow: `0 2px 12px ${T.shadow}` as unknown as undefined }
    : {
        shadowColor: "#0F223A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
        elevation: 2,
      };

export const warmStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: T.bg },
  screenAlt: { flex: 1, backgroundColor: T.bgDeep },
  /** Padding écran + espacement vertical entre sections */
  pad: { padding: spacing.lg, gap: spacing.md },
  padWide: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.md },

  /** Hero landing — zone premium */
  landingTopAccent: {
    height: 6,
    backgroundColor: T.primary,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginHorizontal: -spacing.lg,
    marginTop: -spacing.lg,
    marginBottom: spacing.sm,
  },
  heroEmoji: { fontSize: 44, textAlign: "center", marginBottom: spacing.sm },
  brandMark: {
    alignSelf: "center",
    backgroundColor: T.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginBottom: spacing.sm,
  },
  brandMarkText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: T.primaryDark,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -0.8,
    textAlign: "center",
    marginBottom: spacing.xs,
  },
  titleLight: {
    fontSize: 26,
    fontWeight: "800",
    color: T.ink,
    letterSpacing: -0.5,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: T.inkMuted,
    lineHeight: 24,
    textAlign: "center",
    paddingHorizontal: spacing.sm,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: T.ink,
    marginTop: spacing.sm,
    letterSpacing: -0.3,
  },
  hint: {
    fontSize: 14,
    color: T.inkMuted,
    lineHeight: 21,
  },
  caption: {
    fontSize: 12,
    color: T.inkSubtle,
    lineHeight: 17,
  },

  card: {
    backgroundColor: T.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: T.border,
    gap: spacing.sm,
    ...shadowSoft,
  },
  cardLift: {
    ...shadowCard,
    borderColor: "transparent",
  },
  cardInset: {
    backgroundColor: T.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: T.border,
  },

  /** Formulaires */
  input: {
    borderWidth: 1.5,
    borderColor: T.border,
    backgroundColor: T.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: T.ink,
  },
  inputKid: {
    borderWidth: 2,
    borderColor: T.amberBorder,
    backgroundColor: "#FFFDF8",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 17,
    color: T.ink,
  },

  /** Boutons */
  btnPrimary: {
    backgroundColor: T.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    ...shadowSoft,
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16, letterSpacing: 0.2 },
  btnOutline: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 2,
    borderColor: T.primary,
    backgroundColor: T.surface,
  },
  btnOutlineText: { color: T.primaryDark, fontWeight: "700", fontSize: 16 },
  btnSun: {
    backgroundColor: T.amber,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    borderWidth: 0,
    ...shadowSoft,
  },
  btnSunText: { color: "#2D2208", fontWeight: "800", fontSize: 16 },
  btnSoft: {
    backgroundColor: T.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.xs,
  },
  btnSky: {
    backgroundColor: "#B8E8FF",
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  btnGhost: {
    paddingVertical: spacing.sm,
    alignItems: "center",
  },

  /** Navigation élève — style segmented iOS / Khan */
  tabBar: {
    flexDirection: "row",
    backgroundColor: T.surfaceMuted,
    borderRadius: radius.full,
    padding: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: T.border,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tabOn: {
    backgroundColor: T.surface,
    ...shadowSoft,
  },
  tabLabel: { fontWeight: "700", fontSize: 13, color: T.inkMuted },
  tabLabelOn: { color: T.ink },
  /** Alias compat App.tsx */
  tabText: { fontWeight: "700", fontSize: 13, color: T.inkMuted },
  tabTextOn: { color: T.ink },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    backgroundColor: T.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: T.border,
  },
  pillActive: {
    backgroundColor: T.primarySoft,
    borderColor: T.primary,
  },

  tierBadge: {
    backgroundColor: T.accentSoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: T.border,
  },
  tierText: { fontWeight: "800", fontSize: 13, color: T.accent },

  chipGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.primarySoft,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#C3F0E0",
  },
  doneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: T.primary,
    marginLeft: spacing.xs,
  },

  kidSecondaryBtn: {
    backgroundColor: T.amberSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: T.amberBorder,
  },

  blockFun: {
    backgroundColor: T.surfaceMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: T.border,
  },

  /** Coach / mascotte — zone encouragement type assistant */
  coachBubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    backgroundColor: T.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#C3F0E0",
    marginBottom: spacing.md,
  },
  coachEmoji: { fontSize: 36 },
  coachText: { flex: 1, fontSize: 15, lineHeight: 22, color: T.ink, fontWeight: "600" },
  coachHint: { fontSize: 13, color: T.primaryDark, marginTop: spacing.xs, fontWeight: "600" },

  /** Barre XP */
  xpWrap: { marginTop: spacing.sm },
  xpBarBg: {
    height: 10,
    borderRadius: 5,
    backgroundColor: T.border,
    overflow: "hidden",
  },
  xpBarFill: {
    height: 10,
    borderRadius: 5,
    backgroundColor: T.primary,
  },
  xpLabel: { fontSize: 12, color: T.inkSubtle, marginBottom: 4, fontWeight: "600" },

  /** Stats header élève */
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  statPill: {
    backgroundColor: T.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: T.border,
  },
  statPillText: { fontSize: 13, fontWeight: "700", color: T.ink },

  /** Étapes leçon */
  stepDots: { flexDirection: "row", gap: spacing.xs, marginVertical: spacing.sm },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.border },
  stepDotOn: { backgroundColor: T.primary, width: 22 },

  /** Segment inscription / connexion */
  segmentAuth: {
    flexDirection: "row",
    backgroundColor: T.surfaceMuted,
    borderRadius: radius.full,
    padding: 4,
    gap: 4,
    marginBottom: spacing.sm,
  },
  segmentAuthItem: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderRadius: radius.full,
  },
  segmentAuthItemOn: {
    backgroundColor: T.surface,
    ...shadowSoft,
  },
  segmentAuthLabel: { fontWeight: "700", fontSize: 14, color: T.inkMuted },
  segmentAuthLabelOn: { color: T.ink },

  /** Auth card */
  authCard: {
    backgroundColor: T.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: T.border,
    ...shadowCard,
    gap: spacing.md,
  },
});
