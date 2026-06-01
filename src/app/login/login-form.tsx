"use client";

import { useActionState } from "react";
import { loginAction, type LoginActionState } from "./actions";
import styles from "./login-form.module.css";

const initialState: LoginActionState = {
  error: null,
};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(
    loginAction,
    initialState,
  );

  return (
    <section className={styles.shell}>
      <span className={styles.eyebrow}>Intern inloggning</span>
      <h1 className={styles.title}>Skyddad planeringsyta för personal.</h1>
      <p className={styles.lead}>
        Logga in för att öppna planering, padda-önskemål och bokningar.
      </p>

      <form className={styles.form} action={formAction}>
        <label className={styles.field}>
          <span className={styles.label}>E-postadress</span>
          <input
            className={styles.input}
            type="email"
            name="email"
            defaultValue="admin@kriminalvarden.local"
            autoComplete="username"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Lösenord</span>
          <input
            className={styles.input}
            type="password"
            name="password"
            defaultValue="demo-anstalt-2026"
            autoComplete="current-password"
          />
        </label>

        <button className={styles.button} type="submit" disabled={isPending}>
          {isPending ? "Loggar in..." : "Logga in"}
        </button>
      </form>

      {state.error ? <div className={styles.error}>{state.error}</div> : null}

      {process.env.NODE_ENV !== "production" ? (
        <div className={styles.hint}>
          Lokal utvecklingsinloggning:
          <br />
          `admin@kriminalvarden.local`
          <br />
          `demo-anstalt-2026`
        </div>
      ) : null}
    </section>
  );
}
