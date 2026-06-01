import { LoginForm } from "./login-form";
import { redirectIfAuthenticated } from "./actions";
import styles from "./page.module.css";
import { shouldShowDemoCredentials } from "@/server/runtime";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  await redirectIfAuthenticated();

  return (
    <main className={styles.page}>
      <LoginForm showDemoCredentials={shouldShowDemoCredentials()} />
    </main>
  );
}
