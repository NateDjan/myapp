import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { radius, spacing, T } from "../theme";

export type StudentTabId = "home" | "eval" | "learn";

const TABS: {
  id: StudentTabId;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { id: "home", label: "Accueil", icon: "home-variant-outline" },
  { id: "eval", label: "Evals", icon: "clipboard-text-outline" },
  { id: "learn", label: "Apprendre", icon: "book-open-variant" },
];

export function StudentBottomNav({
  active,
  onChange,
}: {
  active: StudentTabId;
  onChange: (t: StudentTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  const padBottom = Math.max(insets.bottom, 10);

  return (
    <View style={[styles.shadowHost, { paddingBottom: padBottom }]}>
      <View style={styles.row}>
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[styles.item, on ? styles.itemOn : undefined]}
              onPress={() => onChange(t.id)}
              accessibilityRole="tab"
              accessibilityLabel={t.label}
              accessibilityState={{ selected: on }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name={t.icon} size={24} color={on ? T.primary : T.inkMuted} />
              <Text style={[styles.label, on ? styles.labelOn : undefined]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowHost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.border,
    paddingTop: spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#0F223A",
        shadowOffset: { width: 0, height: -6 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 16 },
      default: {},
    }),
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: spacing.sm,
    maxWidth: 520,
    alignSelf: "center",
    width: "100%",
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    minHeight: 52,
  },
  itemOn: {
    backgroundColor: T.primarySoft,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    color: T.inkMuted,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  labelOn: {
    color: T.primaryDark,
  },
});
