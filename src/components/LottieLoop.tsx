import React from "react";
import { StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";

export function LottieLoop({
  source,
  width,
  height,
}: {
  source: React.ComponentProps<typeof LottieView>["source"];
  width: number;
  height: number;
}) {
  return (
    <View style={[styles.wrap, { width, height }]}>
      <LottieView source={source} autoPlay loop style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
});
