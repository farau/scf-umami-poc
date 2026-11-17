import { redirect } from 'next/navigation';
import { UmamiRootPage } from './UmamiRootPage';

export default function RootPage() {
  if (process.env.SCF_DEMO_MODE === 'true') redirect('/scf');
  return <UmamiRootPage />;
}
