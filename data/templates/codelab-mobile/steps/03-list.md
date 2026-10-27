# Afficher les habitudes

Remplacez `app/index.tsx` par une liste. `FlatList` n'affiche que les lignes visibles : elle reste fluide même avec des centaines d'éléments.

```tsx title="app/index.tsx" {17-25}
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

type Habit = { id: string; name: string; done: boolean };

const START: Habit[] = [
  { id: "1", name: "Boire de l'eau", done: false },
  { id: "2", name: "Lire 10 pages", done: false },
];

export default function Index() {
  const [habits, setHabits] = useState(START);
  const toggle = (id: string) =>
    setHabits((list) => list.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
  return (
    <View style={styles.screen}>
      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggle(item.id)} style={styles.row}>
            <Text style={[styles.name, item.done && styles.done]}>{item.name}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: "#FFF9F5" },
  row: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginBottom: 10 },
  name: { fontSize: 18 },
  done: { textDecorationLine: "line-through", color: "#999" },
});
```

:::tip
Secouez le téléphone pour ouvrir le menu de développement et recharger l'app.
:::
