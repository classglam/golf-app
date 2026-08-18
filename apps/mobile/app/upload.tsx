import { useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { api, uploadFileToUrl } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function UploadScreen() {
  const { token } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickAndUpload = async () => {
    if (!token) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setStatus("Necesitamos permiso para acceder a tus vídeos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const extension = asset.uri.toLowerCase().endsWith(".mov") ? "mov" : "mp4";

    try {
      setBusy(true);
      setStatus("Solicitando URL de subida…");
      const { uploadUrl, storageKey } = await api.createUploadUrl(token, extension);

      setStatus("Subiendo vídeo…");
      await uploadFileToUrl(uploadUrl, asset.uri, `video/${extension}`);

      setStatus("Iniciando análisis…");
      const video = await api.createVideo(token, storageKey);

      router.replace(`/video/${video.id}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Error al subir el vídeo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Sube un vídeo corto de tu swing (idealmente de cara o desde atrás, palo completo visible).
      </Text>
      <Button title="Elegir vídeo" onPress={pickAndUpload} disabled={busy} />
      {busy && <ActivityIndicator style={{ marginTop: 16 }} />}
      {status && <Text style={styles.status}>{status}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "center", gap: 16 },
  hint: { textAlign: "center", color: "#444" },
  status: { textAlign: "center", color: "#666", marginTop: 8 },
});
