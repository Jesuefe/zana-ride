import ShopPage from '../../components/ShopPage';
export default function FoodPage() {
  const { t } = useLang();
  return <ShopPage category="FOOD" title="Food & Drinks" emptyMessage="No restaurants available yet." />;
}
