import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { spacing, T, warmStyles } from "../theme";

type Variant = "mint" | "purple";

const VARIANT_COLORS: Record<Variant, [string, string, string]> = {
  mint: ["#E6FAF4", "#F6F8FB", "#F6F8FB"],
  purple: ["#E8ECFF", "#F6F8FB", "#F6F8FB"],
};

/**
 * En-tête d’écran harmonisé : dégradé doux, barre d’accent, badge optionnel.
 */
export function AppScreenHero({
  badge,
  title,
  subtitle,
  variant = "mint",
  accentBarColor = T.primary,
  decoration,
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  variant?: Variant;
  accentBarColor?: string;
  decoration?: React.ReactNode;
}) {
  const colors = VARIANT_COLORS[variant];
  return (
    <LinearGradient
      colors={colors}
      locations={[0, 0.38, 1]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={[styles.accentBar, { backgroundColor: accentBarColor }]} />
      {badge ? (
        <View style={warmStyles.brandMark}>
          <Text style={warmStyles.brandMarkText}>{badge}</Text>
        </View>
      ) : null}
      {decoration ? <View style={styles.decorWrap}>{decoration}</View> : null}
      <Text style={warmStyles.title}>{title}</Text>
      {subtitle ? (
        <Text style={[warmStyles.subtitle, { marginBottom: 6 }]}>{subtitle}</Text>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: 8,
    paddingBottom: 18,
    marginBottom: 10,
    borderRadius: 20,
  },
  accentBar: {
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  decorWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
});
