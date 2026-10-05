import { FoodScreen } from '../food/screen';
export default async function FoodPage({searchParams}:{searchParams:Promise<{date?:string;time?:string}>}) {
  const query=await searchParams;
  return <FoodScreen kind="catalog" {...query}/>;
}
