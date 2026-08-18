import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { Video } from "@golf-coach/shared-types";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const STATUS_LABEL: Record<Video["status"], string> = {
  uploaded: "Subido",
  processing: "Analizando…",
  analyzed: "Analizado",
  failed: "Error",
};

export default function HomeScreen() {
  const { token, user, isLoading, signOut } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) router.replace("/");
  }, [isLoading, token]);

  const load = useCallback(async () => {
    if (!token) return;
    setVideos(await api.listVideos(token));
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!token) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hola, {user?.name}</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Salir</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.uploadButton} onPress={() => router.push("/upload")}>
        <Text style={styles.uploadButtonText}>+ Subir swing</Text>
      </TouchableOpacity>

      <FlatList
        data={videos}
        keyExtractor={(v) => v.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no has subido ningún swing.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => router.push(`/video/${item.id}`)}>
            <Text style={styles.cardTitle}>Swing del {new Date(item.createdAt).toLocaleDateString()}</Text>
            <Text style={styles.cardStatus}>{STATUS_LABEL[item.status]}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  greeting: { fontSize: 20, fontWeight: "700" },
  signOut: { color: "#c0392b" },
  uploadButton: { backgroundColor: "#1a7a3c", padding: 14, borderRadius: 8, alignItems: "center", marginBottom: 16 },
  uploadButtonText: { color: "#fff", fontWeight: "600" },
  empty: { textAlign: "center", color: "#666", marginTop: 32 },
  card: { padding: 16, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 8, marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardStatus: { color: "#666", marginTop: 4 },
});
