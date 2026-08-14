export interface Product {
  id: string;
  title: string;
  description: string;
  price: string;
  currency: string;
  imageUrl: string | null;
  images: string[];
  productUrl: string | null;
}
