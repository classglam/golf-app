import { Stack } from "expo-router";
import { AuthProvider } from "../lib/auth-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ title: "Iniciar sesión" }} />
        <Stack.Screen name="register" options={{ title: "Crear cuenta" }} />
        <Stack.Screen name="home" options={{ title: "Mis swings" }} />
        <Stack.Screen name="upload" options={{ title: "Subir swing" }} />
        <Stack.Screen name="video/[id]" options={{ title: "Análisis" }} />
      </Stack>
    </AuthProvider>
  );
}
