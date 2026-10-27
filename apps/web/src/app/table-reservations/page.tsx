import { FoodScreen } from '../food/screen';
export default async function FoodPage({searchParams}:{searchParams:Promise<{date?:string;time?:string;new?:string;view?:string}>}) {
  const query=await searchParams;
  return <FoodScreen kind="list" date={query.date} time={query.time} startNew={query.new==='1'} listView={query.view==='list'} monthView={query.view==='month'}/>;
}
