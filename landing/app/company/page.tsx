import CompanyHero from '../../components/CompanyHero';
import '../../components/company-hero.css';

export const metadata = {
  title: 'Zana — Kigali, in motion.',
  description:
    'Zana is building the technology network connecting mobility, delivery and commerce across Kigali.',
};

export default function CompanyPage() {
  return (
    <main>
      <CompanyHero />
    </main>
  );
}
