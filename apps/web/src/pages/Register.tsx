import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, user } = await api.register(email, password, name);
      signIn(token, user);
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card form" onSubmit={onSubmit}>
      <h1>Crear cuenta</h1>
      <input placeholder="Nombre" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
      <input type="email" placeholder="Email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Contraseña (mín. 8 caracteres)" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="error">{error}</p>}
      <button className="primary" type="submit" disabled={loading}>
        {loading ? "Creando…" : "Crear cuenta"}
      </button>
      <p className="muted center">
        ¿Ya tienes cuenta? <Link to="/">Inicia sesión</Link>
      </p>
    </form>
  );
}
