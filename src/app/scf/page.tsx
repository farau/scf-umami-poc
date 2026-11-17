import { notFound } from 'next/navigation';
import ScfDemo from './ScfDemo';

export const metadata = { title: 'Stellar ecosystem analytics' };

export default function ScfPage() {
  if (process.env.SCF_DEMO_MODE !== 'true') notFound();
  return <ScfDemo nativeEnabled={process.env.SCF_NATIVE_ENABLED === 'true'} />;
}
