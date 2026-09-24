import ShopPage from '../../components/ShopPage';
export default function FoodPage() {
  return <ShopPage category="FOOD" title={t('Food & Drinks')} emptyMessage={t('No restaurants available yet.')} />;
}
