import { Redirect } from "expo-router";
import { Loading } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { isAuthenticated, initializing } = useAuth();

  if (initializing) return <Loading />;
  return <Redirect href={isAuthenticated ? "/(tabs)" : "/login"} />;
}
