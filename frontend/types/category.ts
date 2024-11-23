export interface Category {
  name: string;
  color: string;
  iconName: string;
  iconSet: string;
  subCategories?: { name: string, iconName: string, iconSet: string }[];
}
