import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { Video } from "@golf-coach/shared-types";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    const poll = async () => {
      try {
        const v = await api.getVideo(token, id);
        if (cancelled) return;
        setVideo(v);
        if (v.status !== "processing" && interval) {
          clearInterval(interval);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el análisis");
      }
    };

    poll();
    interval = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [token, id]);

  if (error) return <Text style={styles.error}>{error}</Text>;
  if (!video) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (video.status === "processing" || video.status === "uploaded") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.hint}>Analizando tu swing, esto puede tardar un minuto…</Text>
      </View>
    );
  }

  if (video.status === "failed") {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>No se pudo analizar este vídeo. Prueba a subirlo de nuevo.</Text>
      </View>
    );
  }

  const analysis = video.analysis!;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.summary}>{analysis.summaryText}</Text>

      <View style={styles.tagRow}>
        {analysis.faultTags.map((tag) => (
          <Text key={tag} style={styles.tag}>
            {tag.replace(/_/g, " ")}
          </Text>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Ejercicios recomendados</Text>
      {analysis.recommendedExercises.map((rec) => (
        <View key={rec.exercise.id} style={styles.exerciseCard}>
          <Text style={styles.exerciseTitle}>
            {rec.rank}. {rec.exercise.title}
          </Text>
          <Text style={styles.exerciseDescription}>{rec.exercise.description}</Text>
          <Text style={styles.exerciseReason}>{rec.reason}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  hint: { color: "#666", textAlign: "center" },
  error: { color: "#c0392b", textAlign: "center", padding: 24 },
  summary: { fontSize: 16, lineHeight: 22, marginBottom: 16 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 24 },
  tag: {
    backgroundColor: "#eef7ee",
    color: "#1a7a3c",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  exerciseCard: { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, padding: 12, marginBottom: 12 },
  exerciseTitle: { fontWeight: "700", marginBottom: 4 },
  exerciseDescription: { color: "#333", marginBottom: 6 },
  exerciseReason: { color: "#1a7a3c", fontStyle: "italic" },
});
