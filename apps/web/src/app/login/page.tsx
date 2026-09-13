import { LoginForm } from './login-form';
export default function LoginPage() {
  return (
    <LoginForm demo={process.env.NODE_ENV !== 'production' && process.env.APP_DEMO_MODE === '1'} />
  );
}
