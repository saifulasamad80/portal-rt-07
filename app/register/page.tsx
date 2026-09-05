import RegisterClient from "./RegisterClient";
import { aksiRegister } from "./actions";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ alasan?: string }> }) {
  const { alasan } = await searchParams;
  return <RegisterClient aksiRegister={aksiRegister} alasan={alasan} />;
}
