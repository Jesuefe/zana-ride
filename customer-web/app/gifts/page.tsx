import ShopPage from '../../components/ShopPage';
export default function GiftsPage() {
  const { t } = useLang();
  return <ShopPage category="GIFTS" title="Gifts & Flowers" emptyMessage="No gift shops available yet." />;
}
