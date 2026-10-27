const express = require("express");

const users = [{ id: 1, name: "Awa", email: "awa@example.com" }];
const app = express();
app.use(express.json());

app.get("/users/:id", (req, res) => {
  const user = users.find((u) => u.id === Number(req.params.id));
  if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
  return res.json(user);
});

app.listen(3000, () => console.log("API sur http://localhost:3000"));
