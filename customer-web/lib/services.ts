// Single source for the service list — the home row and the "See all" page
// both read from here, so adding a service only means editing one place.
export const SERVICES = [
  { id: 'car',     title: 'Ride',       sub: 'Affordable & safe',   image: '/icons/car.png',            bg: '#EEF9F6', route: '/search?service=ECONOMY' },
  { id: 'moto',    title: 'Moto Ride',  sub: 'Fast & reliable',     image: '/icons/motorbike.png',      bg: '#FDF6E3', route: '/search?service=BIKE' },
  { id: 'package', title: 'Delivery',   sub: 'Send anything',       image: '/icons/package-box.png',    bg: '#EEF9F6', route: '/deliver' },
  { id: 'food',    title: 'Order Food', sub: 'Meals & drinks',      image: '/icons/burger-drink.png',   bg: '#FDF6E3', route: '/food' },
  { id: 'shop',    title: 'Shop',       sub: 'Groceries & goods',   image: '/icons/grocery-bag.png',    bg: '#EEF9F6', route: '/shop' },
  { id: 'gift',    title: 'Send Gift',  sub: 'Roses & surprises',   image: '/icons/flower-bouquet.png', bg: '#FDF6E3', route: '/gifts' },
  { id: 'market',  title: 'Market',     sub: 'Agent shops for you', image: '/icons/grocery-bag.png',    bg: '#EEF9F6', route: '/market' },
];
