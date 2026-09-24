'use client';

import { useLang } from '../../lib/LangContext';
import ShopPage from '../../components/ShopPage';
export default function FoodPage() {
  const { t } = useLang();
  return <ShopPage category="FOOD" title={t('Food & Drinks')} emptyMessage={t('No restaurants available yet.')} />;
}
