import { LoginForm } from "./login-form";
import { redirectIfAuthenticated } from "./actions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className={styles.page}>
      <LoginForm />
    </main>
  );
}
