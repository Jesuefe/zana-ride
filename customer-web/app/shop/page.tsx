'use client';

import ShopPage from '../../components/ShopPage';
import { useLang } from '../../lib/LangContext';
export default function ShopDeliverPage() {
  const { t } = useLang();
  return <ShopPage category="GOODS" title={t('Shop & Deliver')} emptyMessage={t('No shops available yet.')} />;
}
